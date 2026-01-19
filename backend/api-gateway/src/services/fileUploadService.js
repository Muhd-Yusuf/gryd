/**
 * File Upload Service
 * Supports Cloudinary (primary) and AWS S3 (fallback)
 *
 * Features:
 * - Image uploads (profile pics, attachments)
 * - Document uploads (PDFs, docs)
 * - Voice note uploads (audio files)
 * - Video uploads
 * - Automatic optimization and transformation
 */

const cloudinary = require('cloudinary').v2;
const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const crypto = require('crypto');
const path = require('path');
const logger = require('../utils/logger');

// Retry configuration
const RETRY_CONFIG = {
    maxRetries: 3,
    baseDelayMs: 1000,
    maxDelayMs: 10000,
};

/**
 * Retry wrapper with exponential backoff
 * @param {Function} fn - Function to retry
 * @param {string} operationName - Name of operation for logging
 * @returns {Promise<any>} Result of successful operation
 */
const withRetry = async (fn, operationName) => {
    let lastError;
    for (let attempt = 1; attempt <= RETRY_CONFIG.maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;
            const isRetryable = error.code === 'ECONNRESET' ||
                error.code === 'ETIMEDOUT' ||
                error.code === 'ENOTFOUND' ||
                error.message?.includes('timeout') ||
                error.http_code >= 500;

            if (!isRetryable || attempt === RETRY_CONFIG.maxRetries) {
                logger.error('FileUpload', `${operationName} failed after ${attempt} attempts`, { error: error.message });
                throw error;
            }

            const delay = Math.min(
                RETRY_CONFIG.baseDelayMs * Math.pow(2, attempt - 1),
                RETRY_CONFIG.maxDelayMs
            );
            logger.warn('FileUpload', `${operationName} attempt ${attempt} failed, retrying in ${delay}ms`, { error: error.message });
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
    throw lastError;
};

// Initialize Cloudinary
const initCloudinary = () => {
    if (process.env.CLOUDINARY_CLOUD_NAME) {
        cloudinary.config({
            cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
            api_key: process.env.CLOUDINARY_API_KEY,
            api_secret: process.env.CLOUDINARY_API_SECRET,
            secure: true,
        });
        return true;
    }
    return false;
};

// Initialize S3
let s3Client = null;
const initS3 = () => {
    if (process.env.AWS_S3_BUCKET && !s3Client) {
        s3Client = new S3Client({
            region: process.env.AWS_S3_REGION || 'us-east-1',
            credentials: {
                accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
            },
        });
    }
    return s3Client;
};

// Generate unique filename
const generateFilename = (originalName, prefix = 'file') => {
    const ext = path.extname(originalName || '.bin');
    const hash = crypto.randomBytes(8).toString('hex');
    const timestamp = Date.now();
    return `${prefix}_${timestamp}_${hash}${ext}`;
};

// Determine resource type for Cloudinary
const getResourceType = (mimeType) => {
    if (!mimeType) return 'auto';
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('video/')) return 'video';
    if (mimeType.startsWith('audio/')) return 'video'; // Cloudinary treats audio as video
    return 'raw';
};

// Get folder based on file type
const getFolder = (type, subgridId) => {
    const base = subgridId ? `subgrids/${subgridId}` : 'general';
    switch (type) {
        case 'avatar': return `${base}/avatars`;
        case 'attachment': return `${base}/attachments`;
        case 'voice-note': return `${base}/voice-notes`;
        case 'image': return `${base}/images`;
        case 'document': return `${base}/documents`;
        case 'video': return `${base}/videos`;
        default: return `${base}/files`;
    }
};

/**
 * Upload file to Cloudinary
 * @param {Object} options Upload options
 * @param {Buffer|string} options.file - File buffer or base64 string
 * @param {string} options.filename - Original filename
 * @param {string} options.mimeType - MIME type
 * @param {string} options.type - File type (avatar, attachment, voice-note, etc.)
 * @param {string} options.subgridId - Subgrid ID for organization
 * @param {string} options.userId - User ID
 * @returns {Promise<Object>} Upload result
 */
const uploadToCloudinary = async ({ file, filename, mimeType, type = 'attachment', subgridId, userId }) => {
    if (!initCloudinary()) {
        throw new Error('Cloudinary not configured');
    }

    const folder = getFolder(type, subgridId);
    const resourceType = getResourceType(mimeType);
    const publicId = generateFilename(filename, type);

    // Convert buffer to base64 data URI if needed
    let uploadData = file;
    if (Buffer.isBuffer(file)) {
        const base64 = file.toString('base64');
        uploadData = `data:${mimeType || 'application/octet-stream'};base64,${base64}`;
    }

    const uploadOptions = {
        folder,
        public_id: publicId,
        resource_type: resourceType,
        overwrite: true,
        tags: [type, subgridId, userId].filter(Boolean),
    };

    // Add transformations for specific types
    if (type === 'avatar') {
        uploadOptions.transformation = [
            { width: 256, height: 256, crop: 'fill', gravity: 'face' },
            { quality: 'auto', fetch_format: 'auto' },
        ];
    } else if (type === 'image') {
        uploadOptions.transformation = [
            { quality: 'auto', fetch_format: 'auto' },
        ];
    } else if (type === 'voice-note') {
        // Audio optimization
        uploadOptions.resource_type = 'video';
    }

    const result = await withRetry(
        () => cloudinary.uploader.upload(uploadData, uploadOptions),
        'Cloudinary upload'
    );

    logger.info('FileUpload', 'Cloudinary upload successful', { publicId: result.public_id, size: result.bytes });

    return {
        url: result.secure_url,
        publicId: result.public_id,
        resourceType: result.resource_type,
        format: result.format,
        size: result.bytes,
        width: result.width,
        height: result.height,
        duration: result.duration, // For audio/video
        provider: 'cloudinary',
    };
};

/**
 * Upload file to S3
 * @param {Object} options Upload options
 * @returns {Promise<Object>} Upload result
 */
const uploadToS3 = async ({ file, filename, mimeType, type = 'attachment', subgridId, userId }) => {
    const client = initS3();
    if (!client) {
        throw new Error('S3 not configured');
    }

    const folder = getFolder(type, subgridId);
    const key = `${folder}/${generateFilename(filename, type)}`;

    const command = new PutObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET,
        Key: key,
        Body: file,
        ContentType: mimeType,
        Metadata: {
            userId: userId || '',
            subgridId: subgridId || '',
            type,
        },
    });

    await withRetry(
        () => client.send(command),
        'S3 upload'
    );

    const url = `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_S3_REGION || 'us-east-1'}.amazonaws.com/${key}`;
    const size = Buffer.isBuffer(file) ? file.length : 0;

    logger.info('FileUpload', 'S3 upload successful', { key, size });

    return {
        url,
        key,
        size,
        provider: 's3',
    };
};

/**
 * Upload file (auto-selects provider)
 * @param {Object} options Upload options
 * @returns {Promise<Object>} Upload result
 */
const uploadFile = async (options) => {
    console.log('[uploadFile] Starting upload, CLOUDINARY_CLOUD_NAME:', process.env.CLOUDINARY_CLOUD_NAME ? 'SET' : 'NOT SET');

    // Try Cloudinary first
    if (process.env.CLOUDINARY_CLOUD_NAME) {
        try {
            console.log('[uploadFile] Attempting Cloudinary upload...');
            const result = await uploadToCloudinary(options);
            console.log('[uploadFile] Cloudinary upload successful');
            return result;
        } catch (error) {
            console.error('[uploadFile] Cloudinary upload failed:', error.message);
            logger.warn('FileUpload', 'Cloudinary upload failed, trying S3 fallback', { error: error.message });
        }
    }

    // Fall back to S3
    if (process.env.AWS_S3_BUCKET) {
        return await uploadToS3(options);
    }

    throw new Error('No file storage provider configured. Set CLOUDINARY_CLOUD_NAME or AWS_S3_BUCKET.');
};

/**
 * Delete file from Cloudinary
 * @param {string} publicId - Cloudinary public ID
 * @param {string} resourceType - Resource type (image, video, raw)
 */
const deleteFromCloudinary = async (publicId, resourceType = 'image') => {
    if (!initCloudinary()) {
        throw new Error('Cloudinary not configured');
    }

    await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
};

/**
 * Delete file from S3
 * @param {string} key - S3 object key
 */
const deleteFromS3 = async (key) => {
    const client = initS3();
    if (!client) {
        throw new Error('S3 not configured');
    }

    const command = new DeleteObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET,
        Key: key,
    });

    await client.send(command);
};

/**
 * Generate a presigned URL for direct upload (S3 only)
 * @param {string} filename - Original filename
 * @param {string} mimeType - MIME type
 * @param {string} type - File type
 * @param {string} subgridId - Subgrid ID
 * @returns {Promise<Object>} Presigned URL and key
 */
const getPresignedUploadUrl = async ({ filename, mimeType, type = 'attachment', subgridId }) => {
    const client = initS3();
    if (!client) {
        throw new Error('S3 not configured');
    }

    const folder = getFolder(type, subgridId);
    const key = `${folder}/${generateFilename(filename, type)}`;

    const command = new PutObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET,
        Key: key,
        ContentType: mimeType,
    });

    const presignedUrl = await getSignedUrl(client, command, { expiresIn: 3600 });

    return {
        uploadUrl: presignedUrl,
        key,
        publicUrl: `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_S3_REGION || 'us-east-1'}.amazonaws.com/${key}`,
    };
};

/**
 * Get Cloudinary upload signature for direct frontend upload
 * @param {Object} options - Upload options
 * @returns {Object} Signature and upload params
 */
const getCloudinarySignature = ({ type = 'attachment', subgridId, userId }) => {
    if (!initCloudinary()) {
        throw new Error('Cloudinary not configured');
    }

    const timestamp = Math.round(Date.now() / 1000);
    const folder = getFolder(type, subgridId);

    const paramsToSign = {
        timestamp,
        folder,
        tags: [type, subgridId, userId].filter(Boolean).join(','),
    };

    const signature = cloudinary.utils.api_sign_request(
        paramsToSign,
        process.env.CLOUDINARY_API_SECRET
    );

    return {
        signature,
        timestamp,
        folder,
        apiKey: process.env.CLOUDINARY_API_KEY,
        cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    };
};

module.exports = {
    uploadFile,
    uploadToCloudinary,
    uploadToS3,
    deleteFromCloudinary,
    deleteFromS3,
    getPresignedUploadUrl,
    getCloudinarySignature,
    generateFilename,
};
