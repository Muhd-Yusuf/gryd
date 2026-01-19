const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
    tenantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        required: true,
        index: true,
    },
    leadId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Lead',
        default: null,
    },
    title: {
        type: String,
        required: true,
        trim: true,
    },
    type: {
        type: String,
        default: 'to-do',
    },
    priority: {
        type: String,
        enum: ['low', 'normal', 'urgent'],
        default: 'normal',
    },
    status: {
        type: String,
        enum: ['todo', 'in_progress', 'review', 'completed'],
        default: 'todo',
    },
    dueDate: {
        type: Date,
        default: null,
    },
    reminderAt: {
        type: Date,
        default: null,
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null,
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

taskSchema.pre('save', function updateTimestamp() {
    this.updatedAt = new Date();
});

module.exports = mongoose.model('Task', taskSchema);
