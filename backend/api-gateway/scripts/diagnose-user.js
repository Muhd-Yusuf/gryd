/**
 * Diagnose user data issues
 * Run with: node scripts/diagnose-user.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../src/models/User');
const Tenant = require('../src/models/Tenant');
const TenantMembership = require('../src/models/TenantMembership');
const Subgrid = require('../src/models/Subgrid');
const SubgridMembership = require('../src/models/SubgridMembership');

// The user ID from the logs
const USER_ID = '698a4b38b29fa36e47d2c742';

async function diagnose() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB\n');

        // 1. Check if user exists
        console.log('=== USER CHECK ===');
        const user = await User.findById(USER_ID).lean();
        if (user) {
            console.log(`User found: ${user.firstName} ${user.lastName} (${user.email})`);
            console.log(`  Role: ${user.role}`);
        } else {
            console.log('ERROR: User NOT found!');
        }

        // 2. Check tenant memberships
        console.log('\n=== TENANT MEMBERSHIPS ===');
        const tenantMemberships = await TenantMembership.find({ userId: USER_ID }).lean();
        console.log(`Total memberships: ${tenantMemberships.length}`);

        if (tenantMemberships.length === 0) {
            console.log('ERROR: User has NO tenant memberships!');
            console.log('This is why sub-channels and data are not loading.');

            // Check if there are any tenants at all
            const allTenants = await Tenant.find({}).lean();
            console.log(`\nTotal tenants in system: ${allTenants.length}`);

            if (allTenants.length > 0) {
                console.log('\nAvailable tenants:');
                allTenants.forEach(t => {
                    console.log(`  - ${t.name} (${t._id})`);
                });

                // Suggest fix
                console.log('\n=== SUGGESTED FIX ===');
                console.log('Run this to add user to first tenant:');
                console.log(`
const membership = new TenantMembership({
    tenantId: '${allTenants[0]._id}',
    userId: '${USER_ID}',
    role: 'admin'
});
await membership.save();
                `);
            }
        } else {
            tenantMemberships.forEach(async (m) => {
                const tenant = await Tenant.findById(m.tenantId).lean();
                console.log(`  - Tenant: ${tenant?.name || 'Unknown'} (${m.tenantId}) | Role: ${m.role}`);
            });
        }

        // 3. Check subgrid memberships
        console.log('\n=== SUBGRID MEMBERSHIPS ===');
        const subgridMemberships = await SubgridMembership.find({ userId: USER_ID }).lean();
        console.log(`Total subgrid memberships: ${subgridMemberships.length}`);

        if (subgridMemberships.length === 0) {
            console.log('WARNING: User has no subgrid memberships');
        } else {
            for (const m of subgridMemberships) {
                const subgrid = await Subgrid.findById(m.subgridId).lean();
                console.log(`  - Subgrid: ${subgrid?.name || 'Unknown'} (${m.subgridId}) | Role: ${m.role}`);
            }
        }

        // 4. Check all data counts
        console.log('\n=== DATA COUNTS ===');
        const tenantCount = await Tenant.countDocuments();
        const subgridCount = await Subgrid.countDocuments();
        const userCount = await User.countDocuments();
        const tenantMemberCount = await TenantMembership.countDocuments();
        const subgridMemberCount = await SubgridMembership.countDocuments();

        console.log(`Tenants: ${tenantCount}`);
        console.log(`Subgrids: ${subgridCount}`);
        console.log(`Users: ${userCount}`);
        console.log(`Tenant Memberships: ${tenantMemberCount}`);
        console.log(`Subgrid Memberships: ${subgridMemberCount}`);

        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

diagnose();
