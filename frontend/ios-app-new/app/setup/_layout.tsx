import { Stack } from 'expo-router';

export default function SetupLayout() {
    return (
        <Stack
            screenOptions={{
                headerShown: false,
                animation: 'slide_from_right',
            }}
        >
            <Stack.Screen name="index" />
            <Stack.Screen name="server-icon" />
            <Stack.Screen name="invite-members" />
        </Stack>
    );
}
