import { useEffect } from 'react';
import { useRouter } from 'expo-router';

// Redirect to unified login screen
// Admins now use the same OTP-based passwordless login as everyone else
// The backend will detect their role and route them to /admin after verification
export default function AdminLoginRedirect() {
    const router = useRouter();

    useEffect(() => {
        router.replace('/login');
    }, []);

    return null;
}
