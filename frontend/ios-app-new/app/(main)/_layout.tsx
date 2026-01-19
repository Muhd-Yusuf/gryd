import { Slot } from 'expo-router';
import FeatureGuard from '../../components/FeatureGuard';
import { getAppHomePath } from '../../lib/featureFlags';
import { CallProvider } from '../../contexts/CallContext';
import IncomingCallOverlay from '../../components/IncomingCallOverlay';

export default function MainLayout() {
    // We use Slot to render the child route (index, properties, etc.)
    // The ResponsiveLayout is applied inside the screens to allow the content
    // to scroll independently while sidebar stays fixed on desktop.
    // CallProvider enables receiving calls from anywhere in the app.
    return (
        <FeatureGuard fallbackPath={getAppHomePath()}>
            <CallProvider>
                <Slot />
                <IncomingCallOverlay />
            </CallProvider>
        </FeatureGuard>
    );
}
