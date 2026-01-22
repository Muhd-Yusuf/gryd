/**
 * One-time script to update all existing subscriptions to Premium
 * Run with: node scripts/update-subscriptions.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Subscription = require('../src/models/Subscription');

async function updateSubscriptions() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');

        // Update all Trial subscriptions to Premium
        const result = await Subscription.updateMany(
            { planName: { $in: ['Trial', 'Starter', null, ''] } },
            { $set: { planName: 'Premium', status: 'active' } }
        );

        console.log(`Updated ${result.modifiedCount} subscriptions to Premium`);

        // Also check for any missing subscriptions
        const Tenant = require('../src/models/Tenant');
        const tenants = await Tenant.find({});

        for (const tenant of tenants) {
            const existingSub = await Subscription.findOne({ tenantId: tenant._id });
            if (!existingSub) {
                await Subscription.create({
                    tenantId: tenant._id,
                    planName: 'Premium',
                    status: 'active',
                });
                console.log(`Created Premium subscription for tenant: ${tenant.name}`);
            }
        }

        console.log('Done!');
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

updateSubscriptions();
