const express = require('express');
const router = express.Router();
const {
    getUserProfile,
    updateUserProfile,
    listTenants,
    createTenant,
    addTenantMember,
    createSubgrid,
    listTenantSubgrids,
    getSubgridDetails,
    updateSubgrid,
    addSubgridMember,
    getMySubgridRole,
    listSubgridMembers,
    updateSubgridMember,
    removeSubgridMember,
    createInviteLink,
    listInviteLinks,
    revokeInviteLink,
    acceptInviteLink,
    issueEmbedToken,
    listChannels,
    createChannel,
    updateChannel,
    deleteChannel,
    listCategories,
    createCategory,
    updateCategory,
    deleteCategory,
    listEvents,
    createEvent,
    updateEvent,
    deleteEvent,
    listMessages,
    createMessage,
    deleteMessage,
    flagMessage,
    listPosts,
    createPost,
    deletePost,
    listComments,
    createComment,
    deleteComment,
    flagPost,
    flagComment,
    addReaction,
    removeReaction,
    likePost,
    unlikePost,
    resharePost,
    unresharePost,
    getPostEngagement,
    listDirectMessages,
    createDirectMessage,
    flagDirectMessage,
    deleteDirectMessage,
    listFriends,
    listMutualFriends,
    listBlockedFriends,
    listFriendRequests,
    createFriendRequest,
    acceptFriendRequest,
    declineFriendRequest,
    removeFriend,
    blockFriend,
    unblockFriend,
    listModerationQueue,
    moderateFlag,
    listAuditLog,
    getSubgridAnalytics,
    listNotifications,
    markNotificationRead,
    updatePresence,
    getPresence,
    getUserPresence,
    setOffline,
    inviteByEmail,
    resendInviteEmail,
    listPendingInvites,
    validateInviteToken,
    getContentModerationSettings,
    updateContentModerationSettings,
    addProhibitedWords,
    removeProhibitedWords,
    testContentFilter,
    likeMessage,
    unlikeMessage,
    reshareMessage,
    unreshareMessage,
    listMessageComments,
    createMessageComment,
    listChannelMembers,
    addChannelMembers,
    removeChannelMember,
    listBannedUsers,
    banUser,
    unbanUser,
} = require('../controllers/communityController');
const {
    getRoles,
    createRole,
    updateRole,
    deleteRole,
    assignRole,
    removeRole,
    getRoleMembers,
} = require('../controllers/customRoleController');
const { attachUserContext, requireUser } = require('../middleware/authMiddleware');
const { attachEmbedContext } = require('../middleware/embedMiddleware');
const {
    loadSubgrid,
    requireSubgridRead,
    requireSubgridWrite,
    requireSubgridModeration,
    requireSubgridAdmin,
} = require('../middleware/subgridAccess');

router.use(attachUserContext);
router.use(attachEmbedContext);

// User profile
router.get('/users/me', requireUser, getUserProfile);
router.patch('/users/me', requireUser, updateUserProfile);

router.get('/tenants', requireUser, listTenants);
router.post('/tenants', requireUser, createTenant);
router.post('/tenants/:tenantId/members', requireUser, addTenantMember);

router.post('/tenants/:tenantId/subgrids', requireUser, createSubgrid);
router.get('/tenants/:tenantId/subgrids', requireUser, listTenantSubgrids);
router.get('/subgrids/:subgridId', loadSubgrid, requireSubgridRead, getSubgridDetails);
router.patch('/subgrids/:subgridId', requireUser, loadSubgrid, requireSubgridAdmin, updateSubgrid);
router.post('/subgrids/:subgridId/members', requireUser, loadSubgrid, requireSubgridAdmin, addSubgridMember);
router.get('/subgrids/:subgridId/members', requireUser, loadSubgrid, requireSubgridRead, listSubgridMembers);
router.get('/subgrids/:subgridId/my-role', requireUser, getMySubgridRole);
router.patch('/subgrids/:subgridId/members/:userId', requireUser, loadSubgrid, requireSubgridAdmin, updateSubgridMember);
router.delete('/subgrids/:subgridId/members/:userId', requireUser, loadSubgrid, requireSubgridAdmin, removeSubgridMember);

router.post('/subgrids/:subgridId/invites', requireUser, loadSubgrid, requireSubgridAdmin, createInviteLink);
router.get('/subgrids/:subgridId/invites', requireUser, loadSubgrid, requireSubgridAdmin, listInviteLinks);
router.get('/subgrids/:subgridId/invites/pending', requireUser, loadSubgrid, requireSubgridAdmin, listPendingInvites);
router.get('/subgrids/:subgridId/invites/validate', validateInviteToken); // Public endpoint
router.post('/subgrids/:subgridId/invites/email', requireUser, loadSubgrid, requireSubgridAdmin, inviteByEmail);
router.post('/subgrids/:subgridId/invites/:inviteId/revoke', requireUser, loadSubgrid, requireSubgridAdmin, revokeInviteLink);
router.post('/subgrids/:subgridId/invites/:inviteId/resend', requireUser, loadSubgrid, requireSubgridAdmin, resendInviteEmail);
router.post('/subgrids/:subgridId/invites/accept', requireUser, loadSubgrid, acceptInviteLink);
router.post('/subgrids/:subgridId/embed-token', loadSubgrid, issueEmbedToken);

router.get('/subgrids/:subgridId/channels', loadSubgrid, requireSubgridRead, listChannels);
router.post('/subgrids/:subgridId/channels', requireUser, loadSubgrid, requireSubgridAdmin, createChannel);
router.patch('/subgrids/:subgridId/channels/:channelId', requireUser, loadSubgrid, requireSubgridAdmin, updateChannel);
router.delete('/subgrids/:subgridId/channels/:channelId', requireUser, loadSubgrid, requireSubgridAdmin, deleteChannel);

// Channel Members (private channel management)
router.get('/subgrids/:subgridId/channels/:channelId/members', requireUser, loadSubgrid, requireSubgridAdmin, listChannelMembers);
router.post('/subgrids/:subgridId/channels/:channelId/members', requireUser, loadSubgrid, requireSubgridAdmin, addChannelMembers);
router.delete('/subgrids/:subgridId/channels/:channelId/members/:userId', requireUser, loadSubgrid, requireSubgridAdmin, removeChannelMember);

// Bans
router.get('/subgrids/:subgridId/bans', requireUser, loadSubgrid, requireSubgridAdmin, listBannedUsers);
router.post('/subgrids/:subgridId/bans', requireUser, loadSubgrid, requireSubgridAdmin, banUser);
router.delete('/subgrids/:subgridId/bans/:odl', requireUser, loadSubgrid, requireSubgridAdmin, unbanUser);

// Channel Messages (alternative routes that map channelId from URL to query)
router.get('/subgrids/:subgridId/channels/:channelId/messages', loadSubgrid, requireSubgridRead, (req, res, next) => {
    req.query.channelId = req.params.channelId;
    next();
}, listMessages);
router.post('/subgrids/:subgridId/channels/:channelId/messages', loadSubgrid, requireSubgridWrite, (req, res, next) => {
    req.body.channelId = req.params.channelId;
    next();
}, createMessage);
router.delete('/subgrids/:subgridId/channels/:channelId/messages/:messageId', requireUser, loadSubgrid, requireSubgridRead, deleteMessage);

// Categories
router.get('/subgrids/:subgridId/categories', loadSubgrid, requireSubgridRead, listCategories);
router.post('/subgrids/:subgridId/categories', requireUser, loadSubgrid, requireSubgridAdmin, createCategory);
router.patch('/subgrids/:subgridId/categories/:categoryId', requireUser, loadSubgrid, requireSubgridAdmin, updateCategory);
router.delete('/subgrids/:subgridId/categories/:categoryId', requireUser, loadSubgrid, requireSubgridAdmin, deleteCategory);

// Events
router.get('/subgrids/:subgridId/events', loadSubgrid, requireSubgridRead, listEvents);
router.post('/subgrids/:subgridId/events', requireUser, loadSubgrid, requireSubgridAdmin, createEvent);
router.patch('/subgrids/:subgridId/events/:eventId', requireUser, loadSubgrid, requireSubgridAdmin, updateEvent);
router.delete('/subgrids/:subgridId/events/:eventId', requireUser, loadSubgrid, requireSubgridAdmin, deleteEvent);

router.get('/subgrids/:subgridId/messages', loadSubgrid, requireSubgridRead, listMessages);
router.post('/subgrids/:subgridId/messages', loadSubgrid, requireSubgridWrite, createMessage);
router.delete('/subgrids/:subgridId/messages/:messageId', requireUser, loadSubgrid, requireSubgridRead, deleteMessage);
router.post('/subgrids/:subgridId/messages/:messageId/flag', loadSubgrid, requireSubgridRead, flagMessage);

// Message likes, reshares, and comments
router.post('/subgrids/:subgridId/messages/:messageId/like', requireUser, loadSubgrid, requireSubgridWrite, likeMessage);
router.delete('/subgrids/:subgridId/messages/:messageId/like', requireUser, loadSubgrid, requireSubgridWrite, unlikeMessage);
router.post('/subgrids/:subgridId/messages/:messageId/reshare', requireUser, loadSubgrid, requireSubgridWrite, reshareMessage);
router.delete('/subgrids/:subgridId/messages/:messageId/reshare', requireUser, loadSubgrid, requireSubgridWrite, unreshareMessage);
router.get('/subgrids/:subgridId/messages/:messageId/comments', loadSubgrid, requireSubgridRead, listMessageComments);
router.post('/subgrids/:subgridId/messages/:messageId/comments', requireUser, loadSubgrid, requireSubgridWrite, createMessageComment);

router.get('/subgrids/:subgridId/posts', loadSubgrid, requireSubgridRead, listPosts);
router.post('/subgrids/:subgridId/posts', requireUser, loadSubgrid, requireSubgridWrite, createPost);
router.delete('/subgrids/:subgridId/posts/:postId', requireUser, loadSubgrid, requireSubgridRead, deletePost);
router.get('/subgrids/:subgridId/posts/:postId/comments', loadSubgrid, requireSubgridRead, listComments);
router.post('/subgrids/:subgridId/posts/:postId/comments', requireUser, loadSubgrid, requireSubgridWrite, createComment);
router.delete('/subgrids/:subgridId/comments/:commentId', requireUser, loadSubgrid, requireSubgridRead, deleteComment);
router.post('/subgrids/:subgridId/posts/:postId/flag', requireUser, loadSubgrid, requireSubgridRead, flagPost);
router.post('/subgrids/:subgridId/comments/:commentId/flag', requireUser, loadSubgrid, requireSubgridRead, flagComment);

// Post likes and reshares
router.post('/subgrids/:subgridId/posts/:postId/like', requireUser, loadSubgrid, requireSubgridWrite, likePost);
router.delete('/subgrids/:subgridId/posts/:postId/like', requireUser, loadSubgrid, requireSubgridWrite, unlikePost);
router.post('/subgrids/:subgridId/posts/:postId/reshare', requireUser, loadSubgrid, requireSubgridWrite, resharePost);
router.delete('/subgrids/:subgridId/posts/:postId/reshare', requireUser, loadSubgrid, requireSubgridWrite, unresharePost);
router.get('/subgrids/:subgridId/posts/:postId/engagement', loadSubgrid, requireSubgridRead, getPostEngagement);

router.post('/subgrids/:subgridId/reactions', requireUser, loadSubgrid, requireSubgridWrite, addReaction);
router.delete('/subgrids/:subgridId/reactions', requireUser, loadSubgrid, requireSubgridWrite, removeReaction);

router.get('/subgrids/:subgridId/direct-messages', requireUser, loadSubgrid, requireSubgridRead, listDirectMessages);
router.post('/subgrids/:subgridId/direct-messages', requireUser, loadSubgrid, requireSubgridWrite, createDirectMessage);
router.post('/subgrids/:subgridId/direct-messages/:directMessageId/flag', requireUser, loadSubgrid, requireSubgridRead, flagDirectMessage);
router.delete('/subgrids/:subgridId/direct-messages/:directMessageId', requireUser, loadSubgrid, requireSubgridRead, deleteDirectMessage);

router.get('/subgrids/:subgridId/friends', requireUser, loadSubgrid, requireSubgridRead, listFriends);
router.get('/subgrids/:subgridId/friends/:peerId/mutual', requireUser, loadSubgrid, requireSubgridRead, listMutualFriends);
router.get('/subgrids/:subgridId/blocks', requireUser, loadSubgrid, requireSubgridRead, listBlockedFriends);
router.get('/subgrids/:subgridId/friend-requests', requireUser, loadSubgrid, requireSubgridRead, listFriendRequests);
router.post('/subgrids/:subgridId/friend-requests', requireUser, loadSubgrid, requireSubgridRead, createFriendRequest);
router.post('/subgrids/:subgridId/friend-requests/:requestId/accept', requireUser, loadSubgrid, requireSubgridRead, acceptFriendRequest);
router.post('/subgrids/:subgridId/friend-requests/:requestId/decline', requireUser, loadSubgrid, requireSubgridRead, declineFriendRequest);
router.delete('/subgrids/:subgridId/friends/:friendId', requireUser, loadSubgrid, requireSubgridRead, removeFriend);
router.post('/subgrids/:subgridId/friends/:friendId/block', requireUser, loadSubgrid, requireSubgridRead, blockFriend);
router.delete('/subgrids/:subgridId/friends/:friendId/block', requireUser, loadSubgrid, requireSubgridRead, unblockFriend);

router.get('/subgrids/:subgridId/moderation', requireUser, loadSubgrid, requireSubgridModeration, listModerationQueue);
router.post('/subgrids/:subgridId/moderation/:flagId/action', requireUser, loadSubgrid, requireSubgridModeration, moderateFlag);
router.get('/subgrids/:subgridId/audit-log', requireUser, loadSubgrid, requireSubgridModeration, listAuditLog);
router.get('/subgrids/:subgridId/analytics', requireUser, loadSubgrid, requireSubgridAdmin, getSubgridAnalytics);

// Content Moderation Settings (Prohibited Words)
router.get('/subgrids/:subgridId/content-moderation', requireUser, loadSubgrid, requireSubgridAdmin, getContentModerationSettings);
router.patch('/subgrids/:subgridId/content-moderation', requireUser, loadSubgrid, requireSubgridAdmin, updateContentModerationSettings);
router.post('/subgrids/:subgridId/content-moderation/words', requireUser, loadSubgrid, requireSubgridAdmin, addProhibitedWords);
router.delete('/subgrids/:subgridId/content-moderation/words', requireUser, loadSubgrid, requireSubgridAdmin, removeProhibitedWords);
router.post('/subgrids/:subgridId/content-moderation/test', requireUser, loadSubgrid, requireSubgridAdmin, testContentFilter);

// Custom Roles (CU Admin feature)
router.get('/subgrids/:subgridId/roles', requireUser, loadSubgrid, requireSubgridRead, getRoles);
router.post('/subgrids/:subgridId/roles', requireUser, loadSubgrid, requireSubgridAdmin, createRole);
router.patch('/subgrids/:subgridId/roles/:roleId', requireUser, loadSubgrid, requireSubgridAdmin, updateRole);
router.delete('/subgrids/:subgridId/roles/:roleId', requireUser, loadSubgrid, requireSubgridAdmin, deleteRole);
router.get('/subgrids/:subgridId/roles/:roleId/members', requireUser, loadSubgrid, requireSubgridRead, getRoleMembers);
router.post('/subgrids/:subgridId/members/:memberId/role', requireUser, loadSubgrid, requireSubgridAdmin, assignRole);
router.delete('/subgrids/:subgridId/members/:memberId/role', requireUser, loadSubgrid, requireSubgridAdmin, removeRole);

router.get('/subgrids/:subgridId/notifications', requireUser, loadSubgrid, requireSubgridRead, listNotifications);
router.post('/subgrids/:subgridId/notifications/:notificationId/read', requireUser, loadSubgrid, requireSubgridRead, markNotificationRead);

// Presence / Online Status
router.post('/subgrids/:subgridId/presence', requireUser, loadSubgrid, requireSubgridRead, updatePresence);
router.get('/subgrids/:subgridId/presence', loadSubgrid, requireSubgridRead, getPresence);
router.get('/subgrids/:subgridId/presence/:userId', loadSubgrid, requireSubgridRead, getUserPresence);
router.delete('/subgrids/:subgridId/presence', requireUser, loadSubgrid, requireSubgridRead, setOffline);

module.exports = router;
