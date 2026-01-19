const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const EMBED_SECRET = process.env.EMBED_JWT_SECRET || 'embed-secret-placeholder';

const generateInviteToken = () => crypto.randomBytes(24).toString('hex');

const hashInviteToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

const signEmbedToken = ({ tenantId, subgridId, userId, role, scopes, channelId, embedMode }) => {
    return jwt.sign(
        {
            tenantId,
            subgridId,
            userId,
            role,
            scopes,
            channelId: channelId || '',
            embedMode: embedMode || '',
        },
        EMBED_SECRET,
        { expiresIn: '15m' }
    );
};

const verifyEmbedToken = (token) => {
    return jwt.verify(token, EMBED_SECRET);
};

module.exports = {
    generateInviteToken,
    hashInviteToken,
    signEmbedToken,
    verifyEmbedToken,
};
