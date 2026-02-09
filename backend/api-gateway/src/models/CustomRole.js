const mongoose = require('mongoose');

/**
 * CustomRole Schema
 * Allows CU Admins to create custom roles for their community members
 * These roles display as labels next to member names (like vendor badges)
 */
const customRoleSchema = new mongoose.Schema({
    subgridId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Subgrid',
        required: true,
        index: true,
    },
    name: {
        type: String,
        required: true,
        trim: true,
        maxlength: 30,
    },
    color: {
        type: String,
        default: '#3B82F6', // Default blue color
        trim: true,
    },
    // Optional icon name (for future use)
    icon: {
        type: String,
        default: '',
        trim: true,
    },
    // Display order (lower = higher priority)
    displayOrder: {
        type: Number,
        default: 0,
    },
    // Whether this role is visible to all members or just admins
    isVisible: {
        type: Boolean,
        default: true,
    },
    // Whether members with this role can be messaged by other members
    canBeMessaged: {
        type: Boolean,
        default: true,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
    updatedAt: {
        type: Date,
        default: Date.now,
    },
});

// Compound index for unique role names within a subgrid
customRoleSchema.index({ subgridId: 1, name: 1 }, { unique: true });

// Update the updatedAt timestamp on save
customRoleSchema.pre('save', function () {
    this.updatedAt = new Date();
});

module.exports = mongoose.model('CustomRole', customRoleSchema);
