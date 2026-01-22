/**
 * One-time script to cleanup orphaned subscriptions
 * (subscriptions where the tenant no longer exists)
 * Run with: node scripts/cleanup-orphan-subscriptions.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Subscription = require('../src/models/Subscription');
const Tenant = require('../src/models/Tenant');

async function cleanupOrphanSubscriptions() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');

        // Get all subscriptions
        const allSubscriptions = await Subscription.find({});
        console.log(`Found ${allSubscriptions.length} total subscriptions`);

        // Get all valid tenant IDs
        const allTenants = await Tenant.find({}, '_id');
        const validTenantIds = new Set(allTenants.map(t => t._id.toString()));
        console.log(`Found ${validTenantIds.size} valid tenants`);

        // Find orphaned subscriptions (subscriptions with no matching tenant)
        const orphanedSubscriptions = allSubscriptions.filter(
            sub => !validTenantIds.has(sub.tenantId.toString())
        );
        console.log(`Found ${orphanedSubscriptions.length} orphaned subscriptions`);

        if (orphanedSubscriptions.length > 0) {
            // Delete orphaned subscriptions
            const orphanedIds = orphanedSubscriptions.map(s => s._id);
            const result = await Subscription.deleteMany({ _id: { $in: orphanedIds } });
            console.log(`Deleted ${result.deletedCount} orphaned subscriptions`);
        }

        // Show remaining count
        const remainingCount = await Subscription.countDocuments({ status: 'active' });
        console.log(`Active subscriptions remaining: ${remainingCount}`);

        console.log('Done!');
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

cleanupOrphanSubscriptions();
