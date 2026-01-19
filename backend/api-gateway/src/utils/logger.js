/**
 * Simple structured logger for production use
 * Replaces console.log/console.error with configurable logging
 */

const LOG_LEVELS = {
    error: 0,
    warn: 1,
    info: 2,
    debug: 3,
};

const currentLevel = LOG_LEVELS[process.env.LOG_LEVEL || 'info'];
const isDev = process.env.NODE_ENV !== 'production';

const formatMessage = (level, context, message, data) => {
    const timestamp = new Date().toISOString();
    const prefix = context ? `[${context}]` : '';

    if (isDev) {
        // Pretty print in development
        return { timestamp, level, context, message, ...(data && { data }) };
    }

    // JSON format for production
    return JSON.stringify({ timestamp, level, context, message, ...(data && { data }) });
};

const logger = {
    error: (context, message, data) => {
        if (currentLevel >= LOG_LEVELS.error) {
            console.error(formatMessage('error', context, message, data));
        }
    },

    warn: (context, message, data) => {
        if (currentLevel >= LOG_LEVELS.warn) {
            console.warn(formatMessage('warn', context, message, data));
        }
    },

    info: (context, message, data) => {
        if (currentLevel >= LOG_LEVELS.info) {
            console.log(formatMessage('info', context, message, data));
        }
    },

    debug: (context, message, data) => {
        if (currentLevel >= LOG_LEVELS.debug) {
            console.log(formatMessage('debug', context, message, data));
        }
    },

    // For email service - only log in dev or when explicitly enabled
    email: (message, data) => {
        if (isDev || process.env.LOG_EMAILS === 'true') {
            console.log(formatMessage('info', 'Email', message, data));
        }
    },
};

module.exports = logger;
