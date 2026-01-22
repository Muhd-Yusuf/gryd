/**
 * Quick script to check database counts
 * Run with: node scripts/check-data.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Subscription = require('../src/models/Subscription');
const Tenant = require('../src/models/Tenant');
const Subgrid = require('../src/models/Subgrid');

async function checkData() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB\n');

        const tenants = await Tenant.find({}).lean();
        const subgrids = await Subgrid.find({}).lean();
        const subscriptions = await Subscription.find({}).lean();

        console.log('=== TENANTS ===');
        console.log(`Total: ${tenants.length}`);
        tenants.forEach(t => {
            console.log(`  - ${t.name} (${t._id})`);
        });

        console.log('\n=== SUBGRIDS (Customers) ===');
        console.log(`Total: ${subgrids.length}`);
        subgrids.forEach(s => {
            console.log(`  - ${s.name} (${s._id}) - tenantId: ${s.tenantId}`);
        });

        console.log('\n=== SUBSCRIPTIONS ===');
        console.log(`Total: ${subscriptions.length}`);
        subscriptions.forEach(s => {
            console.log(`  - tenantId: ${s.tenantId} | Plan: ${s.planName} | Status: ${s.status}`);
        });

        console.log('\n=== SUMMARY ===');
        console.log(`Tenants: ${tenants.length}`);
        console.log(`Subgrids: ${subgrids.length}`);
        console.log(`Active Subscriptions: ${subscriptions.filter(s => s.status === 'active').length}`);

        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

checkData();
