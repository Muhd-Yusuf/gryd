/**
 * File Metadata Model
 * Tracks all uploaded files for cleanup and management
 */

const mongoose = require('mongoose');

const fileMetadataSchema = new mongoose.Schema({
    // File identification
    url: {
        type: String,
        required: true,
        index: true,
    },
    publicId: {
        type: String,
        index: true,
    },
    key: {
        type: String,
        index: true,
    },
    provider: {
        type: String,
        enum: ['cloudinary', 's3'],
        required: true,
    },

    // File details
    filename: {
        type: String,
        required: true,
    },
    mimeType: {
        type: String,
        required: true,
    },
    size: {
        type: Number,
        default: 0,
    },
    resourceType: {
        type: String,
        enum: ['image', 'video', 'audio', 'raw', 'auto'],
        default: 'auto',
    },
    format: {
        type: String,
    },
    width: {
        type: Number,
    },
    height: {
        type: Number,
    },
    duration: {
        type: Number, // For audio/video in seconds
    },

    // Categorization
    type: {
        type: String,
        enum: ['avatar', 'attachment', 'voice-note', 'image', 'document', 'video', 'file', 'chat'],
        default: 'attachment',
        index: true,
    },

    // Ownership
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    tenantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        index: true,
    },
    subgridId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Subgrid',
        index: true,
    },

    // Usage tracking - references to where this file is used
    references: [{
        model: {
            type: String, // 'User', 'Message', etc.
            required: true,
        },
        documentId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
        },
        field: {
            type: String, // 'avatarUrl', 'attachments', 'images', etc.
            required: true,
        },
    }],

    // Status
    status: {
        type: String,
        enum: ['active', 'orphaned', 'pending_deletion', 'deleted'],
        default: 'active',
        index: true,
    },
    orphanedAt: {
        type: Date,
    },
    deletedAt: {
        type: Date,
    },

    // Timestamps
    createdAt: {
        type: Date,
        default: Date.now,
        index: true,
    },
    updatedAt: {
        type: Date,
        default: Date.now,
    },
});

// Compound indexes for common queries
fileMetadataSchema.index({ userId: 1, type: 1 });
fileMetadataSchema.index({ subgridId: 1, type: 1 });
fileMetadataSchema.index({ status: 1, orphanedAt: 1 });
fileMetadataSchema.index({ provider: 1, status: 1 });

// Update timestamp on save
fileMetadataSchema.pre('save', function() {
    this.updatedAt = new Date();
});

// Static methods

/**
 * Create file metadata record
 */
fileMetadataSchema.statics.createFromUpload = async function(uploadResult, options) {
    const metadata = new this({
        url: uploadResult.url,
        publicId: uploadResult.publicId,
        key: uploadResult.key,
        provider: uploadResult.provider,
        filename: options.filename,
        mimeType: options.mimeType,
        size: uploadResult.size || 0,
        resourceType: uploadResult.resourceType,
        format: uploadResult.format,
        width: uploadResult.width,
        height: uploadResult.height,
        duration: uploadResult.duration,
        type: options.type || 'attachment',
        userId: options.userId,
        tenantId: options.tenantId,
        subgridId: options.subgridId,
    });

    return metadata.save();
};

/**
 * Add a reference to where this file is used
 */
fileMetadataSchema.methods.addReference = async function(model, documentId, field) {
    const exists = this.references.some(
        ref => ref.model === model &&
               ref.documentId.toString() === documentId.toString() &&
               ref.field === field
    );

    if (!exists) {
        this.references.push({ model, documentId, field });
        this.status = 'active';
        this.orphanedAt = null;
        await this.save();
    }

    return this;
};

/**
 * Remove a reference
 */
fileMetadataSchema.methods.removeReference = async function(model, documentId, field) {
    this.references = this.references.filter(
        ref => !(ref.model === model &&
                 ref.documentId.toString() === documentId.toString() &&
                 ref.field === field)
    );

    // Mark as orphaned if no more references
    if (this.references.length === 0) {
        this.status = 'orphaned';
        this.orphanedAt = new Date();
    }

    await this.save();
    return this;
};

/**
 * Find orphaned files older than specified days
 */
fileMetadataSchema.statics.findOrphanedFiles = async function(daysOld = 7) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    return this.find({
        status: 'orphaned',
        orphanedAt: { $lt: cutoffDate },
    });
};

/**
 * Find files by URL
 */
fileMetadataSchema.statics.findByUrl = async function(url) {
    return this.findOne({ url });
};

/**
 * Get user's upload statistics
 */
fileMetadataSchema.statics.getUserStats = async function(userId) {
    const stats = await this.aggregate([
        { $match: { userId: new mongoose.Types.ObjectId(userId), status: 'active' } },
        {
            $group: {
                _id: '$type',
                count: { $sum: 1 },
                totalSize: { $sum: '$size' },
            },
        },
    ]);

    return stats.reduce((acc, stat) => {
        acc[stat._id] = { count: stat.count, totalSize: stat.totalSize };
        return acc;
    }, {});
};

module.exports = mongoose.model('FileMetadata', fileMetadataSchema);
