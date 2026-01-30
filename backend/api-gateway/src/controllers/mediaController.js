/**
 * Media Controller
 * Handles file uploads, voice notes, and call management
 */

const fs = require('fs');
const fileUploadService = require('../services/fileUploadService');
const callService = require('../services/callService');
const FileMetadata = require('../models/FileMetadata');
const Subgrid = require('../models/Subgrid');
const { getSubgridMembership, isMembershipActive } = require('../services/permissionService');

// ===================
// HELPER FUNCTIONS
// ===================

/**
 * Validate subgrid access for uploads
 * Returns null if valid, error response if invalid
 */
const validateSubgridAccess = async (subgridId, userId, res) => {
    if (!subgridId) {
        return null; // No subgrid specified, general upload allowed
    }

    try {
        // Find the subgrid
        const subgrid = await Subgrid.findById(subgridId);
        if (!subgrid) {
            res.status(404).json({ success: false, error: 'Subgrid not found' });
            return 'error';
        }

        // Check if subgrid is active
        if (subgrid.status !== 'active') {
            res.status(403).json({ success: false, error: 'Subgrid is not active' });
            return 'error';
        }

        // Check user membership
        const membership = await getSubgridMembership(subgrid.tenantId, subgridId, userId);
        if (!membership || !isMembershipActive(membership)) {
            res.status(403).json({ success: false, error: 'You do not have access to upload to this subgrid' });
            return 'error';
        }

        // Return tenantId for file metadata
        return { tenantId: subgrid.tenantId };
    } catch (error) {
        console.error('Subgrid access validation error:', error);
        res.status(500).json({ success: false, error: 'Failed to validate subgrid access' });
        return 'error';
    }
};

/**
 * Get file buffer from either memory or disk storage
 */
const getFileBuffer = async (file) => {
    if (file.buffer) {
        return file.buffer;
    }
    // File is on disk, read it
    if (file.path) {
        return fs.promises.readFile(file.path);
    }
    throw new Error('No file data available');
};

// ===================
// FILE UPLOAD ENDPOINTS
// ===================

/**
 * Upload a file (image, document, voice note, video)
 * POST /api/media/upload
 */
const uploadFile = async (req, res) => {
    try {
        const { type = 'attachment', subgridId } = req.body;
        const file = req.file;

        if (!file) {
            return res.status(400).json({ success: false, error: 'No file provided' });
        }

        // Validate subgrid access if subgridId is provided
        const accessResult = await validateSubgridAccess(subgridId, req.user._id.toString(), res);
        if (accessResult === 'error') {
            return; // Response already sent
        }

        // Get file buffer (handles both memory and disk storage)
        const fileBuffer = await getFileBuffer(file);

        const result = await fileUploadService.uploadFile({
            file: fileBuffer,
            filename: file.originalname,
            mimeType: file.mimetype,
            type,
            subgridId,
            userId: req.user._id.toString(),
        });

        // Track file metadata for cleanup
        try {
            await FileMetadata.createFromUpload(result, {
                filename: file.originalname,
                mimeType: file.mimetype,
                type,
                userId: req.user._id,
                tenantId: accessResult?.tenantId,
                subgridId: subgridId || null,
            });
        } catch (metadataError) {
            console.error('Failed to save file metadata:', metadataError);
            // Don't fail the upload if metadata save fails
        }

        res.json({
            success: true,
            data: result,
        });
    } catch (error) {
        console.error('File upload error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Upload avatar/profile picture
 * POST /api/media/avatar
 */
const uploadAvatar = async (req, res) => {
    try {
        const file = req.file;

        if (!file) {
            return res.status(400).json({ success: false, error: 'No file provided' });
        }

        // Get file buffer (handles both memory and disk storage)
        const fileBuffer = await getFileBuffer(file);

        const result = await fileUploadService.uploadFile({
            file: fileBuffer,
            filename: file.originalname,
            mimeType: file.mimetype,
            type: 'avatar',
            userId: req.user._id.toString(),
        });

        // Track file metadata for cleanup
        try {
            await FileMetadata.createFromUpload(result, {
                filename: file.originalname,
                mimeType: file.mimetype,
                type: 'avatar',
                userId: req.user._id,
            });
        } catch (metadataError) {
            console.error('Failed to save avatar metadata:', metadataError);
        }

        // Update the user's avatarUrl in the database
        try {
            const User = require('../models/User');
            const avatarUrl = result.url || result.secureUrl || result.secure_url;
            await User.findByIdAndUpdate(req.user._id, { avatarUrl });
            result.avatarUrl = avatarUrl;
        } catch (updateError) {
            console.error('Failed to update user avatarUrl:', updateError);
        }

        res.json({
            success: true,
            data: result,
        });
    } catch (error) {
        console.error('Avatar upload error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Upload banner/cover image
 * POST /api/media/banner
 */
const uploadBanner = async (req, res) => {
    try {
        const file = req.file;

        if (!file) {
            return res.status(400).json({ success: false, error: 'No file provided' });
        }

        // Get file buffer (handles both memory and disk storage)
        const fileBuffer = await getFileBuffer(file);

        const result = await fileUploadService.uploadFile({
            file: fileBuffer,
            filename: file.originalname,
            mimeType: file.mimetype,
            type: 'banner',
            userId: req.user._id.toString(),
        });

        // Track file metadata for cleanup
        try {
            await FileMetadata.createFromUpload(result, {
                filename: file.originalname,
                mimeType: file.mimetype,
                type: 'banner',
                userId: req.user._id,
            });
        } catch (metadataError) {
            console.error('Failed to save banner metadata:', metadataError);
        }

        // Update the user's bannerUrl in the database
        try {
            const User = require('../models/User');
            const bannerUrl = result.url || result.secureUrl || result.secure_url;
            await User.findByIdAndUpdate(req.user._id, { bannerUrl });
            result.bannerUrl = bannerUrl;
        } catch (updateError) {
            console.error('Failed to update user bannerUrl:', updateError);
        }

        res.json({
            success: true,
            data: result,
        });
    } catch (error) {
        console.error('Banner upload error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Upload voice note
 * POST /api/media/voice-note
 */
const uploadVoiceNote = async (req, res) => {
    try {
        const { subgridId, channelId, dmPeerId } = req.body;
        const file = req.file;

        if (!file) {
            return res.status(400).json({ success: false, error: 'No audio file provided' });
        }

        // Validate audio mime type
        if (!file.mimetype.startsWith('audio/')) {
            return res.status(400).json({ success: false, error: 'File must be an audio file' });
        }

        // Validate subgrid access if subgridId is provided
        const accessResult = await validateSubgridAccess(subgridId, req.user._id.toString(), res);
        if (accessResult === 'error') {
            return; // Response already sent
        }

        // Get file buffer (handles both memory and disk storage)
        const fileBuffer = await getFileBuffer(file);

        const result = await fileUploadService.uploadFile({
            file: fileBuffer,
            filename: file.originalname,
            mimeType: file.mimetype,
            type: 'voice-note',
            subgridId,
            userId: req.user._id.toString(),
        });

        // Track file metadata for cleanup
        try {
            await FileMetadata.createFromUpload(result, {
                filename: file.originalname,
                mimeType: file.mimetype,
                type: 'voice-note',
                userId: req.user._id,
                tenantId: accessResult?.tenantId,
                subgridId: subgridId || null,
            });
        } catch (metadataError) {
            console.error('Failed to save voice note metadata:', metadataError);
        }

        res.json({
            success: true,
            data: {
                ...result,
                channelId,
                dmPeerId,
            },
        });
    } catch (error) {
        console.error('Voice note upload error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Get Cloudinary signature for direct frontend upload
 * POST /api/media/signature
 */
const getUploadSignature = async (req, res) => {
    try {
        const { type = 'attachment', subgridId } = req.body;

        // Validate subgrid access if subgridId is provided
        const accessResult = await validateSubgridAccess(subgridId, req.user._id.toString(), res);
        if (accessResult === 'error') {
            return; // Response already sent
        }

        const signature = fileUploadService.getCloudinarySignature({
            type,
            subgridId,
            userId: req.user._id.toString(),
        });

        res.json({
            success: true,
            data: signature,
        });
    } catch (error) {
        console.error('Signature generation error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Get presigned URL for S3 direct upload
 * POST /api/media/presigned-url
 */
const getPresignedUrl = async (req, res) => {
    try {
        const { filename, mimeType, type = 'attachment', subgridId } = req.body;

        if (!filename || !mimeType) {
            return res.status(400).json({
                success: false,
                error: 'filename and mimeType are required'
            });
        }

        // Validate subgrid access if subgridId is provided
        const accessResult = await validateSubgridAccess(subgridId, req.user._id.toString(), res);
        if (accessResult === 'error') {
            return; // Response already sent
        }

        const result = await fileUploadService.getPresignedUploadUrl({
            filename,
            mimeType,
            type,
            subgridId,
        });

        res.json({
            success: true,
            data: result,
        });
    } catch (error) {
        console.error('Presigned URL error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Delete a file
 * DELETE /api/media/:provider/:id
 */
const deleteFile = async (req, res) => {
    try {
        const { provider, id } = req.params;
        const { resourceType = 'image' } = req.query;

        // Check if user owns this file or has admin access
        const fileMetadata = await FileMetadata.findOne({
            $or: [
                { publicId: id },
                { key: id },
            ],
        });

        if (fileMetadata) {
            // Verify ownership
            if (fileMetadata.userId.toString() !== req.user._id.toString()) {
                // Check if user is admin of the subgrid
                if (fileMetadata.subgridId) {
                    const subgrid = await Subgrid.findById(fileMetadata.subgridId);
                    if (subgrid) {
                        const membership = await getSubgridMembership(
                            subgrid.tenantId,
                            fileMetadata.subgridId,
                            req.user._id.toString()
                        );
                        if (!membership || !['subgrid_admin', 'moderator'].includes(membership.role)) {
                            return res.status(403).json({
                                success: false,
                                error: 'You do not have permission to delete this file'
                            });
                        }
                    }
                } else {
                    return res.status(403).json({
                        success: false,
                        error: 'You do not have permission to delete this file'
                    });
                }
            }

            // Mark file as deleted in metadata
            fileMetadata.status = 'deleted';
            fileMetadata.deletedAt = new Date();
            await fileMetadata.save();
        }

        // Delete from storage provider
        if (provider === 'cloudinary') {
            await fileUploadService.deleteFromCloudinary(id, resourceType);
        } else if (provider === 's3') {
            await fileUploadService.deleteFromS3(id);
        } else {
            return res.status(400).json({ success: false, error: 'Invalid provider' });
        }

        res.json({ success: true });
    } catch (error) {
        console.error('File delete error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// ===================
// CALL ENDPOINTS
// ===================

const callSignaling = require('../services/callSignalingService');

/**
 * Initiate a DM call
 * POST /api/media/calls/dm
 */
const initiateDMCall = async (req, res) => {
    try {
        const { calleeId, callType = 'audio', subgridId } = req.body;
        const callerId = req.user._id.toString();

        if (!calleeId) {
            return res.status(400).json({ success: false, error: 'calleeId is required' });
        }

        if (!callService.isAgoraConfigured()) {
            return res.status(503).json({
                success: false,
                error: 'Call service not configured'
            });
        }

        const callSession = await callService.initiateDMCall(callerId, calleeId, callType, { subgridId });

        if (!callSession.success) {
            return res.status(400).json(callSession);
        }

        res.json({
            success: true,
            data: callSession,
        });
    } catch (error) {
        console.error('DM call initiation error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Initiate a channel call
 * POST /api/calls/channel
 */
const initiateChannelCall = async (req, res) => {
    try {
        const { channelId, callType = 'audio' } = req.body;
        const userId = req.user._id.toString();

        if (!channelId) {
            return res.status(400).json({ success: false, error: 'channelId is required' });
        }

        if (!callService.isAgoraConfigured()) {
            return res.status(503).json({
                success: false,
                error: 'Call service not configured'
            });
        }

        const callSession = callService.initiateChannelCall(channelId, userId, callType);

        res.json({
            success: true,
            data: callSession,
        });
    } catch (error) {
        console.error('Channel call initiation error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Initiate a group call
 * POST /api/calls/group
 */
const initiateGroupCall = async (req, res) => {
    try {
        const { groupId, callType = 'audio' } = req.body;
        const userId = req.user._id.toString();

        if (!groupId) {
            return res.status(400).json({ success: false, error: 'groupId is required' });
        }

        if (!callService.isAgoraConfigured()) {
            return res.status(503).json({
                success: false,
                error: 'Call service not configured'
            });
        }

        const callSession = callService.initiateGroupCall(groupId, userId, callType);

        res.json({
            success: true,
            data: callSession,
        });
    } catch (error) {
        console.error('Group call initiation error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Get/refresh call token
 * POST /api/calls/token
 */
const getCallToken = async (req, res) => {
    try {
        const { channelName } = req.body;
        const userId = req.user._id.toString();

        if (!channelName) {
            return res.status(400).json({ success: false, error: 'channelName is required' });
        }

        if (!callService.isAgoraConfigured()) {
            return res.status(503).json({
                success: false,
                error: 'Call service not configured'
            });
        }

        const tokenInfo = callService.refreshCallToken(channelName, userId);

        res.json({
            success: true,
            data: tokenInfo,
        });
    } catch (error) {
        console.error('Token refresh error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Check if call service is available
 * GET /api/media/calls/status
 */
const getCallServiceStatus = async (req, res) => {
    res.json({
        success: true,
        data: {
            configured: callService.isAgoraConfigured(),
            provider: 'agora',
        },
    });
};

/**
 * Answer an incoming call
 * POST /api/media/calls/:callId/answer
 */
const answerCall = async (req, res) => {
    try {
        const { callId } = req.params;
        const userId = req.user._id.toString();

        if (!callService.isAgoraConfigured()) {
            return res.status(503).json({
                success: false,
                error: 'Call service not configured'
            });
        }

        const result = await callService.answerCall(callId, userId);

        if (!result.success) {
            return res.status(400).json(result);
        }

        res.json({
            success: true,
            data: result,
        });
    } catch (error) {
        console.error('Answer call error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Decline an incoming call
 * POST /api/media/calls/:callId/decline
 */
const declineCall = async (req, res) => {
    try {
        const { callId } = req.params;
        const userId = req.user._id.toString();

        const result = await callService.declineCall(callId, userId);

        if (!result.success) {
            return res.status(400).json(result);
        }

        res.json({
            success: true,
            data: result,
        });
    } catch (error) {
        console.error('Decline call error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * End an active call
 * POST /api/media/calls/:callId/end
 */
const endCall = async (req, res) => {
    try {
        const { callId } = req.params;
        const userId = req.user._id.toString();

        const result = await callService.endCall(callId, userId);

        if (!result.success) {
            return res.status(400).json(result);
        }

        res.json({
            success: true,
            data: result,
        });
    } catch (error) {
        console.error('End call error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Get call details
 * GET /api/media/calls/:callId
 */
const getCall = async (req, res) => {
    try {
        const { callId } = req.params;

        const call = await callService.getCall(callId);

        if (!call) {
            return res.status(404).json({ success: false, error: 'Call not found' });
        }

        res.json({
            success: true,
            data: call,
        });
    } catch (error) {
        console.error('Get call error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Get call history for current user
 * GET /api/media/calls/history
 */
const getCallHistory = async (req, res) => {
    try {
        const userId = req.user._id.toString();
        const { limit = 50, offset = 0, callType, peerId } = req.query;

        let history;
        if (peerId) {
            // Get DM call history with specific user
            history = await callService.getDMCallHistory(userId, peerId, parseInt(limit));
        } else {
            // Get all call history
            history = await callService.getCallHistory(userId, {
                limit: parseInt(limit),
                offset: parseInt(offset),
                callType,
            });
        }

        res.json({
            success: true,
            data: history,
        });
    } catch (error) {
        console.error('Get call history error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * SSE endpoint for receiving call events
 * GET /api/media/calls/events
 */
const subscribeToCallEvents = async (req, res) => {
    try {
        const userId = req.user._id.toString();
        callSignaling.registerConnection(userId, res);
    } catch (error) {
        console.error('Call events subscription error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// In-memory voice channel participant tracking
// Format: { channelId: Map<agoraUid, { userId, agoraUid, joinedAt }> }
const voiceChannelParticipants = new Map();

/**
 * Join a voice channel (track participant)
 * POST /api/media/calls/voice-channel/join
 */
const joinVoiceChannel = async (req, res) => {
    try {
        const { channelId, subgridId, agoraUid } = req.body;
        const userId = req.user._id.toString();

        if (!channelId || !agoraUid) {
            return res.status(400).json({ success: false, error: 'channelId and agoraUid are required' });
        }

        // Initialize channel if not exists
        if (!voiceChannelParticipants.has(channelId)) {
            voiceChannelParticipants.set(channelId, new Map());
        }

        // Add participant
        const channelMap = voiceChannelParticipants.get(channelId);
        channelMap.set(agoraUid, {
            userId,
            agoraUid,
            subgridId: subgridId || null,
            joinedAt: new Date(),
        });

        console.log(`[VoiceChannel] User ${userId} joined channel ${channelId} with agoraUid ${agoraUid}`);

        res.json({
            success: true,
            data: { channelId, agoraUid, participantCount: channelMap.size },
        });
    } catch (error) {
        console.error('Join voice channel error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Leave a voice channel (untrack participant)
 * POST /api/media/calls/voice-channel/leave
 */
const leaveVoiceChannel = async (req, res) => {
    try {
        const { channelId, agoraUid } = req.body;
        const userId = req.user._id.toString();

        if (!channelId) {
            return res.status(400).json({ success: false, error: 'channelId is required' });
        }

        const channelMap = voiceChannelParticipants.get(channelId);
        if (channelMap) {
            // Remove by agoraUid if provided, otherwise by userId
            if (agoraUid) {
                channelMap.delete(agoraUid);
            } else {
                // Find and remove by userId
                for (const [uid, participant] of channelMap.entries()) {
                    if (participant.userId === userId) {
                        channelMap.delete(uid);
                        break;
                    }
                }
            }

            // Clean up empty channels
            if (channelMap.size === 0) {
                voiceChannelParticipants.delete(channelId);
            }
        }

        console.log(`[VoiceChannel] User ${userId} left channel ${channelId}`);

        res.json({
            success: true,
            data: { channelId, participantCount: channelMap?.size || 0 },
        });
    } catch (error) {
        console.error('Leave voice channel error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Get voice channel participants with user details
 * GET /api/media/calls/voice-channel/:channelId/participants
 */
const getVoiceChannelParticipants = async (req, res) => {
    try {
        const { channelId } = req.params;
        const { subgridId } = req.query;

        const channelMap = voiceChannelParticipants.get(channelId);
        if (!channelMap || channelMap.size === 0) {
            return res.json({ success: true, data: { participants: [] } });
        }

        // Get user details for all participants
        const User = require('../models/User');
        const SubgridMembership = require('../models/SubgridMembership');

        const participantArray = Array.from(channelMap.values());
        const userIds = participantArray.map(p => p.userId);

        const users = await User.find({ _id: { $in: userIds } })
            .select('firstName lastName email username avatarUrl role stakeholderBadge company');

        const userMap = new Map(users.map(u => [u._id.toString(), u]));

        // Get membership data if subgridId is provided
        let membershipMap = new Map();
        if (subgridId) {
            const memberships = await SubgridMembership.find({
                subgridId,
                userId: { $in: userIds },
            }).select('userId role stakeholderBadge');
            memberships.forEach(m => {
                membershipMap.set(m.userId.toString(), m);
            });
        }

        // Build response with user details
        const participants = participantArray.map(p => {
            const user = userMap.get(p.userId);
            const membership = membershipMap.get(p.userId);
            const badge = membership?.stakeholderBadge || user?.stakeholderBadge || null;
            const memberRole = membership?.role || user?.role || 'member';

            return {
                agoraUid: p.agoraUid,
                userId: p.userId,
                joinedAt: p.joinedAt,
                userDetails: user ? {
                    firstName: user.firstName,
                    lastName: user.lastName,
                    email: user.email,
                    username: user.username,
                    avatarUrl: user.avatarUrl,
                    displayName: [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email,
                    memberRole,
                    stakeholderBadge: badge,
                    company: user.company || null,
                } : null,
            };
        });

        res.json({
            success: true,
            data: { participants },
        });
    } catch (error) {
        console.error('Get voice channel participants error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

module.exports = {
    // File uploads
    uploadFile,
    uploadAvatar,
    uploadBanner,
    uploadVoiceNote,
    getUploadSignature,
    getPresignedUrl,
    deleteFile,
    // Calls
    initiateDMCall,
    initiateChannelCall,
    initiateGroupCall,
    getCallToken,
    getCallServiceStatus,
    answerCall,
    declineCall,
    endCall,
    getCall,
    getCallHistory,
    subscribeToCallEvents,
    // Voice channel tracking
    joinVoiceChannel,
    leaveVoiceChannel,
    getVoiceChannelParticipants,
};
