import React from 'react';
import { ScrollView, Text, View, StyleSheet, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const sections = [
    {
        title: '1. Introduction',
        body: 'The Gryd ("we," "our," or "us") operates The Gryd mobile and web application. This Privacy Policy explains how we collect, use, and protect your personal information.',
    },
    {
        title: '2. Information We Collect',
        body: `Information you provide:
• Email address (for account creation and OTP authentication)
• Name and display name
• Profile picture
• Messages, posts, and comments you send
• Voice messages and media files you share
• Community and channel participation data

Information collected automatically:
• Device information (device type, operating system)
• Push notification tokens
• Usage data (features used, interaction timestamps)`,
    },
    {
        title: '3. How We Use Your Information',
        body: `• To create and manage your account
• To enable real-time messaging, voice calls, and video calls
• To send OTP codes for authentication via email
• To deliver push notifications
• To display your profile to other community members
• To enable community features (posts, events, announcements)`,
    },
    {
        title: '4. Third-Party Services',
        body: `We use the following third-party services:
• Agora — for voice and video call functionality
• SendGrid — for sending authentication emails
• Cloudinary — for storing uploaded images and media
• MongoDB — for data storage
• Expo Push Notifications — for delivering push notifications

Each service has its own privacy policy governing their use of data.`,
    },
    {
        title: '5. Data Sharing',
        body: `• Your profile name, picture, and posts are visible to members of your community
• We do not sell your personal data to third parties
• We may share data if required by law or to protect our legal rights`,
    },
    {
        title: '6. Data Storage and Security',
        body: `• Your data is stored securely on cloud-hosted databases
• Media files are stored via Cloudinary
• We use JWT-based authentication and OTP verification to protect your account
• All communication uses encrypted connections (HTTPS/WSS)`,
    },
    {
        title: '7. Data Retention',
        body: `• Account data is retained as long as your account is active
• You may request deletion of your account and associated data by contacting us`,
    },
    {
        title: '8. Children\'s Privacy',
        body: 'The Gryd is not intended for children under 13. We do not knowingly collect data from children under 13.',
    },
    {
        title: '9. Your Rights',
        body: `You have the right to:
• Access your personal data
• Request correction of inaccurate data
• Request deletion of your data
• Withdraw consent for data processing`,
    },
    {
        title: '10. Changes to This Policy',
        body: 'We may update this Privacy Policy from time to time. We will notify users of significant changes through the app.',
    },
    {
        title: '11. Contact Us',
        body: 'If you have questions about this Privacy Policy, contact us at:\nEmail: support@thegryd.com',
    },
];

export default function PrivacyPolicy() {
    return (
        <SafeAreaView style={styles.safe}>
            <ScrollView
                style={styles.container}
                contentContainerStyle={styles.content}
            >
                <Text style={styles.heading}>Privacy Policy</Text>
                <Text style={styles.subtitle}>The Gryd</Text>
                <Text style={styles.updated}>Last updated: March 6, 2026</Text>

                {sections.map((section, index) => (
                    <View key={index} style={styles.section}>
                        <Text style={styles.sectionTitle}>{section.title}</Text>
                        <Text style={styles.sectionBody}>{section.body}</Text>
                    </View>
                ))}
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safe: {
        flex: 1,
        backgroundColor: '#ffffff',
    },
    container: {
        flex: 1,
    },
    content: {
        padding: 24,
        paddingBottom: 64,
        maxWidth: 800,
        width: '100%',
        alignSelf: 'center',
    },
    heading: {
        fontSize: 32,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 4,
    },
    subtitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#6b7280',
        marginBottom: 4,
    },
    updated: {
        fontSize: 14,
        color: '#9ca3af',
        marginBottom: 32,
    },
    section: {
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 8,
    },
    sectionBody: {
        fontSize: 15,
        lineHeight: 24,
        color: '#374151',
    },
});
