const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');
const { metricsMiddleware } = require('./middleware/metricsMiddleware');
const { featureGuard } = require('./middleware/featureFlags');
const { scheduleCleanup } = require('./services/fileCleanupService');
const websocketService = require('./services/websocketService');
const logger = require('./utils/logger');

dotenv.config();

// Environment variable validation
const validateEnv = () => {
    const required = ['MONGO_URI', 'JWT_SECRET'];
    const optional = ['PORT', 'CORS_ORIGINS', 'CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET', 'BREVO_API_KEY'];
    const missing = required.filter(key => !process.env[key]);

    if (missing.length > 0) {
        logger.error('Environment', 'Missing required environment variables', { missing });
        process.exit(1);
    }

    const missingOptional = optional.filter(key => !process.env[key]);
    if (missingOptional.length > 0) {
        logger.warn('Environment', 'Missing optional environment variables', { missing: missingOptional });
    }

    logger.info('Environment', 'Validation passed');
};

validateEnv();

const app = express();
const server = http.createServer(app);

// Middleware
app.use(express.json());

const corsOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map((origin) => origin.trim()).filter(Boolean)
    : [];

const corsOptions = {
    origin: (origin, callback) => {
        if (!origin) {
            return callback(null, true);
        }
        if (corsOrigins.length === 0 || corsOrigins.includes(origin)) {
            return callback(null, true);
        }
        return callback(new Error(`CORS blocked origin: ${origin}`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-user-id', 'x-user-role'],
};

app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));
app.use(metricsMiddleware);

// Database Connection
const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGO_URI);
        logger.info('Database', 'MongoDB connected', { host: conn.connection.host });
    } catch (error) {
        logger.error('Database', 'Connection failed', { error: error.message });
        logger.warn('Database', 'Continuing without database connection');
    }
};

connectDB();

// Routes
const authRoutes = require('./routes/authRoutes');
app.use('/api/auth', authRoutes);
const communityRoutes = require('./routes/communityRoutes');
app.use('/api/community', featureGuard('community'), communityRoutes);
const crmRoutes = require('./routes/crmRoutes');
app.use('/api/crm', featureGuard('crm'), crmRoutes);
const calendarRoutes = require('./routes/calendarRoutes');
app.use('/api/calendar', featureGuard('calendar'), calendarRoutes);
const billingRoutes = require('./routes/billingRoutes');
app.use('/api/billing', featureGuard('billing'), billingRoutes);
const bootstrapRoutes = require('./routes/bootstrapRoutes');
app.use('/api/bootstrap', bootstrapRoutes);
const adminRoutes = require('./routes/adminRoutes');
app.use('/api/admin', featureGuard('admin'), adminRoutes);
const superAdminRoutes = require('./routes/superAdminRoutes');
app.use('/api/super-admin', superAdminRoutes);
const mediaRoutes = require('./routes/mediaRoutes');
app.use('/api/media', mediaRoutes);
const notificationRoutes = require('./routes/notificationRoutes');
app.use('/api/notifications', notificationRoutes);

const webDistPath = path.resolve(__dirname, '../../../frontend/web-app/dist');
const expoDistPath = path.resolve(__dirname, '../../../frontend/ios-app-new/dist');
const expoWebBuildPath = path.resolve(__dirname, '../../../frontend/ios-app-new/web-build');

const staticRoot = [expoDistPath, expoWebBuildPath, webDistPath].find((candidate) => fs.existsSync(candidate));

if (staticRoot) {
    app.use(express.static(staticRoot));
    app.get(/.*/, (req, res, next) => {
        if (req.path.startsWith('/api')) {
            return next();
        }
        return res.sendFile(path.join(staticRoot, 'index.html'));
    });
}

// Basic Route
app.get('/', (req, res) => {
    res.send('API Gateway is running...');
});

const PORT = process.env.PORT || 5000;

// Initialize WebSocket service with HTTP server
websocketService.initialize(server, corsOptions);

// Make websocketService available to routes/controllers
app.set('websocket', websocketService);

server.listen(PORT, () => {
    logger.info('Server', 'Started', { port: PORT });
    logger.info('WebSocket', 'Ready', { url: `ws://localhost:${PORT}` });

    // Schedule file cleanup for orphaned files (runs daily)
    scheduleCleanup();
});
