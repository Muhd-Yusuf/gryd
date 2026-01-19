const BillingAccount = require('../models/BillingAccount');
const Subscription = require('../models/Subscription');
const UsageEvent = require('../models/UsageEvent');
const Invoice = require('../models/Invoice');
const PaymentMethod = require('../models/PaymentMethod');

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
        return res.status(500).json({ message: 'Failed to load billing account', error: error.message });
    }
};

exports.updateBillingAccount = async (req, res) => {
    try {
        const { tenantId } = req.params;
        const account = await BillingAccount.findOneAndUpdate(
            { tenantId },
            { $set: req.body || {} },
            { new: true, upsert: true }
        );
        return res.status(200).json({ success: true, data: account });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to update billing account', error: error.message });
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
        return res.status(500).json({ message: 'Failed to load subscription', error: error.message });
    }
};

exports.updateSubscription = async (req, res) => {
    try {
        const { tenantId } = req.params;
        const subscription = await Subscription.findOneAndUpdate(
            { tenantId },
            { $set: req.body || {} },
            { new: true, upsert: true }
        );
        return res.status(200).json({ success: true, data: subscription });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to update subscription', error: error.message });
    }
};

exports.listUsageEvents = async (req, res) => {
    try {
        const { tenantId } = req.params;
        const events = await UsageEvent.find({ tenantId }).sort({ createdAt: -1 });
        return res.status(200).json({ success: true, data: events });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to list usage events', error: error.message });
    }
};

exports.createUsageEvent = async (req, res) => {
    try {
        const { tenantId } = req.params;
        const payload = req.body || {};
        const event = await UsageEvent.create({
            tenantId,
            feature: payload.feature || 'ai-usage',
            units: payload.units || 0,
            cost: payload.cost || 0,
        });
        return res.status(201).json({ success: true, data: event });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to create usage event', error: error.message });
    }
};

exports.listInvoices = async (req, res) => {
    try {
        const { tenantId } = req.params;
        const invoices = await Invoice.find({ tenantId }).sort({ issuedAt: -1 });
        return res.status(200).json({ success: true, data: invoices });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to list invoices', error: error.message });
    }
};

exports.createInvoice = async (req, res) => {
    try {
        const { tenantId } = req.params;
        const payload = req.body || {};
        const invoice = await Invoice.create({
            tenantId,
            number: payload.number || `INV-${Date.now()}`,
            status: payload.status || 'open',
            amountDue: payload.amountDue || 0,
            amountPaid: payload.amountPaid || 0,
            dueDate: payload.dueDate || null,
        });
        return res.status(201).json({ success: true, data: invoice });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to create invoice', error: error.message });
    }
};

exports.listPaymentMethods = async (req, res) => {
    try {
        const { tenantId } = req.params;
        const methods = await PaymentMethod.find({ tenantId }).sort({ createdAt: -1 });
        return res.status(200).json({ success: true, data: methods });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to list payment methods', error: error.message });
    }
};

exports.addPaymentMethod = async (req, res) => {
    try {
        const { tenantId } = req.params;
        const payload = req.body || {};
        const method = await PaymentMethod.create({
            tenantId,
            provider: payload.provider || 'plaid',
            type: 'ach',
            last4: payload.last4 || '0000',
        });
        return res.status(201).json({ success: true, data: method });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to add payment method', error: error.message });
    }
};
