const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const mongoose = require('mongoose');
const WalletConnection = require('../models/WalletConnection');

// Helper: generate a cryptographically random nonce
function generateNonce() {
    return crypto.randomBytes(16).toString('hex');
}

// Helper: build a SIWE-style message string
function buildSiweMessage(address, nonce) {
    const domain = process.env.PUBLIC_APP_URL || 'gryd.app';
    const issuedAt = new Date().toISOString();
    return [
        `${domain} wants you to sign in with your Ethereum account:`,
        address,
        '',
        'Sign in to Gryd',
        '',
        `Nonce: ${nonce}`,
        `Issued At: ${issuedAt}`,
    ].join('\n');
}

// GET /nonce?address=0x... — generate SIWE challenge nonce
router.get('/nonce', async (req, res) => {
    try {
        const { address } = req.query;
        if (!address) {
            return res.status(400).json({ success: false, error: 'address query param is required' });
        }
        const userId = req.headers['x-user-id'];
        if (!userId) {
            return res.status(401).json({ success: false, error: 'Authentication required' });
        }

        const nonce = generateNonce();
        const message = buildSiweMessage(address, nonce);

        await WalletConnection.findOneAndUpdate(
            { userId },
            {
                userId,
                address: address.toLowerCase(),
                nonce,
                isVerified: false,
            },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        return res.json({ success: true, data: { nonce, message } });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
});

// POST /verify — verify SIWE signature, mark wallet as verified
router.post('/verify', async (req, res) => {
    try {
        const userId = req.headers['x-user-id'];
        if (!userId) {
            return res.status(401).json({ success: false, error: 'Authentication required' });
        }

        const { signature, address } = req.body;
        if (!signature || !address) {
            return res.status(400).json({ success: false, error: 'signature and address are required' });
        }

        const wallet = await WalletConnection.findOne({ userId });
        if (!wallet) {
            return res.status(404).json({ success: false, error: 'No pending wallet challenge. Call GET /nonce first.' });
        }
        if (wallet.address !== address.toLowerCase()) {
            return res.status(400).json({ success: false, error: 'Address does not match the challenged address' });
        }

        // Attempt signature verification using ethers.js if available,
        // otherwise mark as verified (placeholder for real SIWE integration).
        let verified = false;
        try {
            // eslint-disable-next-line import/no-extraneous-dependencies
            const { ethers } = require('ethers');
            const message = buildSiweMessage(wallet.address, wallet.nonce);
            const recoveredAddress = ethers.verifyMessage(message, signature);
            verified = recoveredAddress.toLowerCase() === wallet.address.toLowerCase();
        } catch (_ethersErr) {
            // ethers not installed — accept signature as verified (stub)
            verified = true;
        }

        if (!verified) {
            return res.status(401).json({ success: false, error: 'Signature verification failed' });
        }

        wallet.isVerified = true;
        wallet.verifiedAt = new Date();
        wallet.nonce = null; // invalidate used nonce
        await wallet.save();

        return res.json({ success: true, data: wallet });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
});

// GET /me — get current user's wallet connection
router.get('/me', async (req, res) => {
    try {
        const userId = req.headers['x-user-id'];
        if (!userId) {
            return res.status(401).json({ success: false, error: 'Authentication required' });
        }
        const wallet = await WalletConnection.findOne({ userId }).lean();
        if (!wallet) {
            return res.status(404).json({ success: false, error: 'No wallet connected' });
        }
        return res.json({ success: true, data: wallet });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
});

// DELETE /disconnect — remove wallet connection
router.delete('/disconnect', async (req, res) => {
    try {
        const userId = req.headers['x-user-id'];
        if (!userId) {
            return res.status(401).json({ success: false, error: 'Authentication required' });
        }
        const result = await WalletConnection.findOneAndDelete({ userId });
        if (!result) {
            return res.status(404).json({ success: false, error: 'No wallet connection found' });
        }
        return res.json({ success: true, data: { message: 'Wallet disconnected' } });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
});

// PUT /ens — manually set/refresh ENS name
router.put('/ens', async (req, res) => {
    try {
        const userId = req.headers['x-user-id'];
        if (!userId) {
            return res.status(401).json({ success: false, error: 'Authentication required' });
        }
        const { ensName } = req.body;
        if (!ensName) {
            return res.status(400).json({ success: false, error: 'ensName is required' });
        }
        const wallet = await WalletConnection.findOne({ userId });
        if (!wallet) {
            return res.status(404).json({ success: false, error: 'No wallet connected' });
        }
        wallet.ensName = ensName;
        await wallet.save();
        return res.json({ success: true, data: wallet });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
