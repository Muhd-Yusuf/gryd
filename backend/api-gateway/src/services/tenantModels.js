const { Schema } = require('mongoose');

const defineModels = (connection) => {
    const Channel = connection.models.Channel || connection.model('Channel', new Schema({
        subgridId: {
            type: String,
            required: true,
            index: true,
        },
        name: {
            type: String,
            required: true,
            trim: true,
        },
        type: {
            type: String,
            enum: ['text', 'announcement', 'voice'],
            default: 'text',
        },
        visibility: {
            type: String,
            enum: ['public', 'admin'],
            default: 'public',
        },
        status: {
            type: String,
            enum: ['active', 'archived'],
            default: 'active',
        },
        createdAt: {
            type: Date,
            default: Date.now,
        },
    }));

    const Message = connection.models.Message || connection.model('Message', new Schema({
        subgridId: {
            type: String,
            required: true,
            index: true,
        },
        channelId: {
            type: String,
            required: true,
        },
        authorId: {
            type: String,
            required: true,
        },
        body: {
            type: String,
            default: '',
        },
        kind: {
            type: String,
            enum: ['text', 'emoji', 'sticker', 'audio', 'reshare'],
            default: 'text',
        },
        attachments: {
            type: [Schema.Types.Mixed],
            default: [],
        },
        // Like/Reshare/Comment counts for social interactions
        likeCount: {
            type: Number,
            default: 0,
        },
        reshareCount: {
            type: Number,
            default: 0,
        },
        commentCount: {
            type: Number,
            default: 0,
        },
        status: {
            type: String,
            enum: ['active', 'removed'],
            default: 'active',
        },
        flagged: {
            type: Boolean,
            default: false,
        },
        createdAt: {
            type: Date,
            default: Date.now,
        },
    }));

    const Post = connection.models.Post || connection.model('Post', new Schema({
        subgridId: {
            type: String,
            required: true,
            index: true,
        },
        channelId: {
            type: String,
            required: true,
        },
        authorId: {
            type: String,
            required: true,
        },
        title: {
            type: String,
            default: '',
            trim: true,
        },
        body: {
            type: String,
            required: true,
        },
        attachments: {
            type: [String],
            default: [],
        },
        likeCount: {
            type: Number,
            default: 0,
        },
        reshareCount: {
            type: Number,
            default: 0,
        },
        commentCount: {
            type: Number,
            default: 0,
        },
        status: {
            type: String,
            enum: ['active', 'removed'],
            default: 'active',
        },
        flagged: {
            type: Boolean,
            default: false,
        },
        createdAt: {
            type: Date,
            default: Date.now,
        },
    }));

    const Comment = connection.models.Comment || connection.model('Comment', new Schema({
        subgridId: {
            type: String,
            required: true,
            index: true,
        },
        postId: {
            type: String,
            required: true,
        },
        authorId: {
            type: String,
            required: true,
        },
        body: {
            type: String,
            required: true,
        },
        status: {
            type: String,
            enum: ['active', 'removed'],
            default: 'active',
        },
        flagged: {
            type: Boolean,
            default: false,
        },
        createdAt: {
            type: Date,
            default: Date.now,
        },
    }));

    const reactionSchema = new Schema({
        subgridId: {
            type: String,
            required: true,
            index: true,
        },
        targetType: {
            type: String,
            enum: ['post', 'comment', 'message'],
            required: true,
        },
        targetId: {
            type: String,
            required: true,
        },
        userId: {
            type: String,
            required: true,
        },
        emoji: {
            type: String,
            required: true,
        },
        createdAt: {
            type: Date,
            default: Date.now,
        },
    });
    reactionSchema.index({ subgridId: 1, targetType: 1, targetId: 1, userId: 1, emoji: 1 }, { unique: true });
    const Reaction = connection.models.Reaction || connection.model('Reaction', reactionSchema);

    // Like model for post likes (separate from emoji reactions for better performance)
    const likeSchema = new Schema({
        subgridId: {
            type: String,
            required: true,
            index: true,
        },
        postId: {
            type: String,
            required: true,
            index: true,
        },
        userId: {
            type: String,
            required: true,
        },
        createdAt: {
            type: Date,
            default: Date.now,
        },
    });
    likeSchema.index({ subgridId: 1, postId: 1, userId: 1 }, { unique: true });
    const Like = connection.models.Like || connection.model('Like', likeSchema);

    // Reshare model for post reshares
    const reshareSchema = new Schema({
        subgridId: {
            type: String,
            required: true,
            index: true,
        },
        postId: {
            type: String,
            required: true,
            index: true,
        },
        userId: {
            type: String,
            required: true,
        },
        comment: {
            type: String,
            default: '',
        },
        createdAt: {
            type: Date,
            default: Date.now,
        },
    });
    reshareSchema.index({ subgridId: 1, postId: 1, userId: 1 }, { unique: true });
    const Reshare = connection.models.Reshare || connection.model('Reshare', reshareSchema);

    // MessageLike model for message likes
    const messageLikeSchema = new Schema({
        subgridId: {
            type: String,
            required: true,
            index: true,
        },
        messageId: {
            type: String,
            required: true,
            index: true,
        },
        userId: {
            type: String,
            required: true,
        },
        createdAt: {
            type: Date,
            default: Date.now,
        },
    });
    messageLikeSchema.index({ subgridId: 1, messageId: 1, userId: 1 }, { unique: true });
    const MessageLike = connection.models.MessageLike || connection.model('MessageLike', messageLikeSchema);

    // MessageReshare model for message reshares
    const messageReshareSchema = new Schema({
        subgridId: {
            type: String,
            required: true,
            index: true,
        },
        messageId: {
            type: String,
            required: true,
            index: true,
        },
        userId: {
            type: String,
            required: true,
        },
        comment: {
            type: String,
            default: '',
        },
        createdAt: {
            type: Date,
            default: Date.now,
        },
    });
    messageReshareSchema.index({ subgridId: 1, messageId: 1, userId: 1 }, { unique: true });
    const MessageReshare = connection.models.MessageReshare || connection.model('MessageReshare', messageReshareSchema);

    // MessageComment model for message comments/replies
    const MessageComment = connection.models.MessageComment || connection.model('MessageComment', new Schema({
        subgridId: {
            type: String,
            required: true,
            index: true,
        },
        messageId: {
            type: String,
            required: true,
            index: true,
        },
        authorId: {
            type: String,
            required: true,
        },
        body: {
            type: String,
            required: true,
        },
        status: {
            type: String,
            enum: ['active', 'removed'],
            default: 'active',
        },
        flagged: {
            type: Boolean,
            default: false,
        },
        createdAt: {
            type: Date,
            default: Date.now,
        },
    }));

    const DirectMessage = connection.models.DirectMessage || connection.model('DirectMessage', new Schema({
        subgridId: {
            type: String,
            required: true,
            index: true,
        },
        senderId: {
            type: String,
            required: true,
        },
        recipientId: {
            type: String,
            required: true,
        },
        body: {
            type: String,
            default: '',
        },
        kind: {
            type: String,
            enum: ['text', 'emoji', 'sticker', 'audio'],
            default: 'text',
        },
        attachments: {
            type: [Schema.Types.Mixed],
            default: [],
        },
        status: {
            type: String,
            enum: ['active', 'removed'],
            default: 'active',
        },
        flagged: {
            type: Boolean,
            default: false,
        },
        createdAt: {
            type: Date,
            default: Date.now,
        },
    }));

    const ModerationFlag = connection.models.ModerationFlag || connection.model('ModerationFlag', new Schema({
        subgridId: {
            type: String,
            required: true,
            index: true,
        },
        contentType: {
            type: String,
            enum: ['message', 'post', 'comment', 'direct_message'],
            required: true,
        },
        contentId: {
            type: String,
            required: true,
        },
        flaggedBy: {
            type: String,
            required: true,
        },
        reason: {
            type: String,
            default: '',
        },
        status: {
            type: String,
            enum: ['open', 'reviewed'],
            default: 'open',
        },
        resolvedBy: {
            type: String,
            default: '',
        },
        resolvedAt: {
            type: Date,
            default: null,
        },
        contentSnapshot: {
            type: Schema.Types.Mixed,
            default: null,
        },
        createdAt: {
            type: Date,
            default: Date.now,
        },
    }));

    const AuditLog = connection.models.AuditLog || connection.model('AuditLog', new Schema({
        subgridId: {
            type: String,
            required: true,
            index: true,
        },
        actorId: {
            type: String,
            required: true,
        },
        action: {
            type: String,
            required: true,
        },
        targetType: {
            type: String,
            default: '',
        },
        targetId: {
            type: String,
            default: '',
        },
        detail: {
            type: Schema.Types.Mixed,
            default: {},
        },
        createdAt: {
            type: Date,
            default: Date.now,
        },
    }));

    const Notification = connection.models.Notification || connection.model('Notification', new Schema({
        subgridId: {
            type: String,
            required: true,
            index: true,
        },
        userId: {
            type: String,
            required: true,
        },
        type: {
            type: String,
            required: true,
        },
        payload: {
            type: Schema.Types.Mixed,
            default: {},
        },
        readAt: {
            type: Date,
            default: null,
        },
        createdAt: {
            type: Date,
            default: Date.now,
        },
    }));

    // Category model for organizing channels
    const Category = connection.models.Category || connection.model('Category', new Schema({
        subgridId: {
            type: String,
            required: true,
            index: true,
        },
        name: {
            type: String,
            required: true,
            trim: true,
        },
        visibility: {
            type: String,
            enum: ['public', 'private'],
            default: 'public',
        },
        order: {
            type: Number,
            default: 0,
        },
        createdAt: {
            type: Date,
            default: Date.now,
        },
    }));

    // Event model for community events
    const Event = connection.models.Event || connection.model('Event', new Schema({
        subgridId: {
            type: String,
            required: true,
            index: true,
        },
        title: {
            type: String,
            required: true,
            trim: true,
        },
        description: {
            type: String,
            default: '',
        },
        startDate: {
            type: Date,
            required: true,
        },
        endDate: {
            type: Date,
            default: null,
        },
        location: {
            type: String,
            default: '',
        },
        createdBy: {
            type: String,
            required: true,
        },
        status: {
            type: String,
            enum: ['scheduled', 'ongoing', 'completed', 'cancelled'],
            default: 'scheduled',
        },
        createdAt: {
            type: Date,
            default: Date.now,
        },
    }));

    return {
        Channel,
        Message,
        Post,
        Comment,
        Reaction,
        Like,
        Reshare,
        MessageLike,
        MessageReshare,
        MessageComment,
        DirectMessage,
        ModerationFlag,
        AuditLog,
        Notification,
        Category,
        Event,
    };
};

module.exports = {
    defineModels,
};
