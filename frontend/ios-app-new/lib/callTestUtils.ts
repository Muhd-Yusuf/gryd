/**
 * Call Testing Utilities for Web Member Dashboard
 *
 * These utilities help debug and verify the call flow:
 * - Call initiation
 * - Call connection
 * - Call ending
 *
 * Usage: Import and run tests from browser console or component
 */

export type CallTestResult = {
    test: string;
    passed: boolean;
    message: string;
    duration?: number;
    details?: any;
};

export type CallTestReport = {
    timestamp: string;
    totalTests: number;
    passed: number;
    failed: number;
    results: CallTestResult[];
};

/**
 * Test 1: Verify call state transitions
 * Expected flow: idle -> initiating -> ringing -> connected -> ended -> idle
 */
export const testCallStateTransitions = async (
    startCallFn: () => Promise<any>,
    hangupFn: () => void,
    getCallState: () => string
): Promise<CallTestResult> => {
    const test = 'Call State Transitions';
    const states: string[] = [];
    const startTime = Date.now();

    try {
        // Check initial state
        const initialState = getCallState();
        states.push(initialState);

        if (initialState !== 'idle') {
            return {
                test,
                passed: false,
                message: `Initial state should be 'idle', got '${initialState}'`,
                details: { states }
            };
        }

        // Start call
        console.log('[CallTest] Starting call...');
        await startCallFn();

        // Wait for state to change
        await new Promise(resolve => setTimeout(resolve, 500));
        const afterStartState = getCallState();
        states.push(afterStartState);

        if (!['initiating', 'ringing', 'connecting'].includes(afterStartState)) {
            return {
                test,
                passed: false,
                message: `After startCall, state should be 'initiating', 'ringing', or 'connecting', got '${afterStartState}'`,
                details: { states }
            };
        }

        // End call
        console.log('[CallTest] Ending call...');
        hangupFn();

        // Wait for cleanup
        await new Promise(resolve => setTimeout(resolve, 2000));
        const finalState = getCallState();
        states.push(finalState);

        const duration = Date.now() - startTime;

        return {
            test,
            passed: true,
            message: `State transitions verified: ${states.join(' -> ')}`,
            duration,
            details: { states }
        };
    } catch (error: any) {
        return {
            test,
            passed: false,
            message: `Error during test: ${error.message}`,
            details: { states, error: error.message }
        };
    }
};

/**
 * Test 2: Verify call modal visibility
 */
export const testCallModalVisibility = async (
    startCallFn: () => Promise<any>,
    hangupFn: () => void,
    isModalVisible: () => boolean
): Promise<CallTestResult> => {
    const test = 'Call Modal Visibility';
    const startTime = Date.now();

    try {
        // Modal should not be visible initially
        const initiallyVisible = isModalVisible();
        if (initiallyVisible) {
            return {
                test,
                passed: false,
                message: 'Modal should not be visible before call starts'
            };
        }

        // Start call
        console.log('[CallTest] Starting call for modal visibility test...');
        await startCallFn();
        await new Promise(resolve => setTimeout(resolve, 500));

        // Modal should be visible after call starts
        const visibleAfterStart = isModalVisible();
        if (!visibleAfterStart) {
            // Clean up
            hangupFn();
            return {
                test,
                passed: false,
                message: 'Modal should be visible after call starts'
            };
        }

        // End call
        console.log('[CallTest] Ending call...');
        hangupFn();
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Modal should not be visible after call ends
        const visibleAfterEnd = isModalVisible();

        const duration = Date.now() - startTime;

        if (visibleAfterEnd) {
            return {
                test,
                passed: false,
                message: 'Modal should not be visible after call ends',
                duration
            };
        }

        return {
            test,
            passed: true,
            message: 'Modal visibility correctly toggles with call state',
            duration
        };
    } catch (error: any) {
        return {
            test,
            passed: false,
            message: `Error during test: ${error.message}`
        };
    }
};

/**
 * Test 3: Verify Agora connection
 */
export const testAgoraConnection = async (
    engine: { client: any; localVideoTrack: any } | null
): Promise<CallTestResult> => {
    const test = 'Agora Connection Status';

    if (!engine || !engine.client) {
        return {
            test,
            passed: false,
            message: 'Agora client not initialized'
        };
    }

    const client = engine.client;
    const connectionState = client.connectionState;

    return {
        test,
        passed: connectionState === 'CONNECTED',
        message: `Agora connection state: ${connectionState}`,
        details: {
            connectionState,
            remoteUsers: client.remoteUsers?.length || 0,
            hasLocalVideoTrack: !!engine.localVideoTrack
        }
    };
};

/**
 * Test 4: Verify mute/unmute functionality
 */
export const testMuteToggle = async (
    toggleMute: () => void,
    isMuted: () => boolean
): Promise<CallTestResult> => {
    const test = 'Mute Toggle Functionality';

    try {
        const initialMuted = isMuted();
        console.log('[CallTest] Initial muted state:', initialMuted);

        toggleMute();
        await new Promise(resolve => setTimeout(resolve, 100));

        const afterFirstToggle = isMuted();
        console.log('[CallTest] After first toggle:', afterFirstToggle);

        if (afterFirstToggle === initialMuted) {
            return {
                test,
                passed: false,
                message: 'Mute state should change after toggle',
                details: { initial: initialMuted, afterToggle: afterFirstToggle }
            };
        }

        toggleMute();
        await new Promise(resolve => setTimeout(resolve, 100));

        const afterSecondToggle = isMuted();
        console.log('[CallTest] After second toggle:', afterSecondToggle);

        if (afterSecondToggle !== initialMuted) {
            return {
                test,
                passed: false,
                message: 'Mute state should return to initial after two toggles',
                details: { initial: initialMuted, afterSecondToggle }
            };
        }

        return {
            test,
            passed: true,
            message: 'Mute toggle works correctly'
        };
    } catch (error: any) {
        return {
            test,
            passed: false,
            message: `Error during test: ${error.message}`
        };
    }
};

/**
 * Test 5: Verify video toggle functionality
 */
export const testVideoToggle = async (
    toggleVideo: () => void,
    isVideoEnabled: () => boolean
): Promise<CallTestResult> => {
    const test = 'Video Toggle Functionality';

    try {
        const initialEnabled = isVideoEnabled();
        console.log('[CallTest] Initial video enabled:', initialEnabled);

        toggleVideo();
        await new Promise(resolve => setTimeout(resolve, 100));

        const afterFirstToggle = isVideoEnabled();
        console.log('[CallTest] After first toggle:', afterFirstToggle);

        if (afterFirstToggle === initialEnabled) {
            return {
                test,
                passed: false,
                message: 'Video enabled state should change after toggle',
                details: { initial: initialEnabled, afterToggle: afterFirstToggle }
            };
        }

        toggleVideo();
        await new Promise(resolve => setTimeout(resolve, 100));

        const afterSecondToggle = isVideoEnabled();
        console.log('[CallTest] After second toggle:', afterSecondToggle);

        if (afterSecondToggle !== initialEnabled) {
            return {
                test,
                passed: false,
                message: 'Video enabled state should return to initial after two toggles',
                details: { initial: initialEnabled, afterSecondToggle }
            };
        }

        return {
            test,
            passed: true,
            message: 'Video toggle works correctly'
        };
    } catch (error: any) {
        return {
            test,
            passed: false,
            message: `Error during test: ${error.message}`
        };
    }
};

/**
 * Run all call tests and generate a report
 */
export const runCallTests = async (config: {
    startCall: () => Promise<any>;
    hangup: () => void;
    getCallState: () => string;
    isModalVisible: () => boolean;
    getEngine: () => any;
    toggleMute: () => void;
    isMuted: () => boolean;
    toggleVideo: () => void;
    isVideoEnabled: () => boolean;
}): Promise<CallTestReport> => {
    console.log('[CallTest] Starting call functionality tests...');
    const results: CallTestResult[] = [];

    // Test 1: State transitions (includes starting and ending a call)
    console.log('[CallTest] Running Test 1: State Transitions');
    const stateTransitionResult = await testCallStateTransitions(
        config.startCall,
        config.hangup,
        config.getCallState
    );
    results.push(stateTransitionResult);

    // Wait before next test
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Test 2: Modal visibility
    console.log('[CallTest] Running Test 2: Modal Visibility');
    const modalResult = await testCallModalVisibility(
        config.startCall,
        config.hangup,
        config.isModalVisible
    );
    results.push(modalResult);

    // Generate report
    const report: CallTestReport = {
        timestamp: new Date().toISOString(),
        totalTests: results.length,
        passed: results.filter(r => r.passed).length,
        failed: results.filter(r => !r.passed).length,
        results
    };

    console.log('[CallTest] Test Report:', report);
    return report;
};

/**
 * Quick diagnostic check for call state
 */
export const diagnoseCallState = (agoraCall: {
    callState: string;
    callType: string;
    currentCall: any;
    isMuted: boolean;
    isVideoEnabled: boolean;
    isSpeakerOn: boolean;
    remoteUsers: number[];
    error: string | null;
    callDuration: number;
    engine: any;
}) => {
    console.log('=== Call State Diagnostic ===');
    console.log('Call State:', agoraCall.callState);
    console.log('Call Type:', agoraCall.callType);
    console.log('Current Call:', agoraCall.currentCall);
    console.log('Is Muted:', agoraCall.isMuted);
    console.log('Is Video Enabled:', agoraCall.isVideoEnabled);
    console.log('Is Speaker On:', agoraCall.isSpeakerOn);
    console.log('Remote Users:', agoraCall.remoteUsers);
    console.log('Error:', agoraCall.error);
    console.log('Call Duration:', agoraCall.callDuration, 'seconds');

    if (agoraCall.engine) {
        console.log('Engine Client State:', agoraCall.engine.client?.connectionState);
        console.log('Remote Users in Client:', agoraCall.engine.client?.remoteUsers?.length || 0);
        console.log('Has Local Video Track:', !!agoraCall.engine.localVideoTrack);
    }
    console.log('=============================');

    return {
        callState: agoraCall.callState,
        isConnected: agoraCall.callState === 'connected',
        hasRemoteUsers: agoraCall.remoteUsers.length > 0,
        clientConnectionState: agoraCall.engine?.client?.connectionState,
        error: agoraCall.error
    };
};

export default {
    testCallStateTransitions,
    testCallModalVisibility,
    testAgoraConnection,
    testMuteToggle,
    testVideoToggle,
    runCallTests,
    diagnoseCallState
};
