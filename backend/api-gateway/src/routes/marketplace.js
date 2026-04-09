const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const MarketplaceListing = require('../models/MarketplaceListing');
const MarketplaceOrder = require('../models/MarketplaceOrder');

// Helper to generate a random redemption code
function generateRedemptionCode() {
    return Math.random().toString(36).substring(2, 10).toUpperCase();
}

// Roles that can manage listings (stakeholder = vendor/partner role in this system)
const isPartnerRole = (role) => ['stakeholder', 'partner', 'admin', 'super_admin'].includes(role);

// GET / — list active listings (filter by cuId query param)
router.get('/', async (req, res) => {
    try {
        const { cuId } = req.query;
        const filter = { isActive: true };
        if (cuId && mongoose.Types.ObjectId.isValid(cuId)) {
            filter.cuIds = new mongoose.Types.ObjectId(cuId);
        }
        const listings = await MarketplaceListing.find(filter).lean();
        return res.json({ success: true, data: listings });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
});

// POST / — create listing (partner only)
router.post('/', async (req, res) => {
    try {
        const userId = req.headers['x-user-id'];
        const userRole = req.headers['x-user-role'];
        if (!userId) {
            return res.status(401).json({ success: false, error: 'Authentication required' });
        }
        if (!isPartnerRole(userRole)) {
            return res.status(403).json({ success: false, error: 'Partner access required' });
        }
        const listing = new MarketplaceListing({
            ...req.body,
            partnerId: userId,
        });
        await listing.save();
        return res.status(201).json({ success: true, data: listing });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
});

// PUT /:id — update listing (partner only, must own it)
router.put('/:id', async (req, res) => {
    try {
        const userId = req.headers['x-user-id'];
        const userRole = req.headers['x-user-role'];
        if (!userId) {
            return res.status(401).json({ success: false, error: 'Authentication required' });
        }
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ success: false, error: 'Invalid listing id' });
        }
        const listing = await MarketplaceListing.findById(req.params.id);
        if (!listing) {
            return res.status(404).json({ success: false, error: 'Listing not found' });
        }
        if (
            !['admin', 'super_admin'].includes(userRole) &&
            String(listing.partnerId) !== String(userId)
        ) {
            return res.status(403).json({ success: false, error: 'Not authorized to update this listing' });
        }
        const allowedFields = [
            'cuIds', 'title', 'description', 'category', 'discountPercent',
            'originalPrice', 'discountedPrice', 'images', 'redemptionType',
            'redemptionValue', 'isActive', 'expiresAt',
        ];
        allowedFields.forEach((field) => {
            if (req.body[field] !== undefined) {
                listing[field] = req.body[field];
            }
        });
        await listing.save();
        return res.json({ success: true, data: listing });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
});

// DELETE /:id — deactivate listing (partner only)
router.delete('/:id', async (req, res) => {
    try {
        const userId = req.headers['x-user-id'];
        const userRole = req.headers['x-user-role'];
        if (!userId) {
            return res.status(401).json({ success: false, error: 'Authentication required' });
        }
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ success: false, error: 'Invalid listing id' });
        }
        const listing = await MarketplaceListing.findById(req.params.id);
        if (!listing) {
            return res.status(404).json({ success: false, error: 'Listing not found' });
        }
        if (
            !['admin', 'super_admin'].includes(userRole) &&
            String(listing.partnerId) !== String(userId)
        ) {
            return res.status(403).json({ success: false, error: 'Not authorized to deactivate this listing' });
        }
        listing.isActive = false;
        await listing.save();
        return res.json({ success: true, data: { message: 'Listing deactivated' } });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
});

// POST /:id/redeem — member redeems a listing (creates MarketplaceOrder)
router.post('/:id/redeem', async (req, res) => {
    try {
        const userId = req.headers['x-user-id'];
        if (!userId) {
            return res.status(401).json({ success: false, error: 'Authentication required' });
        }
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ success: false, error: 'Invalid listing id' });
        }
        const listing = await MarketplaceListing.findById(req.params.id).lean();
        if (!listing || !listing.isActive) {
            return res.status(404).json({ success: false, error: 'Listing not found or inactive' });
        }
        if (listing.expiresAt && new Date(listing.expiresAt) < new Date()) {
            return res.status(400).json({ success: false, error: 'Listing has expired' });
        }
        const { cuId } = req.body;
        const order = new MarketplaceOrder({
            memberId: userId,
            listingId: listing._id,
            cuId: cuId || (listing.cuIds && listing.cuIds[0]) || null,
            status: 'pending',
            redemptionCode: generateRedemptionCode(),
        });
        await order.save();
        return res.status(201).json({ success: true, data: order });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
});

// GET /orders/my — member's own orders
router.get('/orders/my', async (req, res) => {
    try {
        const userId = req.headers['x-user-id'];
        if (!userId) {
            return res.status(401).json({ success: false, error: 'Authentication required' });
        }
        const orders = await MarketplaceOrder.find({ memberId: userId })
            .populate('listingId')
            .lean();
        return res.json({ success: true, data: orders });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
});

// GET /partner/listings — partner's own listings
router.get('/partner/listings', async (req, res) => {
    try {
        const userId = req.headers['x-user-id'];
        const userRole = req.headers['x-user-role'];
        if (!userId) {
            return res.status(401).json({ success: false, error: 'Authentication required' });
        }
        if (!isPartnerRole(userRole)) {
            return res.status(403).json({ success: false, error: 'Partner access required' });
        }
        const listings = await MarketplaceListing.find({ partnerId: userId }).lean();
        return res.json({ success: true, data: listings });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
