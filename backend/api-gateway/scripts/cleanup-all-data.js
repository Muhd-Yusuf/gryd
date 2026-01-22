/**
 * Script to delete all CU accounts and member accounts
 * Keeps only super admin accounts
 * Run with: node scripts/cleanup-all-data.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Subscription = require('../src/models/Subscription');
const Tenant = require('../src/models/Tenant');
const Subgrid = require('../src/models/Subgrid');
const SubgridMembership = require('../src/models/SubgridMembership');
const User = require('../src/models/User');

async function cleanupAllData() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB\n');

        // Show current state
        console.log('=== BEFORE CLEANUP ===');
        const beforeTenants = await Tenant.countDocuments();
        const beforeSubgrids = await Subgrid.countDocuments();
        const beforeSubscriptions = await Subscription.countDocuments();
        const beforeMemberships = await SubgridMembership.countDocuments();
        const beforeUsers = await User.countDocuments();
        const superAdmins = await User.countDocuments({ role: 'super_admin' });

        console.log(`Tenants: ${beforeTenants}`);
        console.log(`Subgrids: ${beforeSubgrids}`);
        console.log(`Subscriptions: ${beforeSubscriptions}`);
        console.log(`Memberships: ${beforeMemberships}`);
        console.log(`Users: ${beforeUsers} (${superAdmins} super admins)`);

        // Delete all subscriptions
        const deletedSubs = await Subscription.deleteMany({});
        console.log(`\nDeleted ${deletedSubs.deletedCount} subscriptions`);

        // Delete all subgrid memberships
        const deletedMemberships = await SubgridMembership.deleteMany({});
        console.log(`Deleted ${deletedMemberships.deletedCount} memberships`);

        // Delete all subgrids
        const deletedSubgrids = await Subgrid.deleteMany({});
        console.log(`Deleted ${deletedSubgrids.deletedCount} subgrids`);

        // Delete all tenants
        const deletedTenants = await Tenant.deleteMany({});
        console.log(`Deleted ${deletedTenants.deletedCount} tenants`);

        // Delete all users EXCEPT super admins
        const deletedUsers = await User.deleteMany({ role: { $ne: 'super_admin' } });
        console.log(`Deleted ${deletedUsers.deletedCount} non-super-admin users`);

        // Show final state
        console.log('\n=== AFTER CLEANUP ===');
        const afterTenants = await Tenant.countDocuments();
        const afterSubgrids = await Subgrid.countDocuments();
        const afterSubscriptions = await Subscription.countDocuments();
        const afterMemberships = await SubgridMembership.countDocuments();
        const afterUsers = await User.countDocuments();
        const afterSuperAdmins = await User.countDocuments({ role: 'super_admin' });

        console.log(`Tenants: ${afterTenants}`);
        console.log(`Subgrids: ${afterSubgrids}`);
        console.log(`Subscriptions: ${afterSubscriptions}`);
        console.log(`Memberships: ${afterMemberships}`);
        console.log(`Users: ${afterUsers} (all super admins: ${afterSuperAdmins})`);

        // List remaining super admins
        const remainingAdmins = await User.find({ role: 'super_admin' }, 'email firstName lastName').lean();
        console.log('\nRemaining Super Admins:');
        remainingAdmins.forEach(admin => {
            console.log(`  - ${admin.firstName || ''} ${admin.lastName || ''} (${admin.email})`);
        });

        console.log('\nDone!');
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

cleanupAllData();
