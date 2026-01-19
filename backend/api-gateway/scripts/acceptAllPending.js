const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

const FriendRequest = require('../src/models/FriendRequest');
const Friendship = require('../src/models/Friendship');

const run = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');

        // Find all pending friend requests
        const pendingRequests = await FriendRequest.find({ status: 'pending' });
        console.log(`Found ${pendingRequests.length} pending requests`);

        for (const request of pendingRequests) {
            // Create friendships for both users
            await Friendship.findOneAndUpdate(
                { subgridId: request.subgridId, userId: request.requesterId, friendId: request.recipientId },
                { subgridId: request.subgridId, userId: request.requesterId, friendId: request.recipientId },
                { upsert: true, new: true }
            );
            await Friendship.findOneAndUpdate(
                { subgridId: request.subgridId, userId: request.recipientId, friendId: request.requesterId },
                { subgridId: request.subgridId, userId: request.recipientId, friendId: request.requesterId },
                { upsert: true, new: true }
            );

            // Mark request as accepted
            await FriendRequest.findByIdAndUpdate(request._id, { status: 'accepted' });

            console.log(`Accepted request: ${request._id}`);
        }

        console.log('Done! All pending requests accepted.');
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
};

run();
