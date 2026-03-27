const BillingAccount = require('../models/BillingAccount');
const Subscription = require('../models/Subscription');
const UsageEvent = require('../models/UsageEvent');
const Invoice = require('../models/Invoice');
const PaymentMethod = require('../models/PaymentMethod');

// Helper: pick only allowed fields from request body
const pick = (obj, keys) => {
    const result = {};
    for (const key of keys) {
        if (obj && obj[key] !== undefined) {
            result[key] = obj[key];
        }
    }
    return result;
};

exports.getBillingAccount = async (req, res) => {
    try {
        const { tenantId } = req.params;
        let account = await BillingAccount.findOne({ tenantId });
        if (!account) {
            account = await BillingAccount.create({
                tenantId,
                billingEmail: req.user?.email || '',
            });
        }
        return res.status(200).json({ success: true, data: account });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to load billing account' });
    }
};

exports.updateBillingAccount = async (req, res) => {
    try {
        const { tenantId } = req.params;
        const allowed = pick(req.body, ['billingEmail', 'companyName', 'address', 'taxId']);
        if (Object.keys(allowed).length === 0) {
            return res.status(400).json({ message: 'No valid fields to update' });
        }
        const account = await BillingAccount.findOneAndUpdate(
            { tenantId },
            { $set: allowed },
            { new: true, upsert: true }
        );
        return res.status(200).json({ success: true, data: account });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to update billing account' });
    }
};

exports.getSubscription = async (req, res) => {
    try {
        const { tenantId } = req.params;
        let subscription = await Subscription.findOne({ tenantId });
        if (!subscription) {
            subscription = await Subscription.create({
                tenantId,
                planName: 'Starter',
                status: 'active',
            });
        }
        return res.status(200).json({ success: true, data: subscription });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to load subscription' });
    }
};

exports.updateSubscription = async (req, res) => {
    try {
        const { tenantId } = req.params;
        const allowed = pick(req.body, ['planName', 'status']);
        if (Object.keys(allowed).length === 0) {
            return res.status(400).json({ message: 'No valid fields to update' });
        }
        const subscription = await Subscription.findOneAndUpdate(
            { tenantId },
            { $set: allowed },
            { new: true, upsert: true }
        );
        return res.status(200).json({ success: true, data: subscription });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to update subscription' });
    }
};

exports.listUsageEvents = async (req, res) => {
    try {
        const { tenantId } = req.params;
        const events = await UsageEvent.find({ tenantId }).sort({ createdAt: -1 });
        return res.status(200).json({ success: true, data: events });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to list usage events' });
    }
};

exports.createUsageEvent = async (req, res) => {
    try {
        const { tenantId } = req.params;
        const { feature, units } = req.body || {};
        const event = await UsageEvent.create({
            tenantId,
            feature: String(feature || 'ai-usage').substring(0, 100),
            units: Math.max(0, Number(units) || 0),
            cost: 0, // Cost should be calculated server-side, not client-supplied
        });
        return res.status(201).json({ success: true, data: event });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to create usage event' });
    }
};

exports.listInvoices = async (req, res) => {
    try {
        const { tenantId } = req.params;
        const invoices = await Invoice.find({ tenantId }).sort({ issuedAt: -1 });
        return res.status(200).json({ success: true, data: invoices });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to list invoices' });
    }
};

exports.createInvoice = async (req, res) => {
    try {
        const { tenantId } = req.params;
        const { amountDue, dueDate } = req.body || {};
        const invoice = await Invoice.create({
            tenantId,
            number: `INV-${Date.now()}`, // Always server-generated
            status: 'open', // Always starts as open
            amountDue: Math.max(0, Number(amountDue) || 0),
            amountPaid: 0,
            dueDate: dueDate || null,
        });
        return res.status(201).json({ success: true, data: invoice });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to create invoice' });
    }
};

exports.listPaymentMethods = async (req, res) => {
    try {
        const { tenantId } = req.params;
        const methods = await PaymentMethod.find({ tenantId }).sort({ createdAt: -1 });
        return res.status(200).json({ success: true, data: methods });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to list payment methods' });
    }
};

exports.addPaymentMethod = async (req, res) => {
    try {
        const { tenantId } = req.params;
        const { provider, last4 } = req.body || {};
        const method = await PaymentMethod.create({
            tenantId,
            provider: ['plaid', 'stripe', 'paystack'].includes(provider) ? provider : 'plaid',
            type: 'ach',
            last4: String(last4 || '0000').substring(0, 4),
        });
        return res.status(201).json({ success: true, data: method });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to add payment method' });
    }
};
