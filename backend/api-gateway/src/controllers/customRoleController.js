/**
 * Custom Role Controller
 * Handles CRUD operations for custom roles that CU Admins can create
 * These roles display as label badges next to member names
 */

const mongoose = require('mongoose');
const CustomRole = require('../models/CustomRole');
const SubgridMembership = require('../models/SubgridMembership');
const Subgrid = require('../models/Subgrid');

/**
 * Get all custom roles for a subgrid
 * GET /api/community/subgrids/:subgridId/roles
 */
const getRoles = async (req, res) => {
    try {
        const { subgridId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(subgridId)) {
            return res.status(400).json({ success: false, error: 'Invalid subgrid ID' });
        }

        const roles = await CustomRole.find({ subgridId })
            .sort({ displayOrder: 1, name: 1 })
            .lean();

        res.json({
            success: true,
            data: roles,
        });
    } catch (error) {
        console.error('Get roles error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Create a new custom role
 * POST /api/community/subgrids/:subgridId/roles
 */
const createRole = async (req, res) => {
    try {
        const { subgridId } = req.params;
        const { name, color, icon, displayOrder, isVisible, canBeMessaged } = req.body;
        // Try both _id and id as different auth systems may use different field names
        const userId = req.user._id || req.user.id;

        console.log('[createRole] Request received:', { subgridId, name, color, userId });
        console.log('[createRole] req.user:', req.user);

        if (!mongoose.Types.ObjectId.isValid(subgridId)) {
            console.log('[createRole] Invalid subgrid ID');
            return res.status(400).json({ success: false, error: 'Invalid subgrid ID' });
        }

        if (!name || !name.trim()) {
            console.log('[createRole] Missing role name');
            return res.status(400).json({ success: false, error: 'Role name is required' });
        }

        // Verify user is admin of this subgrid
        const membership = await SubgridMembership.findOne({
            subgridId,
            userId,
            role: 'subgrid_admin',
        });

        console.log('[createRole] Membership lookup:', { userId, subgridId, found: !!membership, membership });

        if (!membership) {
            console.log('[createRole] User is not admin');
            return res.status(403).json({ success: false, error: 'Only admins can create roles' });
        }

        // Check if role with same name exists
        const existingRole = await CustomRole.findOne({
            subgridId,
            name: { $regex: new RegExp(`^${name.trim()}$`, 'i') },
        });

        if (existingRole) {
            return res.status(400).json({ success: false, error: 'A role with this name already exists' });
        }

        const role = await CustomRole.create({
            subgridId,
            name: name.trim(),
            color: color || '#3B82F6',
            icon: icon || '',
            displayOrder: displayOrder || 0,
            isVisible: isVisible !== false,
            canBeMessaged: canBeMessaged !== false,
        });

        res.status(201).json({
            success: true,
            data: role,
        });
    } catch (error) {
        console.error('Create role error:', error);
        if (error.code === 11000) {
            return res.status(400).json({ success: false, error: 'A role with this name already exists' });
        }
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Update a custom role
 * PATCH /api/community/subgrids/:subgridId/roles/:roleId
 */
const updateRole = async (req, res) => {
    try {
        const { subgridId, roleId } = req.params;
        const { name, color, icon, displayOrder, isVisible, canBeMessaged } = req.body;
        const userId = req.user._id;

        if (!mongoose.Types.ObjectId.isValid(subgridId) || !mongoose.Types.ObjectId.isValid(roleId)) {
            return res.status(400).json({ success: false, error: 'Invalid ID' });
        }

        // Verify user is admin
        const membership = await SubgridMembership.findOne({
            subgridId,
            userId,
            role: 'subgrid_admin',
        });

        if (!membership) {
            return res.status(403).json({ success: false, error: 'Only admins can update roles' });
        }

        const role = await CustomRole.findOne({ _id: roleId, subgridId });
        if (!role) {
            return res.status(404).json({ success: false, error: 'Role not found' });
        }

        // Check for duplicate name if name is being changed
        if (name && name.trim().toLowerCase() !== role.name.toLowerCase()) {
            const existingRole = await CustomRole.findOne({
                subgridId,
                _id: { $ne: roleId },
                name: { $regex: new RegExp(`^${name.trim()}$`, 'i') },
            });

            if (existingRole) {
                return res.status(400).json({ success: false, error: 'A role with this name already exists' });
            }
        }

        // Update fields
        if (name) role.name = name.trim();
        if (color) role.color = color;
        if (icon !== undefined) role.icon = icon;
        if (displayOrder !== undefined) role.displayOrder = displayOrder;
        if (isVisible !== undefined) role.isVisible = isVisible;
        if (canBeMessaged !== undefined) role.canBeMessaged = canBeMessaged;

        await role.save();

        res.json({
            success: true,
            data: role,
        });
    } catch (error) {
        console.error('Update role error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Delete a custom role
 * DELETE /api/community/subgrids/:subgridId/roles/:roleId
 */
const deleteRole = async (req, res) => {
    try {
        const { subgridId, roleId } = req.params;
        const userId = req.user._id;

        if (!mongoose.Types.ObjectId.isValid(subgridId) || !mongoose.Types.ObjectId.isValid(roleId)) {
            return res.status(400).json({ success: false, error: 'Invalid ID' });
        }

        // Verify user is admin
        const membership = await SubgridMembership.findOne({
            subgridId,
            userId,
            role: 'subgrid_admin',
        });

        if (!membership) {
            return res.status(403).json({ success: false, error: 'Only admins can delete roles' });
        }

        const role = await CustomRole.findOne({ _id: roleId, subgridId });
        if (!role) {
            return res.status(404).json({ success: false, error: 'Role not found' });
        }

        // Remove this role from all members who have it
        await SubgridMembership.updateMany(
            { subgridId, customRoleId: roleId },
            { $set: { customRoleId: null } }
        );

        await role.deleteOne();

        res.json({
            success: true,
            message: 'Role deleted successfully',
        });
    } catch (error) {
        console.error('Delete role error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Assign a custom role to a member
 * POST /api/community/subgrids/:subgridId/members/:memberId/role
 */
const assignRole = async (req, res) => {
    try {
        const { subgridId, memberId } = req.params;
        const { roleId } = req.body;
        const userId = req.user._id;

        if (!mongoose.Types.ObjectId.isValid(subgridId) || !mongoose.Types.ObjectId.isValid(memberId)) {
            return res.status(400).json({ success: false, error: 'Invalid ID' });
        }

        // Verify user is admin
        const adminMembership = await SubgridMembership.findOne({
            subgridId,
            userId,
            role: 'subgrid_admin',
        });

        if (!adminMembership) {
            return res.status(403).json({ success: false, error: 'Only admins can assign roles' });
        }

        // Find the member
        const memberMembership = await SubgridMembership.findOne({
            subgridId,
            userId: memberId,
        });

        if (!memberMembership) {
            return res.status(404).json({ success: false, error: 'Member not found' });
        }

        // Validate roleId if provided
        if (roleId) {
            if (!mongoose.Types.ObjectId.isValid(roleId)) {
                return res.status(400).json({ success: false, error: 'Invalid role ID' });
            }

            const role = await CustomRole.findOne({ _id: roleId, subgridId });
            if (!role) {
                return res.status(404).json({ success: false, error: 'Role not found' });
            }
        }

        // Update the member's custom role (null to remove)
        memberMembership.customRoleId = roleId || null;
        await memberMembership.save();

        // Populate and return the updated membership
        const updated = await SubgridMembership.findById(memberMembership._id)
            .populate('customRoleId')
            .lean();

        res.json({
            success: true,
            data: updated,
        });
    } catch (error) {
        console.error('Assign role error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Remove custom role from a member
 * DELETE /api/community/subgrids/:subgridId/members/:memberId/role
 */
const removeRole = async (req, res) => {
    try {
        const { subgridId, memberId } = req.params;
        const userId = req.user._id;

        if (!mongoose.Types.ObjectId.isValid(subgridId) || !mongoose.Types.ObjectId.isValid(memberId)) {
            return res.status(400).json({ success: false, error: 'Invalid ID' });
        }

        // Verify user is admin
        const adminMembership = await SubgridMembership.findOne({
            subgridId,
            userId,
            role: 'subgrid_admin',
        });

        if (!adminMembership) {
            return res.status(403).json({ success: false, error: 'Only admins can remove roles' });
        }

        // Find and update the member
        const memberMembership = await SubgridMembership.findOneAndUpdate(
            { subgridId, userId: memberId },
            { $set: { customRoleId: null } },
            { new: true }
        );

        if (!memberMembership) {
            return res.status(404).json({ success: false, error: 'Member not found' });
        }

        res.json({
            success: true,
            data: memberMembership,
        });
    } catch (error) {
        console.error('Remove role error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Get members with a specific role
 * GET /api/community/subgrids/:subgridId/roles/:roleId/members
 */
const getRoleMembers = async (req, res) => {
    try {
        const { subgridId, roleId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(subgridId) || !mongoose.Types.ObjectId.isValid(roleId)) {
            return res.status(400).json({ success: false, error: 'Invalid ID' });
        }

        const members = await SubgridMembership.find({
            subgridId,
            customRoleId: roleId,
        })
            .populate('userId', 'firstName lastName email avatarUrl username')
            .populate('customRoleId')
            .lean();

        res.json({
            success: true,
            data: members,
        });
    } catch (error) {
        console.error('Get role members error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

module.exports = {
    getRoles,
    createRole,
    updateRole,
    deleteRole,
    assignRole,
    removeRole,
    getRoleMembers,
};
