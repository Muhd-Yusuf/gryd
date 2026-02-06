import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { View, ActivityIndicator, useColorScheme } from 'react-native';
import { useEffect, useState } from 'react';
import { ThemeProvider, useTheme } from '../lib/theme';
import { initAuth } from '../lib/api';
import { WebSocketProvider } from '../contexts/WebSocketContext';
import { CallProvider } from '../contexts/CallContext';
import { NotificationProvider } from '../contexts/NotificationContext';
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
                <Stack.Screen name="welcome" />
                <Stack.Screen name="admin" />
                <Stack.Screen name="super-admin" />
                <Stack.Screen name="super-admin-signup" />
                <Stack.Screen name="setup" />
                <Stack.Screen name="stakeholder-signup" />
                <Stack.Screen name="(main)" />
                <Stack.Screen name="join" />
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

    // Initialize auth on app start
    useEffect(() => {
        const init = async () => {
            try {
                await initAuth();
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
        <ThemeProvider>
            <WebSocketProvider>
                <NotificationProvider>
                    <CallProvider>
                        <RootStack />
                        <IncomingCallOverlay />
                    </CallProvider>
                </NotificationProvider>
            </WebSocketProvider>
        </ThemeProvider>
    );
}
