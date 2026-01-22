import { Stack } from 'expo-router';

export default function StakeholderLoginLayout() {
    return (
        <Stack
            screenOptions={{
                headerShown: false,
                animation: 'slide_from_right',
            }}
        >
            <Stack.Screen name="index" />
            <Stack.Screen name="verify-otp" />
            <Stack.Screen name="welcome" />
        </Stack>
    );
}
