import { Stack } from 'expo-router';

export default function MemberSignupLayout() {
    return (
        <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="server-details" />
            <Stack.Screen name="account-setup" />
            <Stack.Screen name="verify-otp" />
            <Stack.Screen name="profile-picture" />
            <Stack.Screen name="profile-summary" />
        </Stack>
    );
}
