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
    console.log('[sendEmail] Starting email send', { to, subject, hasBrevoKey: !!process.env.BREVO_API_KEY });

    // Try Brevo first (preferred)
    if (process.env.BREVO_API_KEY) {
        try {
            console.log('[sendEmail] Attempting Brevo send...');
            const result = await sendViaBrevo({ to, subject, text, html });
            console.log('[sendEmail] Brevo send successful', { to, messageId: result.messageId });
            logger.email('Email sent via Brevo', { to, messageId: result.messageId });
            return result;
        } catch (error) {
            console.error('[sendEmail] Brevo failed:', error.message);
            logger.error('Email', 'Brevo failed, falling back', { error: error.message });
        }
    } else {
        console.log('[sendEmail] No BREVO_API_KEY configured');
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

/**
 * Send a Customer Setup email (from Super Admin to new customer)
 * @param {Object} options - Setup options
 * @param {string} options.email - Recipient email
 * @param {string} options.customerName - Name of the customer/organization
 * @param {string} options.setupToken - Setup token for the account
 * @param {string} options.tenantId - Tenant ID for the customer
 * @returns {Promise<Object>} - Send result
 */
const sendCustomerSetupEmail = async ({ email, customerName, setupToken, tenantId }) => {
    const baseUrl = process.env.PUBLIC_APP_URL || 'http://localhost:8081';
    const setupUrl = `${baseUrl}/setup?token=${setupToken}&tenant=${tenantId}`;

    // Log setup URL for development
    logger.email('Customer setup email prepared', { to: email, customer: customerName, setupUrl });

    const subject = `Welcome to The GRYD - Complete Your Account Setup`;

    const text = `
Hello ${customerName},

Welcome to The GRYD! Your account has been created by our team.

Please click the link below to complete your account setup:

${setupUrl}

During setup, you'll be able to:
- Set your server/community name
- Configure your organization settings
- Set up your password

This setup link will expire in 7 days.

If you have any questions, please don't hesitate to contact our support team.

Best regards,
The GRYD Team
    `.trim();

    const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome to The GRYD</title>
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
                            <h2 style="color: #1f2937; margin: 0 0 20px; font-size: 24px;">Welcome, ${customerName}!</h2>
                            <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
                                Your account on The GRYD has been created. Click the button below to complete your setup.
                            </p>
                            <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 10px;">
                                During setup, you'll be able to:
                            </p>
                            <ul style="color: #4b5563; font-size: 16px; line-height: 1.8; margin: 0 0 30px; padding-left: 20px;">
                                <li>Set your server/community name</li>
                                <li>Configure your organization settings</li>
                                <li>Set up your password</li>
                            </ul>
                            <table width="100%" cellpadding="0" cellspacing="0">
                                <tr>
                                    <td align="center">
                                        <a href="${setupUrl}" style="display: inline-block; background-color: #3B82F6; color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 12px; font-size: 16px; font-weight: 600;">Complete Setup</a>
                                    </td>
                                </tr>
                            </table>
                            <p style="color: #9ca3af; font-size: 14px; margin: 30px 0 0; text-align: center;">
                                This setup link will expire in 7 days.
                            </p>
                        </td>
                    </tr>
                    <!-- Footer -->
                    <tr>
                        <td style="background-color: #f9fafb; padding: 20px 30px; text-align: center; border-top: 1px solid #e5e7eb;">
                            <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                                If you didn't expect this email, please contact our support team.
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

/**
 * Send OTP verification email
 * @param {Object} options - OTP options
 * @param {string} options.email - Recipient email
 * @param {string} options.otp - OTP code
 * @param {string} options.purpose - Purpose ('signup' | 'login')
 * @returns {Promise<Object>} - Send result
 */
const sendOtpEmail = async ({ email, otp, purpose = 'login' }) => {
    const purposeText = purpose === 'signup' ? 'complete your signup' : 'log in to your account';

    logger.email('OTP email prepared', { to: email, purpose });

    const subject = `Your GRYD Verification Code: ${otp}`;

    const text = `
Hello,

Your verification code is: ${otp}

Use this code to ${purposeText}. This code will expire in 10 minutes.

If you didn't request this code, you can safely ignore this email.

Best regards,
The GRYD Team
    `.trim();

    const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Verification Code</title>
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
                        <td style="padding: 40px 30px; text-align: center;">
                            <h2 style="color: #1f2937; margin: 0 0 20px; font-size: 24px;">Verification Code</h2>
                            <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 30px;">
                                Use the code below to ${purposeText}:
                            </p>
                            <div style="background-color: #f3f4f6; border-radius: 12px; padding: 24px; margin: 0 0 30px;">
                                <span style="font-size: 36px; font-weight: 700; letter-spacing: 8px; color: #1f2937;">${otp}</span>
                            </div>
                            <p style="color: #9ca3af; font-size: 14px; margin: 0;">
                                This code will expire in 10 minutes.
                            </p>
                        </td>
                    </tr>
                    <!-- Footer -->
                    <tr>
                        <td style="background-color: #f9fafb; padding: 20px 30px; text-align: center; border-top: 1px solid #e5e7eb;">
                            <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                                If you didn't request this code, you can safely ignore this email.
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

/**
 * Send stakeholder invitation email
 * @param {Object} options - Invite options
 * @param {string} options.email - Recipient email
 * @param {string} options.inviteToken - Invite token
 * @param {string} options.subgridId - Subgrid ID
 * @param {string} options.subgridName - Name of the Credit Union/Community
 * @param {string} options.inviterName - Name of the person sending the invite
 * @param {string} options.stakeholderBadge - The badge type for the stakeholder
 * @returns {Promise<Object>} - Send result
 */
const sendStakeholderInviteEmail = async ({ email, inviteToken, subgridId, subgridName, inviterName, stakeholderBadge }) => {
    const baseUrl = process.env.PUBLIC_APP_URL || 'http://localhost:8081';
    console.log('[sendStakeholderInviteEmail] PUBLIC_APP_URL from env:', process.env.PUBLIC_APP_URL);
    console.log('[sendStakeholderInviteEmail] Using baseUrl:', baseUrl);
    const inviteUrl = `${baseUrl}/stakeholder-signup?token=${inviteToken}&subgrid=${subgridId}`;
    console.log('[sendStakeholderInviteEmail] Final inviteUrl:', inviteUrl);

    const badgeLabel = stakeholderBadge ? stakeholderBadge.charAt(0).toUpperCase() + stakeholderBadge.slice(1) : 'Stakeholder';

    console.log('[sendStakeholderInviteEmail] Preparing email', { to: email, from: inviterName, community: subgridName, badge: stakeholderBadge, inviteUrl });
    logger.email('Stakeholder invite email prepared', { to: email, from: inviterName, community: subgridName, badge: stakeholderBadge, inviteUrl });

    const subject = `You're invited to join ${subgridName} as a ${badgeLabel}`;

    const text = `
Hello,

${inviterName} has invited you to join ${subgridName} on The GRYD as a ${badgeLabel}.

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
    <title>You're Invited as ${badgeLabel}</title>
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
                                <strong>${inviterName}</strong> has invited you to join <strong>${subgridName}</strong> as a <span style="background-color: #3B82F6; color: white; padding: 2px 10px; border-radius: 12px; font-size: 14px;">${badgeLabel}</span>
                            </p>
                            <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 30px;">
                                Click the button below to accept the invitation and set up your profile.
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

/**
 * Send team member invitation email (for super admin team invites)
 * Redirects to login page with email prefilled since account is already created
 * @param {Object} options - Invite options
 * @param {string} options.email - Recipient email
 * @param {string} options.firstName - First name of the invitee
 * @param {string} options.role - Role assigned (admin or super_admin)
 * @returns {Promise<Object>} - Send result
 */
const sendTeamMemberInviteEmail = async ({ email, firstName, role }) => {
    const baseUrl = process.env.PUBLIC_APP_URL || 'http://localhost:8081';
    const loginUrl = `${baseUrl}/login?email=${encodeURIComponent(email)}&team=true`;

    const roleLabel = role === 'super_admin' ? 'Super Admin' : 'Admin';

    logger.email('Team member invite email prepared', { to: email, role, loginUrl });

    const subject = `You've been added to The GRYD Team as ${roleLabel}`;

    const text = `
Hello ${firstName || 'there'},

You've been added to The GRYD platform team as a ${roleLabel}.

Your account is ready! Click the link below to log in:

${loginUrl}

You'll receive a verification code via email to complete your login.

If you have any questions, please contact the Super Admin.

Best regards,
The GRYD Team
    `.trim();

    const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome to The GRYD Team</title>
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
                            <h2 style="color: #1f2937; margin: 0 0 20px; font-size: 24px;">Welcome to the Team!</h2>
                            <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
                                Hello ${firstName || 'there'}, you've been added to The GRYD platform team as a <span style="background-color: #3B82F6; color: white; padding: 2px 10px; border-radius: 12px; font-size: 14px;">${roleLabel}</span>
                            </p>
                            <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 30px;">
                                Your account is ready! Click the button below to log in. You'll receive a verification code to complete your login.
                            </p>
                            <table width="100%" cellpadding="0" cellspacing="0">
                                <tr>
                                    <td align="center">
                                        <a href="${loginUrl}" style="display: inline-block; background-color: #3B82F6; color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 12px; font-size: 16px; font-weight: 600;">Log In Now</a>
                                    </td>
                                </tr>
                            </table>
                            <p style="color: #9ca3af; font-size: 14px; margin: 30px 0 0; text-align: center;">
                                Your email: <strong>${email}</strong>
                            </p>
                        </td>
                    </tr>
                    <!-- Footer -->
                    <tr>
                        <td style="background-color: #f9fafb; padding: 20px 30px; text-align: center; border-top: 1px solid #e5e7eb;">
                            <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                                If you didn't expect this invitation, please contact the Super Admin.
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

/**
 * Send private channel invitation email
 * @param {Object} options - Invite options
 * @param {string} options.email - Recipient email
 * @param {string} options.channelName - Name of the private channel
 * @param {string} options.subgridName - Name of the Credit Union/Community
 * @param {string} options.inviterName - Name of the admin who added them
 * @returns {Promise<Object>} - Send result
 */
const sendChannelInviteEmail = async ({ email, channelName, subgridName, inviterName }) => {
    logger.email('Channel invite email prepared', { to: email, channel: channelName, community: subgridName });

    const subject = `You've been added to a private channel in ${subgridName}`;

    const text = `
Hello,

${inviterName} has added you to the private channel "${channelName}" in ${subgridName} on The GRYD.

You now have access to view and participate in this channel. Log in to The GRYD to start engaging.

Best regards,
The GRYD Team
    `.trim();

    const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Private Channel Invitation</title>
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
                            <h2 style="color: #1f2937; margin: 0 0 20px; font-size: 24px;">Private Channel Invitation</h2>
                            <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
                                <strong>${inviterName}</strong> has added you to the private channel <span style="background-color: #1f2937; color: white; padding: 2px 10px; border-radius: 8px; font-size: 14px;">${channelName}</span> in <strong>${subgridName}</strong>.
                            </p>
                            <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 30px;">
                                You now have access to view and participate in this channel. Log in to The GRYD to start engaging.
                            </p>
                            <table width="100%" cellpadding="0" cellspacing="0">
                                <tr>
                                    <td align="center">
                                        <a href="${process.env.PUBLIC_APP_URL || 'http://localhost:8081'}" style="display: inline-block; background-color: #3B82F6; color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 12px; font-size: 16px; font-weight: 600;">Open The GRYD</a>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    <!-- Footer -->
                    <tr>
                        <td style="background-color: #f9fafb; padding: 20px 30px; text-align: center; border-top: 1px solid #e5e7eb;">
                            <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                                If you didn't expect this notification, please contact your community admin.
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
    sendCustomerSetupEmail,
    sendOtpEmail,
    sendStakeholderInviteEmail,
    sendTeamMemberInviteEmail,
    sendChannelInviteEmail,
};
