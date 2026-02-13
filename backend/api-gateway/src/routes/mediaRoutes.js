/**
 * Media Routes
 * File uploads, voice notes, and call management
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const { attachUserContext, requireUser } = require('../middleware/authMiddleware');
const mediaController = require('../controllers/mediaController');
const {
    uploadRateLimiter,
    avatarRateLimiter,
    voiceNoteRateLimiter,
    signatureRateLimiter,
    clearRateLimitStore,
} = require('../middleware/rateLimitMiddleware');

// Attach user context to all routes
router.use(attachUserContext);

// Allowed MIME types
const allowedTypes = [
    // Images
    'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
    // Videos
    'video/mp4', 'video/webm', 'video/quicktime',
    // Audio
    'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/webm', 'audio/mp4', 'audio/aac',
    'audio/m4a', 'audio/x-m4a', 'audio/mp4a-latm', 'audio/x-caf', // iOS/Expo audio formats
    // Documents
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'text/csv',
];

// Size threshold for disk vs memory storage (10MB)
const DISK_STORAGE_THRESHOLD = 10 * 1024 * 1024;

// Create temp upload directory with error handling
let uploadDir = path.join(os.tmpdir(), 'syphor-uploads');
try {
    if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
    }
    // Verify we can write to the directory
    fs.accessSync(uploadDir, fs.constants.W_OK);
} catch (err) {
    console.error('[MediaRoutes] Failed to create/access temp upload directory:', err.message);
    // Fallback to OS temp directory directly
    uploadDir = os.tmpdir();
    console.log('[MediaRoutes] Using fallback upload directory:', uploadDir);
}

// Custom storage engine that uses disk for large files, memory for small ones
const hybridStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
        cb(null, `upload-${uniqueSuffix}${path.extname(file.originalname)}`);
    },
});

// File filter function
const fileFilter = (req, file, cb) => {
    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error(`File type ${file.mimetype} is not allowed`), false);
    }
};

// Configure multer with disk storage for better memory management
const upload = multer({
    storage: hybridStorage,
    limits: {
        fileSize: 50 * 1024 * 1024, // 50MB max file size
    },
    fileFilter,
});

// Small file uploads (avatars) can use memory storage
const smallUpload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB max for avatars
    },
    fileFilter,
});

// Error handling middleware for multer
const handleMulterError = (err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
                success: false,
                error: 'File size exceeds limit'
            });
        }
        return res.status(400).json({ success: false, error: err.message });
    }
    if (err) {
        return res.status(400).json({ success: false, error: err.message });
    }
    next();
};

// Cleanup middleware - removes temp file after upload is processed
const cleanupTempFile = (req, res, next) => {
    const originalEnd = res.end;
    res.end = function(...args) {
        // Clean up temp file after response is sent
        if (req.file && req.file.path) {
            fs.unlink(req.file.path, (err) => {
                if (err && err.code !== 'ENOENT') {
                    console.error('[MediaRoutes] Failed to cleanup temp file:', err);
                }
            });
        }
        originalEnd.apply(res, args);
    };
    next();
};

// ===================
// FILE UPLOAD ROUTES
// ===================

// Upload a general file (attachment)
// Uses disk storage for large files, includes rate limiting and temp file cleanup
router.post('/upload',
    requireUser,
    uploadRateLimiter,
    upload.single('file'),
    handleMulterError,
    cleanupTempFile,
    mediaController.uploadFile
);

// Upload avatar/profile picture
// Uses memory storage (small files only), stricter rate limit
router.post('/avatar',
    requireUser,
    avatarRateLimiter,
    smallUpload.single('file'),
    handleMulterError,
    mediaController.uploadAvatar
);

// Upload banner/cover image
// Uses disk storage for larger images
router.post('/banner',
    requireUser,
    avatarRateLimiter,
    upload.single('file'),
    handleMulterError,
    cleanupTempFile,
    mediaController.uploadBanner
);

// Upload voice note
// Uses disk storage, dedicated rate limit
router.post('/voice-note',
    requireUser,
    voiceNoteRateLimiter,
    upload.single('file'),
    handleMulterError,
    cleanupTempFile,
    mediaController.uploadVoiceNote
);

// Get Cloudinary signature for direct upload
router.post('/signature',
    requireUser,
    signatureRateLimiter,
    mediaController.getUploadSignature
);

// Get S3 presigned URL for direct upload
router.post('/presigned-url',
    requireUser,
    signatureRateLimiter,
    mediaController.getPresignedUrl
);

// Delete a file
router.delete('/:provider/:id',
    requireUser,
    mediaController.deleteFile
);

// ===================
// CALL ROUTES
// ===================

// Check call service status
router.get('/calls/status',
    requireUser,
    mediaController.getCallServiceStatus
);

// SSE endpoint for receiving call events (incoming calls, etc.)
router.get('/calls/events',
    requireUser,
    mediaController.subscribeToCallEvents
);

// Get call history
router.get('/calls/history',
    requireUser,
    mediaController.getCallHistory
);

// Get call details (must be after /history to avoid route conflict)
router.get('/calls/:callId',
    requireUser,
    mediaController.getCall
);

// Initiate DM call
router.post('/calls/dm',
    requireUser,
    mediaController.initiateDMCall
);

// Initiate channel call
router.post('/calls/channel',
    requireUser,
    mediaController.initiateChannelCall
);

// Initiate group call
router.post('/calls/group',
    requireUser,
    mediaController.initiateGroupCall
);

// Get/refresh call token
router.post('/calls/token',
    requireUser,
    mediaController.getCallToken
);

// Answer an incoming call
router.post('/calls/:callId/answer',
    requireUser,
    mediaController.answerCall
);

// Decline an incoming call
router.post('/calls/:callId/decline',
    requireUser,
    mediaController.declineCall
);

// End an active call
router.post('/calls/:callId/end',
    requireUser,
    mediaController.endCall
);

// ===================
// VOICE CHANNEL ROUTES
// ===================

// Join a voice channel (track participant)
router.post('/calls/voice-channel/join',
    requireUser,
    mediaController.joinVoiceChannel
);

// Leave a voice channel (untrack participant)
router.post('/calls/voice-channel/leave',
    requireUser,
    mediaController.leaveVoiceChannel
);

// Get voice channel participants with user details
router.get('/calls/voice-channel/:channelId/participants',
    requireUser,
    mediaController.getVoiceChannelParticipants
);

// Wave to speak (raise hand)
router.post('/calls/voice-channel/wave',
    requireUser,
    mediaController.waveToSpeak
);

// Cancel wave to speak (lower hand)
router.post('/calls/voice-channel/cancel-wave',
    requireUser,
    mediaController.cancelWave
);

// Grant speaker permission (host/admin only)
router.post('/calls/voice-channel/grant-speaker',
    requireUser,
    mediaController.grantSpeaker
);

// Revoke speaker permission (host only)
router.post('/calls/voice-channel/revoke-speaker',
    requireUser,
    mediaController.revokeSpeaker
);

// Mute a participant (host/speaker can mute listeners)
router.post('/calls/voice-channel/mute-participant',
    requireUser,
    mediaController.muteParticipant
);

// Update own mute state
router.post('/calls/voice-channel/update-mute',
    requireUser,
    mediaController.updateMuteState
);

// ===================
// DEV/DEBUG ROUTES
// ===================

// Reset rate limits (development only)
router.post('/dev/reset-rate-limits', (req, res) => {
    const { prefix } = req.body;
    clearRateLimitStore(prefix);
    res.json({ success: true, message: `Rate limits cleared${prefix ? ` for prefix: ${prefix}` : ''}` });
});

module.exports = router;
