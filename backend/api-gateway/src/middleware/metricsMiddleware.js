const mongoose = require('mongoose');
const ServiceMetric = require('../models/ServiceMetric');

const monitoredServices = [
    { name: 'Community Service', prefix: '/api/community' },
    { name: 'CRM Service', prefix: '/api/crm' },
    { name: 'Payment Service', prefix: '/api/billing' },
];

const resolveService = (path) => {
    const match = monitoredServices.find((service) => path.startsWith(service.prefix));
    return match ? match.name : null;
};

const metricsMiddleware = (req, res, next) => {
    const start = process.hrtime.bigint();

    res.on('finish', () => {
        const service = resolveService(req.path);
        if (!service || req.method === 'OPTIONS') {
            return;
        }
        if (mongoose.connection.readyState !== 1) {
            return;
        }

        const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
        ServiceMetric.create({
            service,
            path: req.path,
            method: req.method,
            statusCode: res.statusCode,
            durationMs,
        }).catch(() => {});
    });

    next();
};

module.exports = {
    metricsMiddleware,
    monitoredServices,
};
