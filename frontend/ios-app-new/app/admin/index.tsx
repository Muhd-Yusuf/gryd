import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import CreditUnionAdminScreen from '../../components/CreditUnionAdminScreen';
import { isAuthenticated, resolveTenantId, getTenantId } from '../../lib/api';
import { useTheme } from '../../lib/theme';
import { useCurrentUser, useSubgrids, useMyRole } from '../../hooks/queries';

export default function CreditUnionServerPage() {
    const router = useRouter();
    const { colors } = useTheme();
    const [tenantId, setTenantId] = useState(getTenantId());
    const [isAuthChecked, setIsAuthChecked] = useState(false);

    // React Query hooks
    const userQuery = useCurrentUser();
    const subgridsQuery = useSubgrids(tenantId);
    const firstSubgridId = subgridsQuery.data?.[0]?._id || '';
    const myRoleQuery = useMyRole(firstSubgridId);

    // Check authentication on mount
    useEffect(() => {
        const checkAuth = async () => {
            const authenticated = await isAuthenticated();
            if (!authenticated) {
                router.replace('/login');
                return;
            }
            setIsAuthChecked(true);
        };
        checkAuth();
    }, []);

    // Resolve tenant ID
    useEffect(() => {
        resolveTenantId()
            .then((id) => id && setTenantId(id))
            .catch(() => {});
    }, []);

    // Determine loading state - also wait for tenantId to resolve
    const [tenantResolved, setTenantResolved] = useState(!!getTenantId());

    useEffect(() => {
        if (tenantId) setTenantResolved(true);
    }, [tenantId]);

    const loading = !isAuthChecked || userQuery.isLoading || !tenantResolved || (!!tenantId && subgridsQuery.isLoading) || (!!firstSubgridId && myRoleQuery.isLoading);

    // Determine access
    const hasAccess = useMemo(() => {
        const user = userQuery.data;
        if (!user) return false;

        // Check user-level admin roles (super_admin, admin)
        if (user.role === 'super_admin' || user.role === 'admin') {
            return true;
        }

        // Check subgrid membership role
        const subgridRole = myRoleQuery.data;
        if (subgridRole === 'subgrid_admin' || subgridRole === 'owner') {
            return true;
        }

        return false;
    }, [userQuery.data, myRoleQuery.data]);

    if (loading) {
        return <View style={[styles.container, { backgroundColor: colors.appBg }]} />;
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
