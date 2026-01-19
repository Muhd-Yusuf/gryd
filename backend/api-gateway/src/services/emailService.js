/**
 * Email Service for sending transactional emails
 *
 * Supports multiple providers (in priority order):
 * 1. Brevo (Sendinblue) - set BREVO_API_KEY
 * 2. SendGrid - set SENDGRID_API_KEY
 * 3. Nodemailer (SMTP) - set EMAIL_SMTP_HOST, EMAIL_SMTP_PORT, EMAIL_SMTP_USER, EMAIL_SMTP_PASS
 *
 * For development, emails are logged to console if no provider is configured.
 */

const nodemailer = require('nodemailer');
const logger = require('../utils/logger');

// Brevo API client
let brevoClient = null;

const initBrevo = () => {
    if (process.env.BREVO_API_KEY && !brevoClient) {
        brevoClient = {
            apiKey: process.env.BREVO_API_KEY,
            baseUrl: 'https://api.brevo.com/v3',
        };
    }
    return brevoClient;
};

// Send email via Brevo API
const sendViaBrevo = async ({ to, subject, text, html }) => {
    const client = initBrevo();
    if (!client) return null;

    logger.email('Sending via Brevo', { to, from: getFromAddress(), subject });

    // Check if we should skip Brevo due to IP restrictions (for local dev)
    if (process.env.SKIP_BREVO_IP_CHECK === 'true') {
        logger.email('Skipping Brevo API call (dev mode)', { to });
        return { messageId: `dev-brevo-${Date.now()}`, accepted: [to], provider: 'brevo-dev' };
    }

    const response = await fetch(`${client.baseUrl}/smtp/email`, {
        method: 'POST',
        headers: {
            'accept': 'application/json',
            'api-key': client.apiKey,
            'content-type': 'application/json',
        },
        body: JSON.stringify({
            sender: {
                name: getFromName(),
                email: getFromAddress(),
            },
            to: [{ email: to }],
            subject,
            htmlContent: html || text,
            textContent: text,
        }),
    });

    if (!response.ok) {
        const error = await response.json();
        logger.error('Email', 'Brevo API error', error);
        throw new Error(`Brevo API error: ${error.message || error.code || response.statusText}`);
    }

    const result = await response.json();
    return { messageId: result.messageId, accepted: [to], provider: 'brevo' };
};

// Create transporter based on environment configuration
const createTransporter = () => {
    // Check for SendGrid
    if (process.env.SENDGRID_API_KEY) {
        return nodemailer.createTransport({
            host: 'smtp.sendgrid.net',
            port: 587,
            auth: {
                user: 'apikey',
                pass: process.env.SENDGRID_API_KEY,
            },
        });
    }

    // Check for SMTP configuration
    if (process.env.EMAIL_SMTP_HOST) {
        return nodemailer.createTransport({
            host: process.env.EMAIL_SMTP_HOST,
            port: parseInt(process.env.EMAIL_SMTP_PORT || '587'),
            secure: process.env.EMAIL_SMTP_SECURE === 'true',
            auth: {
                user: process.env.EMAIL_SMTP_USER,
                pass: process.env.EMAIL_SMTP_PASS,
            },
        });
    }

    // Development mode - log emails to console
    return null;
};

let transporter = null;

const getTransporter = () => {
    if (!transporter) {
        transporter = createTransporter();
    }
    return transporter;
};

const getFromAddress = () => {
    return process.env.EMAIL_FROM_ADDRESS || 'noreply@the-gryd.com';
};

const getFromName = () => {
    return process.env.EMAIL_FROM_NAME || 'The GRYD';
};

/**
 * Send an email
 * @param {Object} options - Email options
 * @param {string} options.to - Recipient email address
 * @param {string} options.subject - Email subject
 * @param {string} options.text - Plain text body
 * @param {string} options.html - HTML body (optional)
 * @returns {Promise<Object>} - Send result
 */
const sendEmail = async ({ to, subject, text, html }) => {
    // Try Brevo first (preferred)
    if (process.env.BREVO_API_KEY) {
        try {
            const result = await sendViaBrevo({ to, subject, text, html });
            logger.email('Email sent via Brevo', { to, messageId: result.messageId });
            return result;
        } catch (error) {
            logger.error('Email', 'Brevo failed, falling back', { error: error.message });
        }
    }

    const transport = getTransporter();

    const mailOptions = {
        from: `${getFromName()} <${getFromAddress()}>`,
        to,
        subject,
        text,
        html: html || text,
    };

    // Development mode - log to console
    if (!transport) {
        logger.email('DEV MODE - Email would be sent', { to, subject });
        return { messageId: `dev-${Date.now()}`, accepted: [to], provider: 'console' };
    }

    try {
        const result = await transport.sendMail(mailOptions);
        logger.email('Email sent via SMTP', { to, messageId: result.messageId });
        return { ...result, provider: 'smtp' };
    } catch (error) {
        logger.error('Email', 'Failed to send email', { to, error: error.message });
        throw error;
    }
};

/**
 * Send a Credit Union invitation email
 * @param {Object} options - Invite options
 * @param {string} options.email - Recipient email
 * @param {string} options.inviteToken - Invite token
 * @param {string} options.subgridId - Subgrid ID
 * @param {string} options.subgridName - Name of the Credit Union/Community
 * @param {string} options.inviterName - Name of the person sending the invite
 * @returns {Promise<Object>} - Send result
 */
const sendInviteEmail = async ({ email, inviteToken, subgridId, subgridName, inviterName }) => {
    const baseUrl = process.env.PUBLIC_APP_URL || 'http://localhost:8081';
    const inviteUrl = `${baseUrl}/join/${inviteToken}?subgrid=${subgridId}`;

    // Log invite URL for development (useful when emails aren't being sent)
    logger.email('Invite email prepared', { to: email, from: inviterName, community: subgridName, inviteUrl });

    const subject = `You're invited to join ${subgridName} on The GRYD`;

    const text = `
Hello,

${inviterName} has invited you to join ${subgridName} on The GRYD.

Click the link below to accept the invitation and create your account:

${inviteUrl}

This invitation link will expire in 7 days.

If you didn't expect this invitation, you can safely ignore this email.

Best regards,
The GRYD Team
    `.trim();

    const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>You're Invited</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif; background-color: #f5f5f5;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
        <tr>
            <td align="center">
                <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
                    <!-- Header -->
                    <tr>
                        <td style="background: linear-gradient(135deg, #1E3A8A 0%, #3B82F6 100%); padding: 40px 30px; text-align: center;">
                            <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">THE GRYD</h1>
                        </td>
                    </tr>
                    <!-- Content -->
                    <tr>
                        <td style="padding: 40px 30px;">
                            <h2 style="color: #1f2937; margin: 0 0 20px; font-size: 24px;">You're Invited!</h2>
                            <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
                                <strong>${inviterName}</strong> has invited you to join <strong>${subgridName}</strong> on The GRYD.
                            </p>
                            <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 30px;">
                                Click the button below to accept the invitation and create your account.
                            </p>
                            <table width="100%" cellpadding="0" cellspacing="0">
                                <tr>
                                    <td align="center">
                                        <a href="${inviteUrl}" style="display: inline-block; background-color: #3B82F6; color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 12px; font-size: 16px; font-weight: 600;">Accept Invitation</a>
                                    </td>
                                </tr>
                            </table>
                            <p style="color: #9ca3af; font-size: 14px; margin: 30px 0 0; text-align: center;">
                                This invitation link will expire in 7 days.
                            </p>
                        </td>
                    </tr>
                    <!-- Footer -->
                    <tr>
                        <td style="background-color: #f9fafb; padding: 20px 30px; text-align: center; border-top: 1px solid #e5e7eb;">
                            <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                                If you didn't expect this invitation, you can safely ignore this email.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
    `.trim();

    return sendEmail({ to: email, subject, text, html });
};

module.exports = {
    sendEmail,
    sendInviteEmail,
};
