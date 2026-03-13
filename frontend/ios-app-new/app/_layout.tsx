import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { View, ActivityIndicator, useColorScheme } from 'react-native';
import { useEffect, useState } from 'react';
import { ThemeProvider, useTheme } from '../lib/theme';
import { initAuth, getUserSubgrids, getAuthUser } from '../lib/api';
import { queryClient, queryKeys } from '../lib/queryClient';
import { WebSocketProvider } from '../contexts/WebSocketContext';
import { CallProvider } from '../contexts/CallContext';
import { NotificationProvider } from '../contexts/NotificationContext';
import { ToastProvider } from '../contexts/ToastContext';
import { QueryProvider } from '../contexts/QueryProvider';
import IncomingCallOverlay from '../components/IncomingCallOverlay';

const RootStack = () => {
    const { colors, mode } = useTheme();

    return (
        <>
            <Stack
                screenOptions={{
                    headerShown: false,
                    contentStyle: { backgroundColor: colors.appBg },
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
                <Stack.Screen name="join" />
                <Stack.Screen name="privacy-policy" />
            </Stack>
            <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
        </>
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
    const scheme = useColorScheme();

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
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="large" color={scheme === 'dark' ? '#FFF' : '#111827'} />
            </View>
        );
    }

    return (
        <QueryProvider>
            <ThemeProvider>
                <ToastProvider>
                    <WebSocketProvider>
                        <NotificationProvider>
                            <CallProvider>
                                <RootStack />
                                <IncomingCallOverlay />
                            </CallProvider>
                        </NotificationProvider>
                    </WebSocketProvider>
                </ToastProvider>
            </ThemeProvider>
        </QueryProvider>
    );
}
