const mongoose = require('mongoose');
const Tenant = require('../models/Tenant');

const connectionCache = new Map();

const getTenantConnection = async (tenantId) => {
    if (!tenantId) {
        throw new Error('Tenant ID is required');
    }

    const cached = connectionCache.get(String(tenantId));
    if (cached) {
        return cached;
    }

    const tenant = await Tenant.findById(tenantId);
    if (!tenant) {
        throw new Error('Tenant not found');
    }

    const connection = await mongoose.createConnection(process.env.MONGO_URI, {
        dbName: tenant.dbName,
    });

    connectionCache.set(String(tenantId), connection);
    return connection;
};

module.exports = {
    getTenantConnection,
};
