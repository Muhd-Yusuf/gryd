const mongoose = require('mongoose');

const subgridSchema = new mongoose.Schema({
    tenantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        required: true,
        index: true,
    },
    name: {
        type: String,
        required: true,
        trim: true,
    },
    slug: {
        type: String,
        required: true,
        trim: true,
        lowercase: true,
    },
    description: {
        type: String,
        default: '',
        trim: true,
    },
    clientName: {
        type: String,
        default: '',
        trim: true,
    },
    logoUrl: {
        type: String,
        default: '',
        trim: true,
    },
    coverImageUrl: {
        type: String,
        default: '',
        trim: true,
    },
    visibility: {
        type: String,
        enum: ['private', 'public'],
        default: 'private',
    },
    status: {
        type: String,
        enum: ['active', 'suspended', 'archived'],
        default: 'active',
    },
    settings: {
        postsEnabled: {
            type: Boolean,
            default: true,
        },
        commentsEnabled: {
            type: Boolean,
            default: true,
        },
        directMessagesEnabled: {
            type: Boolean,
            default: true,
        },
    },
    joinSettings: {
        method: {
            type: String,
            enum: ['invite_only', 'invite_link', 'auto_join'],
            default: 'invite_only',
        },
        autoJoinEnabled: {
            type: Boolean,
            default: false,
        },
    },
    moderationRules: {
        type: [String],
        default: [],
    },
    embedSettings: {
        enabled: {
            type: Boolean,
            default: true,
        },
        allowedOrigins: {
            type: [String],
            default: [],
        },
        mode: {
            type: String,
            enum: ['full', 'channel'],
            default: 'full',
        },
        defaultChannelId: {
            type: String,
            default: '',
        },
    },
    // Invite code for members to join this CU community
    inviteCode: {
        type: String,
        unique: true,
        sparse: true,
        uppercase: true,
        trim: true,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

// Generate a random invite code
subgridSchema.statics.generateInviteCode = function () {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude confusing chars like 0, O, I, 1
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
};

// Pre-save hook to generate invite code if not set
subgridSchema.pre('save', async function (next) {
    if (!this.inviteCode) {
        const Subgrid = this.constructor;
        let code;
        let exists = true;
        // Keep generating until we find a unique code
        while (exists) {
            code = Subgrid.generateInviteCode();
            const existing = await Subgrid.findOne({ inviteCode: code });
            exists = !!existing;
        }
        this.inviteCode = code;
    }
    next();
});

subgridSchema.index({ tenantId: 1, slug: 1 }, { unique: true });
// Note: inviteCode index is already defined in schema with unique: true, sparse: true

module.exports = mongoose.model('Subgrid', subgridSchema);
