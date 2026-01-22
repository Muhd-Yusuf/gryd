import { useEffect } from 'react';
import { useRouter } from 'expo-router';

// Redirect to unified login screen
export default function StakeholderLoginRedirect() {
    const router = useRouter();

    useEffect(() => {
        router.replace('/login');
    }, []);

    return null;
}
