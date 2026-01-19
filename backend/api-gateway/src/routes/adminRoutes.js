const express = require('express');
const { getDashboard, listUsers, getUserDetails } = require('../controllers/adminController');

const router = express.Router();

router.get('/dashboard', getDashboard);
router.get('/users', listUsers);
router.get('/users/:userId', getUserDetails);

module.exports = router;
