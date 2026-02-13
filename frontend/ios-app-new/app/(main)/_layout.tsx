import { Slot } from 'expo-router';
import FeatureGuard from '../../components/FeatureGuard';
import { getAppHomePath } from '../../lib/featureFlags';

export default function MainLayout() {
    // We use Slot to render the child route (index, properties, etc.)
    // The ResponsiveLayout is applied inside the screens to allow the content
    // to scroll independently while sidebar stays fixed on desktop.
    // CallProvider is already in the root _layout.tsx - no need to duplicate here.
    return (
        <FeatureGuard fallbackPath={getAppHomePath()}>
            <Slot />
        </FeatureGuard>
    );
}
