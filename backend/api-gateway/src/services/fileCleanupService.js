/**
 * File Cleanup Service
 * Handles cleanup of orphaned files from storage providers
 */

const FileMetadata = require('../models/FileMetadata');
const { deleteFromCloudinary, deleteFromS3 } = require('./fileUploadService');

/**
 * Mark files as orphaned when their parent document is deleted
 * Call this from model hooks or controllers when deleting records
 *
 * @param {string} model - Model name (e.g., 'User', 'Message')
 * @param {string} documentId - The deleted document's ID
 */
const markFilesOrphaned = async (model, documentId) => {
    try {
        const files = await FileMetadata.find({
            'references.model': model,
            'references.documentId': documentId,
        });

        for (const file of files) {
            await file.removeReference(model, documentId, file.references.find(
                ref => ref.model === model && ref.documentId.toString() === documentId.toString()
            )?.field || 'unknown');
        }

        console.log(`[FileCleanup] Marked ${files.length} files as potentially orphaned for ${model}:${documentId}`);
    } catch (error) {
        console.error('[FileCleanup] Error marking files orphaned:', error);
    }
};

/**
 * Delete a single file from storage and database
 *
 * @param {Object} fileMetadata - FileMetadata document
 * @returns {Promise<boolean>} Success status
 */
const deleteFile = async (fileMetadata) => {
    try {
        // Delete from storage provider
        if (fileMetadata.provider === 'cloudinary' && fileMetadata.publicId) {
            await deleteFromCloudinary(fileMetadata.publicId, fileMetadata.resourceType || 'image');
        } else if (fileMetadata.provider === 's3' && fileMetadata.key) {
            await deleteFromS3(fileMetadata.key);
        }

        // Update metadata status
        fileMetadata.status = 'deleted';
        fileMetadata.deletedAt = new Date();
        await fileMetadata.save();

        return true;
    } catch (error) {
        console.error(`[FileCleanup] Failed to delete file ${fileMetadata._id}:`, error);
        return false;
    }
};

/**
 * Clean up orphaned files older than specified days
 * Run this periodically (e.g., daily via cron job)
 *
 * @param {number} daysOld - Minimum age in days for orphaned files (default: 7)
 * @param {number} batchSize - Number of files to process per batch (default: 100)
 * @returns {Promise<Object>} Cleanup results
 */
const cleanupOrphanedFiles = async (daysOld = 7, batchSize = 100) => {
    const results = {
        processed: 0,
        deleted: 0,
        failed: 0,
        errors: [],
    };

    try {
        const orphanedFiles = await FileMetadata.findOrphanedFiles(daysOld);
        results.processed = orphanedFiles.length;

        console.log(`[FileCleanup] Found ${orphanedFiles.length} orphaned files older than ${daysOld} days`);

        // Process in batches
        for (let i = 0; i < orphanedFiles.length; i += batchSize) {
            const batch = orphanedFiles.slice(i, i + batchSize);

            await Promise.all(batch.map(async (file) => {
                const success = await deleteFile(file);
                if (success) {
                    results.deleted++;
                } else {
                    results.failed++;
                    results.errors.push(file._id.toString());
                }
            }));

            // Add small delay between batches to avoid rate limiting
            if (i + batchSize < orphanedFiles.length) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }

        console.log(`[FileCleanup] Cleanup complete: ${results.deleted} deleted, ${results.failed} failed`);
    } catch (error) {
        console.error('[FileCleanup] Cleanup error:', error);
        results.errors.push(error.message);
    }

    return results;
};

/**
 * Clean up files for a specific user (e.g., when account is deleted)
 *
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Cleanup results
 */
const cleanupUserFiles = async (userId) => {
    const results = {
        processed: 0,
        deleted: 0,
        failed: 0,
    };

    try {
        const userFiles = await FileMetadata.find({
            userId,
            status: { $ne: 'deleted' },
        });

        results.processed = userFiles.length;

        for (const file of userFiles) {
            const success = await deleteFile(file);
            if (success) {
                results.deleted++;
            } else {
                results.failed++;
            }
        }

        console.log(`[FileCleanup] User ${userId} cleanup: ${results.deleted} deleted, ${results.failed} failed`);
    } catch (error) {
        console.error(`[FileCleanup] User cleanup error for ${userId}:`, error);
    }

    return results;
};

/**
 * Clean up files for a specific subgrid (e.g., when subgrid is deleted)
 *
 * @param {string} subgridId - Subgrid ID
 * @returns {Promise<Object>} Cleanup results
 */
const cleanupSubgridFiles = async (subgridId) => {
    const results = {
        processed: 0,
        deleted: 0,
        failed: 0,
    };

    try {
        const subgridFiles = await FileMetadata.find({
            subgridId,
            status: { $ne: 'deleted' },
        });

        results.processed = subgridFiles.length;

        for (const file of subgridFiles) {
            const success = await deleteFile(file);
            if (success) {
                results.deleted++;
            } else {
                results.failed++;
            }
        }

        console.log(`[FileCleanup] Subgrid ${subgridId} cleanup: ${results.deleted} deleted, ${results.failed} failed`);
    } catch (error) {
        console.error(`[FileCleanup] Subgrid cleanup error for ${subgridId}:`, error);
    }

    return results;
};

/**
 * Get storage usage statistics
 *
 * @returns {Promise<Object>} Storage stats
 */
const getStorageStats = async () => {
    const stats = await FileMetadata.aggregate([
        { $match: { status: 'active' } },
        {
            $group: {
                _id: {
                    provider: '$provider',
                    type: '$type',
                },
                count: { $sum: 1 },
                totalSize: { $sum: '$size' },
            },
        },
    ]);

    const orphanedStats = await FileMetadata.aggregate([
        { $match: { status: 'orphaned' } },
        {
            $group: {
                _id: null,
                count: { $sum: 1 },
                totalSize: { $sum: '$size' },
            },
        },
    ]);

    return {
        active: stats,
        orphaned: orphanedStats[0] || { count: 0, totalSize: 0 },
    };
};

/**
 * Schedule periodic cleanup (call this on server startup)
 * Runs daily at 3 AM
 */
let cleanupInterval = null;
const scheduleCleanup = () => {
    // Clear existing interval if any
    if (cleanupInterval) {
        clearInterval(cleanupInterval);
    }

    // Run cleanup every 24 hours
    cleanupInterval = setInterval(async () => {
        console.log('[FileCleanup] Starting scheduled cleanup...');
        await cleanupOrphanedFiles(7, 100);
    }, 24 * 60 * 60 * 1000);

    console.log('[FileCleanup] Scheduled daily cleanup enabled');
};

const stopScheduledCleanup = () => {
    if (cleanupInterval) {
        clearInterval(cleanupInterval);
        cleanupInterval = null;
        console.log('[FileCleanup] Scheduled cleanup disabled');
    }
};

module.exports = {
    markFilesOrphaned,
    deleteFile,
    cleanupOrphanedFiles,
    cleanupUserFiles,
    cleanupSubgridFiles,
    getStorageStats,
    scheduleCleanup,
    stopScheduledCleanup,
};
