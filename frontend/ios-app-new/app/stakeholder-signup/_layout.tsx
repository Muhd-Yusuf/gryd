import { Stack } from 'expo-router';

export default function StakeholderSignupLayout() {
    return (
        <Stack
            screenOptions={{
                headerShown: false,
                animation: 'slide_from_right',
            }}
        >
            <Stack.Screen name="index" />
            <Stack.Screen name="account-setup" />
            <Stack.Screen name="verify-otp" />
            <Stack.Screen name="profile-icon" />
            <Stack.Screen name="profile-summary" />
        </Stack>
    );
}
