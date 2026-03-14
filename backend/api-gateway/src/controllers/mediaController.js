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
        res.status(500).json({ success: false });
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
        res.status(500).json({ success: false });
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
        res.status(500).json({ success: false });
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
        res.status(500).json({ success: false });
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
        res.status(500).json({ success: false });
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
        res.status(500).json({ success: false });
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
        res.status(500).json({ success: false });
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
        res.status(500).json({ success: false });
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
        res.status(500).json({ success: false });
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
        res.status(500).json({ success: false });
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
        res.status(500).json({ success: false });
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
        res.status(500).json({ success: false });
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
        res.status(500).json({ success: false });
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
        res.status(500).json({ success: false });
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
        res.status(500).json({ success: false });
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
        res.status(500).json({ success: false });
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
        res.status(500).json({ success: false });
    }
};

// Voice channel participant and state tracking - persisted in MongoDB
const VoiceChannelParticipant = require('../models/VoiceChannelParticipant');
const VoiceChannelState = require('../models/VoiceChannelState');

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

        // Initialize channel state if not exists
        let channelState = await VoiceChannelState.findOne({ channelId });
        if (!channelState) {
            channelState = await VoiceChannelState.create({ channelId, hostId: null, speakers: [], waveRequests: [] });
        }

        // Remove any existing entries for this user (handles reconnects with new agoraUid)
        const existingParticipant = await VoiceChannelParticipant.findOneAndDelete({ channelId, userId });
        let existingRole = existingParticipant?.role || null;
        if (existingParticipant) {
            console.log(`[VoiceChannel] Removing stale entry for user ${userId} with old agoraUid ${existingParticipant.agoraUid}, role was: ${existingRole}`);
            // Remove from speakers array
            channelState.speakers = channelState.speakers.filter(s => s !== userId);
        }

        // Count remaining participants
        const participantCount = await VoiceChannelParticipant.countDocuments({ channelId });
        const isFirstParticipant = participantCount === 0;

        // Check if user is a subgrid admin (they auto-become speakers)
        let isAdmin = false;
        if (subgridId) {
            const SubgridMembership = require('../models/SubgridMembership');
            const membership = await SubgridMembership.findOne({ subgridId, userId });
            isAdmin = membership?.role === 'subgrid_admin' || membership?.role === 'moderator';
            console.log(`[VoiceChannel] User ${userId} membership check: subgridId=${subgridId}, role=${membership?.role}, isAdmin=${isAdmin}`);
        } else {
            console.log(`[VoiceChannel] No subgridId provided for user ${userId}, cannot determine admin status`);
        }

        // Determine role
        let role = 'listener';

        // Check if host actually exists in participants
        let hostStillInChannel = false;
        if (channelState.hostId) {
            const hostParticipant = await VoiceChannelParticipant.findOne({ channelId, userId: channelState.hostId });
            hostStillInChannel = !!hostParticipant;
            if (!hostStillInChannel) {
                console.log(`[VoiceChannel] Previous host ${channelState.hostId} no longer in channel, resetting`);
                channelState.hostId = null;
            }
        }

        const wasHost = existingRole === 'host' || channelState.hostId === userId;
        const hasHost = channelState.hostId !== null && hostStillInChannel;

        if (isAdmin) {
            role = 'host';
            if (hasHost && channelState.hostId !== userId) {
                const previousHostId = channelState.hostId;
                await VoiceChannelParticipant.updateOne({ channelId, userId: previousHostId }, { role: 'speaker' });
                console.log(`[VoiceChannel] Demoted previous host ${previousHostId} to speaker`);
            }
            channelState.hostId = userId;
            if (!channelState.speakers.includes(userId)) channelState.speakers.push(userId);
            console.log(`[VoiceChannel] Admin ${userId} became HOST`);
        } else if (wasHost) {
            role = 'host';
            channelState.hostId = userId;
            if (!channelState.speakers.includes(userId)) channelState.speakers.push(userId);
            console.log(`[VoiceChannel] Restored host role for returning user ${userId}`);
        } else if (!hasHost && isFirstParticipant) {
            role = 'host';
            channelState.hostId = userId;
            if (!channelState.speakers.includes(userId)) channelState.speakers.push(userId);
            console.log(`[VoiceChannel] First participant ${userId} became temporary host`);
        } else {
            console.log(`[VoiceChannel] User ${userId} became listener`);
        }

        // Save channel state
        await channelState.save();

        // Add participant to MongoDB
        await VoiceChannelParticipant.create({
            channelId,
            userId,
            agoraUid,
            subgridId: subgridId || null,
            role,
            isMuted: role === 'listener',
            isHandRaised: false,
        });

        const newCount = await VoiceChannelParticipant.countDocuments({ channelId });
        console.log(`[VoiceChannel] User ${userId} joined channel ${channelId} with agoraUid ${agoraUid}, role: ${role}, participants: ${newCount}`);

        res.json({
            success: true,
            data: { channelId, agoraUid, participantCount: newCount, role },
        });
    } catch (error) {
        console.error('Join voice channel error:', error);
        res.status(500).json({ success: false });
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

        // Remove participant from MongoDB
        if (agoraUid) {
            await VoiceChannelParticipant.deleteOne({ channelId, agoraUid });
        } else {
            await VoiceChannelParticipant.deleteOne({ channelId, userId });
        }

        // Update channel state
        const channelState = await VoiceChannelState.findOne({ channelId });
        if (channelState) {
            channelState.speakers = channelState.speakers.filter(s => s !== userId);
            channelState.waveRequests = channelState.waveRequests.filter(w => w.userId !== userId);

            // If host leaves, assign new host
            const remainingCount = await VoiceChannelParticipant.countDocuments({ channelId });
            if (channelState.hostId === userId && remainingCount > 0) {
                const nextParticipant = await VoiceChannelParticipant.findOne({ channelId });
                if (nextParticipant) {
                    channelState.hostId = nextParticipant.userId;
                    if (!channelState.speakers.includes(nextParticipant.userId)) {
                        channelState.speakers.push(nextParticipant.userId);
                    }
                    nextParticipant.role = 'host';
                    await nextParticipant.save();
                }
            }

            // Clean up empty channels
            if (remainingCount === 0) {
                await VoiceChannelState.deleteOne({ channelId });
            } else {
                await channelState.save();
            }
        }

        const participantCount = await VoiceChannelParticipant.countDocuments({ channelId });
        console.log(`[VoiceChannel] User ${userId} left channel ${channelId}, remaining: ${participantCount}`);

        res.json({
            success: true,
            data: { channelId, participantCount },
        });
    } catch (error) {
        console.error('Leave voice channel error:', error);
        res.status(500).json({ success: false });
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

        const participantArray = await VoiceChannelParticipant.find({ channelId }).lean();
        if (!participantArray || participantArray.length === 0) {
            return res.json({ success: true, data: { participants: [], hostId: null, speakerIds: [], waveRequests: [] } });
        }

        // Get user details for all participants
        const User = require('../models/User');
        const SubgridMembership = require('../models/SubgridMembership');

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

        // Get channel state
        const channelState = await VoiceChannelState.findOne({ channelId }).lean();
        const speakersSet = new Set(channelState?.speakers || []);
        const waveRequestUserIds = new Set((channelState?.waveRequests || []).map(w => w.userId));

        // Build response with user details
        const participants = participantArray.map(p => {
            const user = userMap.get(p.userId);
            const membership = membershipMap.get(p.userId);
            const badge = membership?.stakeholderBadge || user?.stakeholderBadge || null;
            const memberRole = membership?.role || user?.role || 'member';
            const isSpeaker = speakersSet.has(p.userId);
            const isHost = channelState?.hostId === p.userId;
            const hasHandRaised = waveRequestUserIds.has(p.userId);

            return {
                agoraUid: p.agoraUid,
                userId: p.userId,
                joinedAt: p.joinedAt,
                // Voice channel role (host, speaker, listener)
                voiceRole: isHost ? 'host' : (isSpeaker ? 'speaker' : 'listener'),
                isMuted: p.isMuted || false,
                isHandRaised: hasHandRaised,
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

        // Get wave requests with user details
        const waveRequests = [];
        if (channelState?.waveRequests) {
            for (const wr of channelState.waveRequests) {
                const user = userMap.get(wr.userId);
                if (user) {
                    waveRequests.push({
                        userId: wr.userId,
                        timestamp: wr.requestedAt,
                        displayName: [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email,
                        avatarUrl: user.avatarUrl,
                    });
                }
            }
        }

        res.json({
            success: true,
            data: {
                participants,
                hostId: channelState?.hostId || null,
                speakerIds: channelState?.speakers || [],
                waveRequests,
            },
        });
    } catch (error) {
        console.error('Get voice channel participants error:', error);
        res.status(500).json({ success: false });
    }
};

/**
 * Wave to speak (raise hand) in voice channel
 * POST /api/media/calls/voice-channel/wave
 */
const waveToSpeak = async (req, res) => {
    try {
        const { channelId } = req.body;
        const userId = req.user._id.toString();

        if (!channelId) {
            return res.status(400).json({ success: false, error: 'channelId is required' });
        }

        const channelState = await VoiceChannelState.findOne({ channelId });
        if (!channelState) {
            return res.status(404).json({ success: false, error: 'Voice channel not found' });
        }

        // If already a speaker, no need to wave
        if (channelState.speakers.includes(userId)) {
            return res.json({
                success: true,
                data: { message: 'You are already a speaker', alreadySpeaker: true },
            });
        }

        // Add wave request
        const alreadyWaving = channelState.waveRequests.some(w => w.userId === userId);
        if (!alreadyWaving) {
            channelState.waveRequests.push({ userId, requestedAt: new Date() });
            await channelState.save();
        }

        console.log(`[VoiceChannel] User ${userId} raised hand in channel ${channelId}`);

        res.json({
            success: true,
            data: { channelId, waveRequestCount: channelState.waveRequests.length },
        });
    } catch (error) {
        console.error('Wave to speak error:', error);
        res.status(500).json({ success: false });
    }
};

/**
 * Cancel wave to speak (lower hand)
 * POST /api/media/calls/voice-channel/cancel-wave
 */
const cancelWave = async (req, res) => {
    try {
        const { channelId } = req.body;
        const userId = req.user._id.toString();

        if (!channelId) {
            return res.status(400).json({ success: false, error: 'channelId is required' });
        }

        await VoiceChannelState.updateOne(
            { channelId },
            { $pull: { waveRequests: { userId } } }
        );

        console.log(`[VoiceChannel] User ${userId} lowered hand in channel ${channelId}`);

        res.json({
            success: true,
            data: { channelId },
        });
    } catch (error) {
        console.error('Cancel wave error:', error);
        res.status(500).json({ success: false });
    }
};

/**
 * Grant speaker permission (host only)
 * POST /api/media/calls/voice-channel/grant-speaker
 */
const grantSpeaker = async (req, res) => {
    try {
        const { channelId, targetUserId } = req.body;
        const userId = req.user._id.toString();

        if (!channelId || !targetUserId) {
            return res.status(400).json({ success: false, error: 'channelId and targetUserId are required' });
        }

        const channelState = await VoiceChannelState.findOne({ channelId });
        if (!channelState) {
            return res.status(404).json({ success: false, error: 'Voice channel not found' });
        }

        // Only host can grant speaker permission
        if (channelState.hostId !== userId) {
            return res.status(403).json({ success: false, error: 'Only host can grant speaker permission' });
        }

        // Add target user as speaker
        if (!channelState.speakers.includes(targetUserId)) {
            channelState.speakers.push(targetUserId);
        }
        channelState.waveRequests = channelState.waveRequests.filter(w => w.userId !== targetUserId);
        await channelState.save();

        // Update participant record
        await VoiceChannelParticipant.updateOne(
            { channelId, userId: targetUserId },
            { role: 'speaker', isMuted: false }
        );

        console.log(`[VoiceChannel] User ${targetUserId} granted speaker by ${userId} in channel ${channelId}`);

        res.json({
            success: true,
            data: { channelId, targetUserId, role: 'speaker' },
        });
    } catch (error) {
        console.error('Grant speaker error:', error);
        res.status(500).json({ success: false });
    }
};

/**
 * Revoke speaker permission (host only)
 * POST /api/media/calls/voice-channel/revoke-speaker
 */
const revokeSpeaker = async (req, res) => {
    try {
        const { channelId, targetUserId } = req.body;
        const userId = req.user._id.toString();

        if (!channelId || !targetUserId) {
            return res.status(400).json({ success: false, error: 'channelId and targetUserId are required' });
        }

        const channelState = await VoiceChannelState.findOne({ channelId });
        if (!channelState) {
            return res.status(404).json({ success: false, error: 'Voice channel not found' });
        }

        // Only host can revoke speakers
        if (channelState.hostId !== userId) {
            return res.status(403).json({ success: false, error: 'Only host can revoke speaker permission' });
        }

        // Cannot revoke host
        if (channelState.hostId === targetUserId) {
            return res.status(400).json({ success: false, error: 'Cannot revoke host speaker permission' });
        }

        // Remove target user from speakers
        channelState.speakers = channelState.speakers.filter(s => s !== targetUserId);
        await channelState.save();

        // Update participant record
        await VoiceChannelParticipant.updateOne(
            { channelId, userId: targetUserId },
            { role: 'listener', isMuted: true }
        );

        console.log(`[VoiceChannel] User ${targetUserId} revoked speaker by ${userId} in channel ${channelId}`);

        res.json({
            success: true,
            data: { channelId, targetUserId, role: 'listener' },
        });
    } catch (error) {
        console.error('Revoke speaker error:', error);
        res.status(500).json({ success: false });
    }
};

/**
 * Mute a participant (host only can mute others)
 * POST /api/media/calls/voice-channel/mute-participant
 */
const muteParticipant = async (req, res) => {
    try {
        const { channelId, targetUserId, mute } = req.body;
        const userId = req.user._id.toString();

        if (!channelId || !targetUserId || mute === undefined) {
            return res.status(400).json({ success: false, error: 'channelId, targetUserId, and mute are required' });
        }

        const channelState = await VoiceChannelState.findOne({ channelId });
        if (!channelState) {
            return res.status(404).json({ success: false, error: 'Voice channel not found' });
        }

        // Only host can mute other participants
        if (channelState.hostId !== userId) {
            return res.status(403).json({ success: false, error: 'Only host can mute participants' });
        }

        // Update participant mute state
        await VoiceChannelParticipant.updateOne(
            { channelId, userId: targetUserId },
            { isMuted: mute }
        );

        console.log(`[VoiceChannel] User ${targetUserId} ${mute ? 'muted' : 'unmuted'} by ${userId} in channel ${channelId}`);

        res.json({
            success: true,
            data: { channelId, targetUserId, isMuted: mute },
        });
    } catch (error) {
        console.error('Mute participant error:', error);
        res.status(500).json({ success: false });
    }
};

/**
 * Update own mute state
 * POST /api/media/calls/voice-channel/update-mute
 */
const updateMuteState = async (req, res) => {
    try {
        const { channelId, isMuted } = req.body;
        const userId = req.user._id.toString();

        if (!channelId || isMuted === undefined) {
            return res.status(400).json({ success: false, error: 'channelId and isMuted are required' });
        }

        await VoiceChannelParticipant.updateOne(
            { channelId, userId },
            { isMuted }
        );

        res.json({
            success: true,
            data: { channelId, isMuted },
        });
    } catch (error) {
        console.error('Update mute state error:', error);
        res.status(500).json({ success: false });
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
    // Voice channel Spaces-like features
    waveToSpeak,
    cancelWave,
    grantSpeaker,
    revokeSpeaker,
    muteParticipant,
    updateMuteState,
};
