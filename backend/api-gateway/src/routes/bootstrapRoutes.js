const express = require('express');
const { bootstrap } = require('../controllers/bootstrapController');

const router = express.Router();

router.post('/', bootstrap);

module.exports = router;
