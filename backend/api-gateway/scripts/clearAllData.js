const path = require('path');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const User = require('../src/models/User');
const Tenant = require('../src/models/Tenant');
const TenantMembership = require('../src/models/TenantMembership');
const Subgrid = require('../src/models/Subgrid');
const SubgridMembership = require('../src/models/SubgridMembership');
const FriendRequest = require('../src/models/FriendRequest');
const Friendship = require('../src/models/Friendship');
const FriendBlock = require('../src/models/FriendBlock');
const InviteLink = require('../src/models/InviteLink');
const UserPresence = require('../src/models/UserPresence');
const Call = require('../src/models/Call');
const FileMetadata = require('../src/models/FileMetadata');

const clearAllData = async () => {
    if (!process.env.MONGO_URI) {
        throw new Error('MONGO_URI is required');
    }

    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected!');

    // Get all tenants to drop their databases
    const tenants = await Tenant.find({});
    console.log(`Found ${tenants.length} tenants to clean up...`);

    for (const tenant of tenants) {
        if (tenant.dbName) {
            try {
                console.log(`Dropping tenant database: ${tenant.dbName}`);
                const conn = mongoose.connection.useDb(tenant.dbName);
                await conn.dropDatabase();
                console.log(`  Dropped: ${tenant.dbName}`);
            } catch (err) {
                console.log(`  Failed to drop ${tenant.dbName}:`, err.message);
            }
        }
    }

    // Clear all main collections
    console.log('\nClearing main collections...');

    const collections = [
        { name: 'Users', model: User },
        { name: 'Tenants', model: Tenant },
        { name: 'TenantMemberships', model: TenantMembership },
        { name: 'Subgrids', model: Subgrid },
        { name: 'SubgridMemberships', model: SubgridMembership },
        { name: 'FriendRequests', model: FriendRequest },
        { name: 'Friendships', model: Friendship },
        { name: 'FriendBlocks', model: FriendBlock },
        { name: 'InviteLinks', model: InviteLink },
        { name: 'UserPresences', model: UserPresence },
        { name: 'Calls', model: Call },
        { name: 'FileMetadata', model: FileMetadata },
    ];

    for (const { name, model } of collections) {
        try {
            const result = await model.deleteMany({});
            console.log(`  ${name}: deleted ${result.deletedCount} documents`);
        } catch (err) {
            console.log(`  ${name}: ${err.message}`);
        }
    }

    console.log('\n✅ All data cleared successfully!');
    console.log('\nThe database is now empty and ready for production use.');
    console.log('Next steps:');
    console.log('  1. Go to the admin dashboard to create a super admin account');
    console.log('  2. Create your first Credit Union tenant');
    console.log('  3. Invite members via email');

    await mongoose.disconnect();
    process.exit(0);
};

clearAllData().catch((err) => {
    console.error('Error clearing data:', err);
    process.exit(1);
});
