import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import SuperAdminDashboard from '../../components/SuperAdminDashboard';
import { getAuthUser, isAuthenticated } from '../../lib/api';
import { useTheme } from '../../lib/theme';

export default function SuperAdminPage() {
    const router = useRouter();
    const { colors } = useTheme();
    const [loading, setLoading] = useState(true);
    const [hasAccess, setHasAccess] = useState(false);

    useEffect(() => {
        const checkAccess = async () => {
            const authenticated = await isAuthenticated();
            if (!authenticated) {
                router.replace('/login');
                return;
            }

            const user = await getAuthUser();

            // Only super_admin role can access super admin dashboard
            if (user?.role === 'super_admin') {
                setHasAccess(true);
                setLoading(false);
                return;
            }

            setHasAccess(false);
            setLoading(false);
        };
        checkAccess();
    }, []);

    if (loading) {
        return (
            <View style={[styles.container, { backgroundColor: colors.appBg }]}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={[styles.loadingText, { color: colors.textMuted }]}>Checking access...</Text>
            </View>
        );
    }

    if (!hasAccess) {
        return (
            <View style={[styles.container, { backgroundColor: colors.appBg }]}>
                <Text style={[styles.title, { color: colors.text }]}>Access Denied</Text>
                <Text style={[styles.subtitle, { color: colors.textMuted }]}>
                    You don't have permission to access the super admin dashboard.
                    Only super admins can access this area.
                </Text>
                <TouchableOpacity
                    style={[styles.button, { backgroundColor: colors.primary }]}
                    onPress={() => router.replace('/(main)')}
                >
                    <Text style={[styles.buttonText, { color: colors.primaryText }]}>Go to Community</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return <SuperAdminDashboard />;
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    loadingText: {
        marginTop: 12,
        fontSize: 14,
    },
    title: {
        fontSize: 24,
        fontWeight: '700',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 16,
        textAlign: 'center',
        maxWidth: 320,
        marginBottom: 24,
    },
    button: {
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 12,
    },
    buttonText: {
        fontSize: 16,
        fontWeight: '600',
    },
});
