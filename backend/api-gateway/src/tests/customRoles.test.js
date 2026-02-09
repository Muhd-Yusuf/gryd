/**
 * Custom Roles Feature Test
 *
 * This test file verifies the custom roles feature is working correctly.
 * Run with: node src/tests/customRoles.test.js
 *
 * Prerequisites:
 * - MongoDB must be running
 * - A test user and subgrid must exist
 * - Set TEST_USER_ID and TEST_SUBGRID_ID environment variables
 */

const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const CustomRole = require('../models/CustomRole');
const SubgridMembership = require('../models/SubgridMembership');
const Subgrid = require('../models/Subgrid');

// Test configuration
const MONGODB_URI = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/gryd';
const TEST_USER_ID = process.env.TEST_USER_ID;
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
    console.log('  Custom Roles Feature Tests');
    console.log('========================================\n');

    try {
        // Connect to MongoDB
        log('Connecting to MongoDB...');
        await mongoose.connect(MONGODB_URI);
        log('Connected to MongoDB', 'pass');

        // Generate test IDs if not provided
        const testSubgridId = TEST_SUBGRID_ID || new mongoose.Types.ObjectId().toString();
        const testUserId = TEST_USER_ID || new mongoose.Types.ObjectId().toString();

        log(`Using test subgrid ID: ${testSubgridId}`);
        log(`Using test user ID: ${testUserId}`);

        // Clean up any existing test data
        log('\nCleaning up existing test data...');
        await CustomRole.deleteMany({ subgridId: testSubgridId, name: /^Test Role/ });

        // ========================================
        // Test 1: Create a custom role
        // ========================================
        console.log('\n--- Test 1: Create Custom Role ---');

        const newRole = await CustomRole.create({
            subgridId: testSubgridId,
            name: 'Test Role Branch Manager',
            color: '#3B82F6',
            displayOrder: 0,
            isVisible: true,
            canBeMessaged: true,
        });

        assert(newRole !== null, 'Role was created');
        assert(newRole.name === 'Test Role Branch Manager', 'Role name is correct');
        assert(newRole.color === '#3B82F6', 'Role color is correct');
        assert(newRole.isVisible === true, 'Role visibility is correct');

        // ========================================
        // Test 2: Read custom roles
        // ========================================
        console.log('\n--- Test 2: Read Custom Roles ---');

        const roles = await CustomRole.find({ subgridId: testSubgridId }).lean();
        assert(roles.length > 0, 'Can retrieve roles from database');

        const foundRole = roles.find(r => r.name === 'Test Role Branch Manager');
        assert(foundRole !== undefined, 'Created role can be found');

        // ========================================
        // Test 3: Update custom role
        // ========================================
        console.log('\n--- Test 3: Update Custom Role ---');

        const updatedRole = await CustomRole.findByIdAndUpdate(
            newRole._id,
            { color: '#22C55E', name: 'Test Role Loan Officer' },
            { new: true }
        );

        assert(updatedRole.color === '#22C55E', 'Role color was updated');
        assert(updatedRole.name === 'Test Role Loan Officer', 'Role name was updated');

        // ========================================
        // Test 4: Create duplicate role should fail
        // ========================================
        console.log('\n--- Test 4: Duplicate Role Prevention ---');

        let duplicateError = null;
        try {
            await CustomRole.create({
                subgridId: testSubgridId,
                name: 'Test Role Loan Officer', // Same name as updated role
                color: '#EF4444',
            });
        } catch (err) {
            duplicateError = err;
        }

        assert(duplicateError !== null, 'Duplicate role creation throws error');
        assert(duplicateError?.code === 11000, 'Error is duplicate key error');

        // ========================================
        // Test 5: Create second role
        // ========================================
        console.log('\n--- Test 5: Create Second Role ---');

        const secondRole = await CustomRole.create({
            subgridId: testSubgridId,
            name: 'Test Role Customer Service',
            color: '#8B5CF6',
            displayOrder: 1,
        });

        assert(secondRole !== null, 'Second role was created');

        // Verify both roles exist
        const allRoles = await CustomRole.find({ subgridId: testSubgridId, name: /^Test Role/ })
            .sort({ displayOrder: 1 });

        assert(allRoles.length === 2, 'Two test roles exist');
        assert(allRoles[0].displayOrder === 0, 'Roles are sorted by displayOrder');

        // ========================================
        // Test 6: Delete custom role
        // ========================================
        console.log('\n--- Test 6: Delete Custom Role ---');

        await CustomRole.findByIdAndDelete(secondRole._id);

        const afterDelete = await CustomRole.find({ subgridId: testSubgridId, name: /^Test Role/ });
        assert(afterDelete.length === 1, 'Role was deleted');
        assert(afterDelete[0].name === 'Test Role Loan Officer', 'Correct role remains');

        // ========================================
        // Test 7: Role assignment to membership (if membership exists)
        // ========================================
        console.log('\n--- Test 7: Role Assignment ---');

        // Create a test membership if needed
        let testMembership = await SubgridMembership.findOne({ subgridId: testSubgridId, userId: testUserId });

        if (!testMembership) {
            log('Creating test membership for role assignment test...');
            testMembership = await SubgridMembership.create({
                tenantId: new mongoose.Types.ObjectId(),
                subgridId: testSubgridId,
                userId: testUserId,
                role: 'member',
                status: 'active',
            });
        }

        // Assign role to membership
        testMembership.customRoleId = newRole._id;
        await testMembership.save();

        // Verify assignment
        const memberWithRole = await SubgridMembership.findById(testMembership._id)
            .populate('customRoleId')
            .lean();

        assert(memberWithRole.customRoleId !== null, 'Role was assigned to member');
        assert(memberWithRole.customRoleId.name === 'Test Role Loan Officer', 'Correct role is assigned');

        // ========================================
        // Test 8: Remove role assignment
        // ========================================
        console.log('\n--- Test 8: Remove Role Assignment ---');

        await SubgridMembership.findByIdAndUpdate(testMembership._id, { customRoleId: null });

        const memberWithoutRole = await SubgridMembership.findById(testMembership._id).lean();
        assert(memberWithoutRole.customRoleId === null, 'Role was removed from member');

        // ========================================
        // Cleanup
        // ========================================
        console.log('\n--- Cleanup ---');

        // Delete test roles
        await CustomRole.deleteMany({ subgridId: testSubgridId, name: /^Test Role/ });

        // Delete test membership if we created it
        if (!TEST_USER_ID) {
            await SubgridMembership.findByIdAndDelete(testMembership._id);
        }

        log('Test data cleaned up', 'pass');

    } catch (error) {
        console.error('\n\x1b[31mTest error:\x1b[0m', error);
        failed++;
    } finally {
        // Disconnect from MongoDB
        await mongoose.disconnect();
        log('Disconnected from MongoDB');
    }

    // Print summary
    console.log('\n========================================');
    console.log('  Test Summary');
    console.log('========================================');
    console.log(`\x1b[32m  Passed: ${passed}\x1b[0m`);
    console.log(`\x1b[31m  Failed: ${failed}\x1b[0m`);
    console.log(`  Total:  ${passed + failed}`);
    console.log('========================================\n');

    // Exit with appropriate code
    process.exit(failed > 0 ? 1 : 0);
}

// Run tests
runTests();
