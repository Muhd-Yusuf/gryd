import React from 'react';
import { Redirect, usePathname } from 'expo-router';
import { isPathAllowed } from '../lib/featureFlags';

type FeatureGuardProps = {
    fallbackPath: string;
    children: React.ReactNode;
};

const FeatureGuard = ({ fallbackPath, children }: FeatureGuardProps) => {
    const pathname = usePathname();

    if (!isPathAllowed(pathname)) {
        return <Redirect href={fallbackPath} />;
    }

    return <>{children}</>;
};

export default FeatureGuard;
