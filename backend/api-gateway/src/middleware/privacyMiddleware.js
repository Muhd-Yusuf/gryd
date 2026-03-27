const PrivacySettings = require('../models/PrivacySettings');
const Friendship = require('../models/Friendship');

const DEFAULT_PRIVACY = {
    profileVisibility: 'hidden',
    allowDMsFrom: 'friends_only',
    allowFriendRequestsFrom: 'everyone',
    showOnlineStatus: true,
};

/**
 * Mask a single user profile based on the viewer's relationship to the target.
 * Admins and super_admins always see full info.
 */
function maskUserProfile(viewerUser, targetUser, privacySettings, isFriend) {
    const targetObj = targetUser.toObject ? targetUser.toObject() : { ...targetUser };
    const viewerId = String(viewerUser._id || viewerUser.id);
    const targetId = String(targetObj._id);

    // Self always sees full info
    if (viewerId === targetId) {
        return targetObj;
    }

    // Admins always see full info
    if (viewerUser.role === 'admin' || viewerUser.role === 'super_admin') {
        return targetObj;
    }

    const visibility = privacySettings?.profileVisibility || DEFAULT_PRIVACY.profileVisibility;

    if (visibility === 'public') {
        return targetObj;
    }

    // Both 'hidden' and 'friends_only' allow friends to see full info
    // (accepting a friend request = opting in to share your identity)
    if ((visibility === 'hidden' || visibility === 'friends_only') && isFriend) {
        return targetObj;
    }

    // Return masked profile
    const roleLabel = targetObj.stakeholderBadge
        ? targetObj.stakeholderBadge.charAt(0).toUpperCase() + targetObj.stakeholderBadge.slice(1)
        : 'Member';

    return {
        _id: targetObj._id,
        firstName: 'Gryd',
        lastName: roleLabel,
        username: null,
        email: null,
        avatarUrl: null,
        bannerUrl: null,
        company: null,
        role: targetObj.role,
        stakeholderBadge: targetObj.stakeholderBadge,
        isPrivate: true,
    };
}

/**
 * Batch mask an array of users for a given viewer within a subgrid.
 * Efficiently fetches privacy settings and friendships in two queries.
 *
 * @param {string} viewerUserId - The ID of the user viewing
 * @param {Object} viewerUser - The viewer user object (needs role)
 * @param {Array} users - Array of user objects to mask
 * @param {string} subgridId - The subgrid context
 * @returns {Array} Array of masked/unmasked user objects
 */
async function maskUsersForViewer(viewerUserId, viewerUser, users, subgridId) {
    if (!users || users.length === 0) return [];

    const viewerId = String(viewerUserId);

    // Admins see everything
    if (viewerUser.role === 'admin' || viewerUser.role === 'super_admin') {
        return users.map(u => u.toObject ? u.toObject() : { ...u });
    }

    const userIds = users.map(u => u._id || u.id).filter(Boolean);

    // Fetch privacy settings and friendships in parallel
    const [privacyDocs, friendships] = await Promise.all([
        PrivacySettings.find({ userId: { $in: userIds } }).lean(),
        subgridId
            ? Friendship.find({ subgridId, userId: viewerId, friendId: { $in: userIds } }).lean()
            : Promise.resolve([]),
    ]);

    // Build lookup maps
    const privacyMap = {};
    for (const doc of privacyDocs) {
        privacyMap[String(doc.userId)] = doc;
    }

    const friendSet = new Set();
    for (const f of friendships) {
        friendSet.add(String(f.friendId));
    }

    return users.map(user => {
        const userId = String(user._id || user.id);
        const privacy = privacyMap[userId] || null;
        const isFriend = friendSet.has(userId);
        return maskUserProfile(viewerUser, user, privacy, isFriend);
    });
}

/**
 * Check if a user can send a DM to a target user.
 * Returns { allowed: boolean, reason: string }
 */
async function canSendDM(senderId, recipientId, subgridId) {
    const privacy = await PrivacySettings.findOne({ userId: recipientId }).lean();
    const allowDMs = privacy?.allowDMsFrom || DEFAULT_PRIVACY.allowDMsFrom;

    if (allowDMs === 'everyone') {
        return { allowed: true };
    }

    if (allowDMs === 'nobody') {
        return { allowed: false, reason: 'This user does not accept direct messages' };
    }

    // friends_only — check friendship
    const friendship = await Friendship.findOne({
        subgridId,
        userId: String(recipientId),
        friendId: String(senderId),
    }).lean();

    if (friendship) {
        return { allowed: true };
    }

    return { allowed: false, reason: 'You must be friends with this user to send a direct message' };
}

/**
 * Check if a user can send a friend request to a target user.
 * Returns { allowed: boolean, reason: string }
 */
async function canSendFriendRequest(senderUser, recipientId) {
    const privacy = await PrivacySettings.findOne({ userId: recipientId }).lean();
    const allowRequests = privacy?.allowFriendRequestsFrom || DEFAULT_PRIVACY.allowFriendRequestsFrom;

    if (allowRequests === 'everyone') {
        return { allowed: true };
    }

    if (allowRequests === 'nobody') {
        return { allowed: false, reason: 'This user does not accept friend requests' };
    }

    // members_only — only regular members, not stakeholders
    if (allowRequests === 'members_only' && senderUser.role === 'stakeholder') {
        return { allowed: false, reason: 'This user only accepts friend requests from members' };
    }

    return { allowed: true };
}

module.exports = {
    maskUserProfile,
    maskUsersForViewer,
    canSendDM,
    canSendFriendRequest,
    DEFAULT_PRIVACY,
};
