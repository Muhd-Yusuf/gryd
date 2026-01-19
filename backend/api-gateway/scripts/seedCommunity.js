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
const { getTenantConnection } = require('../src/services/tenantDb');
const { defineModels } = require('../src/services/tenantModels');

const slugify = (value) => {
    return String(value || '')
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
};

const buildDbName = (slug, id) => {
    const cleanSlug = slugify(slug).slice(0, 8) || 'tenant';
    const cleanId = String(id).replace(/[^a-f0-9]/gi, '').slice(-10) || 'seed';
    return `t_${cleanSlug}_${cleanId}`;
};

const seedSlug = process.env.SEED_TENANT_SLUG || 'gryd-seed';
const seedName = process.env.SEED_TENANT_NAME || 'The Gryd Seed';
const seedDomain = process.env.SEED_EMAIL_DOMAIN || 'thegryd.seed';
const seedSubgridName = process.env.SEED_SUBGRID_NAME || 'RBFCU Channel';
const seedSubgridSlug = slugify(seedSubgridName);
const bootstrapEmail = process.env.SEED_BOOTSTRAP_EMAIL || 'dev@syphor.local';

const usersToSeed = [
    { firstName: 'James', lastName: 'Bryce', email: `james@${seedDomain}`, role: 'admin' },
    { firstName: 'Brooklyn', lastName: 'Simmons', email: `brooklyn@${seedDomain}`, role: 'member' },
    { firstName: 'Robert', lastName: 'Fox', email: `robert@${seedDomain}`, role: 'member' },
    { firstName: 'Jenny', lastName: 'Wilson', email: `jenny@${seedDomain}`, role: 'member' },
    { firstName: 'Savannah', lastName: 'Nguyen', email: `savannah@${seedDomain}`, role: 'member' },
    { firstName: 'Darlene', lastName: 'Robertson', email: `darlene@${seedDomain}`, role: 'member' },
    { firstName: 'Dev', lastName: 'User', email: bootstrapEmail, role: 'member' },
];

const channelNames = [
    'general',
    'announcements',
    'rules-and-guidelines',
    'intros',
    'forum-directory',
    'help-and-resources',
    'chat-label',
    'private-room',
    'meet-and-greet',
    'conference-chat',
    'videos',
];

const seed = async () => {
    if (!process.env.MONGO_URI) {
        throw new Error('MONGO_URI is required to seed data');
    }

    await mongoose.connect(process.env.MONGO_URI);

    const users = [];
    for (const user of usersToSeed) {
        let record = await User.findOne({ email: user.email });
        if (!record) {
            record = await User.create(user);
        }
        users.push(record);
    }

    let tenant = await Tenant.findOne({ slug: seedSlug });
    if (!tenant) {
        const tenantId = new mongoose.Types.ObjectId();
        tenant = await Tenant.create({
            _id: tenantId,
            name: seedName,
            slug: seedSlug,
            dbName: buildDbName(seedSlug, tenantId.toString()),
            status: 'active',
        });
    } else if (!tenant.dbName || tenant.dbName.length > 38) {
        tenant.dbName = buildDbName(seedSlug, tenant._id.toString());
        await tenant.save();
    }

    const adminEmails = new Set([bootstrapEmail, `james@${seedDomain}`]);

    for (const user of users) {
        await TenantMembership.findOneAndUpdate(
            { tenantId: tenant._id, userId: user._id },
            {
                tenantId: tenant._id,
                userId: user._id,
                role: adminEmails.has(user.email) ? 'owner' : 'member',
            },
            { upsert: true, new: true }
        );
    }

    let subgrid = await Subgrid.findOne({ tenantId: tenant._id, slug: seedSubgridSlug });
    if (!subgrid) {
        subgrid = await Subgrid.create({
            tenantId: tenant._id,
            name: seedSubgridName,
            slug: seedSubgridSlug,
            description: 'Seeded community for UI validation.',
            visibility: 'private',
            status: 'active',
            settings: {
                postsEnabled: true,
                commentsEnabled: true,
                directMessagesEnabled: true,
            },
        });
    }

    for (const user of users) {
        await SubgridMembership.findOneAndUpdate(
            { tenantId: tenant._id, subgridId: subgrid._id, userId: user._id },
            {
                tenantId: tenant._id,
                subgridId: subgrid._id,
                userId: user._id,
                role: adminEmails.has(user.email) ? 'subgrid_admin' : 'member',
                status: 'active',
            },
            { upsert: true, new: true }
        );
    }

    const bootstrapUser = users.find((user) => user.email === bootstrapEmail) || users[0];
    const friendTargets = users.filter((user) => String(user._id) !== String(bootstrapUser._id)).slice(0, 3);

    for (const friend of friendTargets) {
        await Friendship.findOneAndUpdate(
            { subgridId: subgrid._id, userId: bootstrapUser._id, friendId: friend._id },
            { subgridId: subgrid._id, userId: bootstrapUser._id, friendId: friend._id },
            { upsert: true, new: true }
        );
        await Friendship.findOneAndUpdate(
            { subgridId: subgrid._id, userId: friend._id, friendId: bootstrapUser._id },
            { subgridId: subgrid._id, userId: friend._id, friendId: bootstrapUser._id },
            { upsert: true, new: true }
        );
    }

    const pendingRequester = users.find((user) => user.email === `jenny@${seedDomain}`) || users[1];
    if (pendingRequester && String(pendingRequester._id) !== String(bootstrapUser._id)) {
        await FriendRequest.findOneAndUpdate(
            {
                subgridId: subgrid._id,
                requesterId: pendingRequester._id,
                recipientId: bootstrapUser._id,
            },
            {
                subgridId: subgrid._id,
                requesterId: pendingRequester._id,
                recipientId: bootstrapUser._id,
                status: 'pending',
            },
            { upsert: true, new: true }
        );
    }

    await FriendBlock.deleteMany({ subgridId: subgrid._id, blockerId: bootstrapUser._id });

    const tenantConnection = await getTenantConnection(tenant._id);
    const { Channel, Message, Post, DirectMessage } = defineModels(tenantConnection);

    const channels = [];
    for (const name of channelNames) {
        let channel = await Channel.findOne({ subgridId: String(subgrid._id), name });
        if (!channel) {
            channel = await Channel.create({
                subgridId: String(subgrid._id),
                name,
                type: name === 'announcements' ? 'announcement' : 'text',
                visibility: 'public',
            });
        }
        channels.push(channel);
    }

    const generalChannel = channels.find((channel) => channel.name === 'general') || channels[0];
    const introChannel = channels.find((channel) => channel.name === 'intros') || generalChannel;

    const authorId = String(users[1]._id);
    const secondAuthorId = String(users[2]._id);

    const existingPosts = await Post.find({ subgridId: String(subgrid._id) }).limit(1);
    if (existingPosts.length === 0) {
        await Post.create([
            {
                subgridId: String(subgrid._id),
                channelId: String(generalChannel._id),
                authorId,
                body: 'Welcome to the RBFCU community! Share your updates here.',
                attachments: [],
            },
            {
                subgridId: String(subgrid._id),
                channelId: String(introChannel._id),
                authorId: secondAuthorId,
                body: 'Hi everyone, excited to connect with the group.',
                attachments: [],
            },
        ]);
    }

    const existingMessages = await Message.find({ subgridId: String(subgrid._id) }).limit(1);
    if (existingMessages.length === 0) {
        await Message.create([
            {
                subgridId: String(subgrid._id),
                channelId: String(generalChannel._id),
                authorId,
                body: 'Morning everyone! Let us know if you need anything.',
            },
            {
                subgridId: String(subgrid._id),
                channelId: String(generalChannel._id),
                authorId: secondAuthorId,
                body: 'Happy to be here.',
            },
        ]);
    }

    const existingDm = await DirectMessage.find({ subgridId: String(subgrid._id) }).limit(1);
    if (existingDm.length === 0) {
        await DirectMessage.create([
            {
                subgridId: String(subgrid._id),
                senderId: String(users[1]._id),
                recipientId: String(users[0]._id),
                body: 'Hey James, thanks for adding me.',
            },
            {
                subgridId: String(subgrid._id),
                senderId: String(users[0]._id),
                recipientId: String(users[1]._id),
                body: 'Welcome! Let me know if you need anything.',
            },
        ]);
    }

    if (friendTargets.length > 0) {
        const primaryFriend = friendTargets[0];
        const existingFriendDm = await DirectMessage.findOne({
            subgridId: String(subgrid._id),
            $or: [
                { senderId: String(bootstrapUser._id), recipientId: String(primaryFriend._id) },
                { senderId: String(primaryFriend._id), recipientId: String(bootstrapUser._id) },
            ],
        });
        if (!existingFriendDm) {
            await DirectMessage.create([
                {
                    subgridId: String(subgrid._id),
                    senderId: String(bootstrapUser._id),
                    recipientId: String(primaryFriend._id),
                    body: 'Hey there! Testing the new direct message flow.',
                },
                {
                    subgridId: String(subgrid._id),
                    senderId: String(primaryFriend._id),
                    recipientId: String(bootstrapUser._id),
                    body: 'Confirmed, I can see your message.',
                },
            ]);
        }
    }

    console.log('Seed tenant:', String(tenant._id), seedSlug);
    console.log('Seed subgrid:', String(subgrid._id), seedSubgridSlug);
    console.log('Seed users:', users.map((user) => ({ id: String(user._id), email: user.email })));

    await tenantConnection.close();
    await mongoose.disconnect();
};

const reset = async () => {
    if (!process.env.MONGO_URI) {
        throw new Error('MONGO_URI is required to reset data');
    }

    await mongoose.connect(process.env.MONGO_URI);

    const tenant = await Tenant.findOne({ slug: seedSlug });
    if (!tenant) {
        await mongoose.disconnect();
        return;
    }

    try {
        const tenantConnection = await getTenantConnection(tenant._id);
        await tenantConnection.dropDatabase();
        await tenantConnection.close();
    } catch (error) {
        console.warn('Failed to drop tenant database:', error.message);
    }

    await SubgridMembership.deleteMany({ tenantId: tenant._id });
    await Subgrid.deleteMany({ tenantId: tenant._id });
    await TenantMembership.deleteMany({ tenantId: tenant._id });
    await Tenant.deleteOne({ _id: tenant._id });
    await User.deleteMany({ email: new RegExp(`@${seedDomain}$`) });

    await mongoose.disconnect();
};

const run = async () => {
    const isReset = process.argv.includes('--reset');
    try {
        if (isReset) {
            await reset();
            console.log('Seed data removed.');
        } else {
            await seed();
            console.log('Seed data created.');
        }
        process.exit(0);
    } catch (error) {
        console.error('Seed error:', error.message);
        process.exit(1);
    }
};

run();
