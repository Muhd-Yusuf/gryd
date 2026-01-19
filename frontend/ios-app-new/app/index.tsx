import { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Redirect } from 'expo-router';
import { isAuthenticated, getAuthUser } from '../lib/api';

/**
 * Root index - checks authentication and redirects appropriately based on role
 */
export default function Index() {
    const [checking, setChecking] = useState(true);
    const [redirectTo, setRedirectTo] = useState<string | null>(null);

    useEffect(() => {
        const check = async () => {
            try {
                const auth = await isAuthenticated();
                if (!auth) {
                    setRedirectTo('/welcome');
                    return;
                }

                // Get user role to determine redirect
                const user = await getAuthUser();
                if (user?.role === 'super_admin') {
                    setRedirectTo('/super-admin');
                } else if (user?.role === 'admin') {
                    setRedirectTo('/admin');
                } else {
                    setRedirectTo('/(main)');
                }
            } catch {
                setRedirectTo('/welcome');
            } finally {
                setChecking(false);
            }
        };
        check();
    }, []);

    if (checking || !redirectTo) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="large" />
            </View>
        );
    }

    return <Redirect href={redirectTo as any} />;
}
