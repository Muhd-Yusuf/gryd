/**
 * Content Moderation Feature Test
 *
 * This test file verifies the content moderation feature is working correctly.
 * Run with: node src/tests/contentModeration.test.js
 *
 * Prerequisites:
 * - MongoDB must be running
 * - A test subgrid must exist
 * - Set TEST_SUBGRID_ID environment variable
 */

const mongoose = require('mongoose');
require('dotenv').config();

// Import models and services
const Subgrid = require('../models/Subgrid');
const contentFilterService = require('../services/contentFilterService');

// Test configuration
const MONGODB_URI = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/gryd';
const TEST_SUBGRID_ID = process.env.TEST_SUBGRID_ID;

// Test results tracking
let passed = 0;
let failed = 0;
const results = [];

function log(message, type = 'info') {
    const prefix = type === 'pass' ? '✓' : type === 'fail' ? '✗' : '•';
    const color = type === 'pass' ? '\x1b[32m' : type === 'fail' ? '\x1b[31m' : '\x1b[36m';
    console.log(`${color}${prefix}\x1b[0m ${message}`);
}

function assert(condition, testName) {
    if (condition) {
        passed++;
        results.push({ name: testName, status: 'pass' });
        log(`PASS: ${testName}`, 'pass');
    } else {
        failed++;
        results.push({ name: testName, status: 'fail' });
        log(`FAIL: ${testName}`, 'fail');
    }
}

async function runTests() {
    console.log('\n========================================');
    console.log('   CONTENT MODERATION FEATURE TEST');
    console.log('========================================\n');

    try {
        // Connect to MongoDB
        log('Connecting to MongoDB...');
        await mongoose.connect(MONGODB_URI);
        log('Connected to MongoDB', 'pass');

        // Get or create test subgrid
        let testSubgrid;
        if (TEST_SUBGRID_ID) {
            testSubgrid = await Subgrid.findById(TEST_SUBGRID_ID);
            if (!testSubgrid) {
                log(`Test subgrid ${TEST_SUBGRID_ID} not found`, 'fail');
                return;
            }
        } else {
            // Find any existing subgrid for testing
            testSubgrid = await Subgrid.findOne();
            if (!testSubgrid) {
                log('No subgrid found for testing. Please create one or set TEST_SUBGRID_ID', 'fail');
                return;
            }
        }

        const subgridId = testSubgrid._id.toString();
        log(`Using test subgrid: ${testSubgrid.name} (${subgridId})`);

        console.log('\n--- Unit Tests: checkContent function ---\n');

        // Test 1: Empty content
        const test1 = contentFilterService.checkContent('', ['badword']);
        assert(test1.isClean === true, 'Empty content should be clean');

        // Test 2: Empty prohibited words
        const test2 = contentFilterService.checkContent('hello world', []);
        assert(test2.isClean === true, 'Empty prohibited words array should pass');

        // Test 3: No match
        const test3 = contentFilterService.checkContent('hello world', ['badword']);
        assert(test3.isClean === true, 'Content without prohibited words should be clean');

        // Test 4: Exact match
        const test4 = contentFilterService.checkContent('this is a badword in text', ['badword']);
        assert(test4.isClean === false, 'Exact prohibited word match should be detected');
        assert(test4.matches.includes('badword'), 'Match should include the word');

        // Test 5: Case insensitive match
        const test5 = contentFilterService.checkContent('This is a BADWORD in text', ['badword']);
        assert(test5.isClean === false, 'Case insensitive match should work');

        // Test 6: Word boundary - should NOT match partial words
        const test6 = contentFilterService.checkContent('I am in class today', ['ass']);
        assert(test6.isClean === true, 'Should NOT match "ass" inside "class" (word boundary)');

        // Test 7: Word boundary - should match standalone word
        const test7 = contentFilterService.checkContent('what an ass move', ['ass']);
        assert(test7.isClean === false, 'Should match standalone "ass"');

        // Test 8: Multiple prohibited words
        const test8 = contentFilterService.checkContent('bad1 and bad2 here', ['bad1', 'bad2', 'bad3']);
        assert(test8.isClean === false, 'Multiple matches should be detected');
        assert(test8.matches.length === 2, 'Should find exactly 2 matches');

        // Test 9: Censoring content
        const test9 = contentFilterService.checkContent('this is damn bad', ['damn']);
        assert(test9.censoredContent === 'this is **** bad', 'Content should be censored with asterisks');

        // Test 10: Special regex characters in prohibited word
        const test10 = contentFilterService.checkContent('test (bad) word', ['(bad)']);
        assert(test10.isClean === false, 'Should handle special regex characters');

        console.log('\n--- Integration Tests: Subgrid Content Moderation ---\n');

        // Save original settings to restore later
        const originalSettings = testSubgrid.contentModeration ? { ...testSubgrid.contentModeration.toObject() } : null;

        // Test 11: Enable content moderation
        const settings1 = await contentFilterService.updateModerationSettings(subgridId, {
            enabled: true,
            action: 'block',
            prohibitedWords: ['testword1', 'testword2'],
        });
        assert(settings1.enabled === true, 'Should enable content moderation');
        assert(settings1.prohibitedWords.includes('testword1'), 'Should have testword1 in prohibited words');

        // Test 12: Add prohibited words
        const addedWords = await contentFilterService.addProhibitedWords(subgridId, ['newword1', 'newword2']);
        assert(addedWords.includes('newword1'), 'Should add new prohibited words');
        assert(addedWords.includes('newword2'), 'Should add multiple words');

        // Test 13: Add duplicate words (should not duplicate)
        const addedDuplicate = await contentFilterService.addProhibitedWords(subgridId, ['newword1']);
        const duplicateCount = addedDuplicate.filter(w => w === 'newword1').length;
        assert(duplicateCount === 1, 'Should not duplicate existing words');

        // Test 14: Remove prohibited words
        const afterRemove = await contentFilterService.removeProhibitedWords(subgridId, ['newword1']);
        assert(!afterRemove.includes('newword1'), 'Should remove prohibited word');
        assert(afterRemove.includes('newword2'), 'Should keep other words after removal');

        // Test 15: Filter content with block action
        await contentFilterService.updateModerationSettings(subgridId, {
            enabled: true,
            action: 'block',
            prohibitedWords: ['blocked'],
        });
        const filterBlock = await contentFilterService.filterContent('this has blocked word', subgridId);
        assert(filterBlock.allowed === false, 'Block action should not allow content');
        assert(filterBlock.matches.includes('blocked'), 'Should return matched word');

        // Test 16: Filter content with censor action
        await contentFilterService.updateModerationSettings(subgridId, {
            enabled: true,
            action: 'censor',
            prohibitedWords: ['censored'],
        });
        const filterCensor = await contentFilterService.filterContent('this has censored word', subgridId);
        assert(filterCensor.allowed === true, 'Censor action should allow content');
        assert(filterCensor.censoredContent.includes('********'), 'Content should be censored');

        // Test 17: Filter content with flag action
        await contentFilterService.updateModerationSettings(subgridId, {
            enabled: true,
            action: 'flag',
            prohibitedWords: ['flagged'],
        });
        const filterFlag = await contentFilterService.filterContent('this has flagged word', subgridId);
        assert(filterFlag.allowed === true, 'Flag action should allow content');
        assert(filterFlag.flagged === true, 'Content should be flagged');

        // Test 18: Disabled moderation should allow all
        await contentFilterService.updateModerationSettings(subgridId, {
            enabled: false,
        });
        const filterDisabled = await contentFilterService.filterContent('this has blocked word', subgridId);
        assert(filterDisabled.allowed === true, 'Disabled moderation should allow all content');

        // Test 19: Get moderation settings
        const getSettings = await contentFilterService.getModerationSettings(subgridId);
        assert(getSettings !== null, 'Should return moderation settings');
        assert(typeof getSettings.enabled === 'boolean', 'Settings should have enabled flag');

        // Restore original settings
        if (originalSettings) {
            await contentFilterService.updateModerationSettings(subgridId, originalSettings);
        }

        console.log('\n========================================');
        console.log(`   TEST RESULTS: ${passed} passed, ${failed} failed`);
        console.log('========================================\n');

        if (failed > 0) {
            console.log('Failed tests:');
            results.filter(r => r.status === 'fail').forEach(r => {
                console.log(`  - ${r.name}`);
            });
        }

    } catch (error) {
        console.error('\nTest error:', error);
    } finally {
        await mongoose.disconnect();
        log('Disconnected from MongoDB');
        process.exit(failed > 0 ? 1 : 0);
    }
}

runTests();
