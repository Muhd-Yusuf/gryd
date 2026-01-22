import { Slot } from 'expo-router';
import { CallProvider } from '../../contexts/CallContext';
import IncomingCallOverlay from '../../components/IncomingCallOverlay';

export default function AdminGroupLayout() {
    return (
        <CallProvider>
            <Slot />
            <IncomingCallOverlay />
        </CallProvider>
    );
}
