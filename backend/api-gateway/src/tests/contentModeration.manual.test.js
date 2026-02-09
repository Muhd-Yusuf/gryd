/**
 * Manual Content Moderation Test
 * Run with: node src/tests/contentModeration.manual.test.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Subgrid = require('../models/Subgrid');

const MONGODB_URI = process.env.MONGO_URI || process.env.MONGODB_URI;

async function runTest() {
    console.log('========================================');
    console.log('  Content Moderation Manual Test');
    console.log('========================================\n');

    try {
        // Connect to MongoDB
        console.log('• Connecting to MongoDB...');
        await mongoose.connect(MONGODB_URI);
        console.log('✓ Connected to MongoDB\n');

        // Find a subgrid to test with
        const subgrid = await Subgrid.findOne({});
        if (!subgrid) {
            console.log('✗ No subgrids found in database');
            return;
        }
        console.log('• Using subgrid:', subgrid._id, subgrid.name || subgrid.slug);
        console.log('• Current contentModeration settings:', JSON.stringify(subgrid.contentModeration, null, 2));

        // Test adding a prohibited word directly to the database
        console.log('\n--- Test: Add Prohibited Word Directly ---');
        const testWord = 'testword' + Date.now();

        const updatedSubgrid = await Subgrid.findByIdAndUpdate(
            subgrid._id,
            { $addToSet: { 'contentModeration.prohibitedWords': testWord } },
            { new: true }
        ).select('contentModeration');

        console.log('✓ Added word:', testWord);
        console.log('• Updated prohibited words:', updatedSubgrid?.contentModeration?.prohibitedWords);

        // Verify it was saved
        const verifySubgrid = await Subgrid.findById(subgrid._id).select('contentModeration');
        console.log('• Verified from DB:', verifySubgrid?.contentModeration?.prohibitedWords);

        // Clean up - remove the test word
        console.log('\n--- Cleanup: Remove Test Word ---');
        await Subgrid.findByIdAndUpdate(
            subgrid._id,
            { $pull: { 'contentModeration.prohibitedWords': testWord } }
        );
        console.log('✓ Removed test word');

    } catch (error) {
        console.error('Test error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\n• Disconnected from MongoDB');
    }
}

runTest();
