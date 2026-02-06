import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import CreditUnionAdminScreen from '../../components/CreditUnionAdminScreen';
import { getAuthUser, isAuthenticated, communityGet, resolveTenantId } from '../../lib/api';
import { useTheme } from '../../lib/theme';

export default function CreditUnionServerPage() {
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

            // Check user-level admin roles (super_admin, admin)
            const isUserAdmin = user?.role === 'super_admin' || user?.role === 'admin';
            if (isUserAdmin) {
                setHasAccess(true);
                setLoading(false);
                return;
            }

            // Check subgrid membership role
            try {
                const tenantId = await resolveTenantId();
                if (tenantId) {
                    const subgridsRes = await communityGet(`/tenants/${tenantId}/subgrids`);
                    const subgrids = subgridsRes?.data || [];
                    if (subgrids.length > 0) {
                        const subgridId = subgrids[0]._id;
                        const roleRes = await communityGet(`/subgrids/${subgridId}/my-role`);
                        const subgridRole = roleRes?.data?.role;
                        // Allow subgrid_admin access to admin dashboard
                        if (subgridRole === 'subgrid_admin' || subgridRole === 'owner') {
                            setHasAccess(true);
                            setLoading(false);
                            return;
                        }
                    }
                }
            } catch (err) {
                // Subgrid role check failed, fall through to denied
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
                    You don't have permission to access the admin dashboard.
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

    return <CreditUnionAdminScreen />;
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
