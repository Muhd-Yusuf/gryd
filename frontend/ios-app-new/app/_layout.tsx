import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { View, ActivityIndicator } from 'react-native';
import { useEffect, useState } from 'react';
import { ThemeProvider as NavThemeProvider, DarkTheme, DefaultTheme } from '@react-navigation/native';
import { ThemeProvider, useTheme } from '../lib/theme';
import { initAuth, getUserSubgrids, getAuthUser } from '../lib/api';
import { queryClient, queryKeys } from '../lib/queryClient';
import { WebSocketProvider } from '../contexts/WebSocketContext';
import { CallProvider } from '../contexts/CallContext';
import { NotificationProvider } from '../contexts/NotificationContext';
import { ToastProvider } from '../contexts/ToastContext';
import { QueryProvider } from '../contexts/QueryProvider';
import IncomingCallOverlay from '../components/IncomingCallOverlay';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { NetworkIndicator } from '../components/NetworkIndicator';
import { GradientBackground } from '../components/glass';

const RootStack = () => {
    const { colors, mode } = useTheme();

    const navTheme = {
        ...(mode === 'dark' ? DarkTheme : DefaultTheme),
        colors: {
            ...(mode === 'dark' ? DarkTheme.colors : DefaultTheme.colors),
            background: 'transparent',
        },
    };

    return (
        <NavThemeProvider value={navTheme}>
        <GradientBackground style={{ flex: 1 }}>
            <Stack
                screenOptions={{
                    headerShown: false,
                    contentStyle: { backgroundColor: 'rgba(0,0,0,0)' },
                    animation: 'fade',
                }}
            >
                <Stack.Screen name="index" />
                <Stack.Screen name="admin" />
                <Stack.Screen name="super-admin" />
                <Stack.Screen name="super-admin-signup" />
                <Stack.Screen name="setup" />
                <Stack.Screen name="stakeholder-signup" />
                <Stack.Screen name="(main)" />
                <Stack.Screen name="partner-dashboard" />
                <Stack.Screen name="partner-apply" />
                <Stack.Screen name="join" />
                <Stack.Screen name="privacy-policy" />
            </Stack>
            <StatusBar style="light" />
        </GradientBackground>
        </NavThemeProvider>
    );
};

export default function RootLayout() {
    const [fontsLoaded] = useFonts({
        Inter_400Regular,
        Inter_500Medium,
        Inter_600SemiBold,
        Inter_700Bold,
    });
    const [authInitialized, setAuthInitialized] = useState(false);

    // Initialize auth on app start and prefetch key data
    useEffect(() => {
        const init = async () => {
            try {
                const user = await initAuth();
                if (user) {
                    // Seed the auth user into React Query cache
                    queryClient.setQueryData(queryKeys.auth.user, user);
                    // Prefetch user subgrids and profile in background
                    queryClient.prefetchQuery({
                        queryKey: queryKeys.auth.subgrids,
                        queryFn: async () => {
                            const response = await getUserSubgrids();
                            return response?.subgrids || [];
                        },
                        staleTime: Infinity,
                    });
                    queryClient.prefetchQuery({
                        queryKey: queryKeys.auth.user,
                        queryFn: async () => {
                            const authUser = await getAuthUser();
                            return authUser;
                        },
                        staleTime: Infinity,
                    });
                }
            } catch (err) {
                console.error('[App] Auth init error:', err);
            } finally {
                setAuthInitialized(true);
            }
        };
        init();
    }, []);

    if (!fontsLoaded || !authInitialized) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000000' }}>
                <ActivityIndicator size="large" color="#FFFFFF" />
            </View>
        );
    }

    return (
        <ErrorBoundary>
            <QueryProvider>
                <ThemeProvider>
                    <ToastProvider>
                        <WebSocketProvider>
                            <NotificationProvider>
                                <CallProvider>
                                    <RootStack />
                                    <IncomingCallOverlay />
                                    <NetworkIndicator />
                                </CallProvider>
                            </NotificationProvider>
                        </WebSocketProvider>
                    </ToastProvider>
                </ThemeProvider>
            </QueryProvider>
        </ErrorBoundary>
    );
}
