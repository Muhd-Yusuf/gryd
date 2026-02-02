/**
 * Voice Channel Testing Utilities
 *
 * These utilities help debug and verify voice channel functionality:
 * - Channel joining/leaving
 * - UID conflict handling
 * - Role transitions (host/speaker/listener)
 * - Wave to speak functionality
 *
 * Usage: Import and run tests from browser console or component
 */

export type VoiceChannelTestResult = {
    test: string;
    passed: boolean;
    message: string;
    duration?: number;
    details?: any;
};

export type VoiceChannelTestReport = {
    timestamp: string;
    totalTests: number;
    passed: number;
    failed: number;
    results: VoiceChannelTestResult[];
};

/**
 * Test 1: Verify Agora client connection state
 */
export const testClientConnectionState = (
    client: any
): VoiceChannelTestResult => {
    const test = 'Client Connection State';

    if (!client) {
        return {
            test,
            passed: false,
            message: 'Agora client not initialized'
        };
    }

    const connectionState = client.connectionState;
    const validStates = ['DISCONNECTED', 'CONNECTING', 'CONNECTED', 'RECONNECTING', 'DISCONNECTING'];

    return {
        test,
        passed: validStates.includes(connectionState),
        message: `Connection state: ${connectionState}`,
        details: {
            connectionState,
            remoteUsers: client.remoteUsers?.length || 0,
            localUid: client.uid
        }
    };
};

/**
 * Test 2: Verify channel join/leave cycle
 */
export const testChannelJoinLeave = async (
    joinFn: () => Promise<void>,
    leaveFn: () => Promise<void>,
    getClient: () => any
): Promise<VoiceChannelTestResult> => {
    const test = 'Channel Join/Leave Cycle';
    const startTime = Date.now();
    const states: string[] = [];

    try {
        const initialClient = getClient();
        states.push(`initial: ${initialClient?.connectionState || 'no client'}`);

        console.log('[VoiceChannelTest] Starting join...');
        await joinFn();
        await new Promise(resolve => setTimeout(resolve, 1000));

        const afterJoin = getClient();
        states.push(`after join: ${afterJoin?.connectionState || 'no client'}`);

        if (afterJoin?.connectionState !== 'CONNECTED') {
            return {
                test,
                passed: false,
                message: `Expected CONNECTED after join, got ${afterJoin?.connectionState}`,
                details: { states }
            };
        }

        console.log('[VoiceChannelTest] Starting leave...');
        await leaveFn();
        await new Promise(resolve => setTimeout(resolve, 500));

        const afterLeave = getClient();
        states.push(`after leave: ${afterLeave?.connectionState || 'no client'}`);

        const duration = Date.now() - startTime;

        return {
            test,
            passed: true,
            message: `Join/Leave cycle completed: ${states.join(' -> ')}`,
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
 * Test 3: Verify no UID conflict on rejoin
 */
export const testNoUidConflictOnRejoin = async (
    joinFn: () => Promise<void>,
    leaveFn: () => Promise<void>,
    getClient: () => any
): Promise<VoiceChannelTestResult> => {
    const test = 'No UID Conflict on Rejoin';
    const startTime = Date.now();

    try {
        // First join
        console.log('[VoiceChannelTest] First join attempt...');
        await joinFn();
        await new Promise(resolve => setTimeout(resolve, 1000));

        const clientAfterFirstJoin = getClient();
        if (clientAfterFirstJoin?.connectionState !== 'CONNECTED') {
            return {
                test,
                passed: false,
                message: 'First join failed',
                details: { state: clientAfterFirstJoin?.connectionState }
            };
        }

        // Leave
        console.log('[VoiceChannelTest] Leaving...');
        await leaveFn();
        await new Promise(resolve => setTimeout(resolve, 500));

        // Second join - this should not cause UID_CONFLICT
        console.log('[VoiceChannelTest] Second join attempt (checking for UID_CONFLICT)...');
        await joinFn();
        await new Promise(resolve => setTimeout(resolve, 1000));

        const clientAfterSecondJoin = getClient();
        const duration = Date.now() - startTime;

        if (clientAfterSecondJoin?.connectionState === 'CONNECTED') {
            return {
                test,
                passed: true,
                message: 'Rejoined successfully without UID conflict',
                duration,
                details: {
                    uid: clientAfterSecondJoin.uid,
                    connectionState: clientAfterSecondJoin.connectionState
                }
            };
        } else {
            return {
                test,
                passed: false,
                message: `Rejoin failed, state: ${clientAfterSecondJoin?.connectionState}`,
                duration
            };
        }
    } catch (error: any) {
        // Check if it's a UID conflict error
        if (error.message && error.message.includes('UID_CONFLICT')) {
            return {
                test,
                passed: false,
                message: 'UID_CONFLICT error occurred on rejoin',
                details: { error: error.message }
            };
        }
        return {
            test,
            passed: false,
            message: `Error during test: ${error.message}`,
            details: { error: error.message }
        };
    }
};

/**
 * Test 4: Verify voice role assignment
 */
export const testVoiceRoleAssignment = (
    participants: Array<{
        userId: string;
        voiceRole: 'host' | 'speaker' | 'listener';
        memberRole?: string;
    }>,
    hostId: string | null
): VoiceChannelTestResult => {
    const test = 'Voice Role Assignment';

    if (!participants || participants.length === 0) {
        return {
            test,
            passed: false,
            message: 'No participants found'
        };
    }

    // Verify there is exactly one host
    const hosts = participants.filter(p => p.voiceRole === 'host');
    if (hosts.length !== 1) {
        return {
            test,
            passed: false,
            message: `Expected exactly 1 host, found ${hosts.length}`,
            details: { hosts: hosts.map(h => h.userId) }
        };
    }

    // Verify host matches hostId
    if (hostId && hosts[0].userId !== hostId) {
        return {
            test,
            passed: false,
            message: `Host mismatch: voiceRole host is ${hosts[0].userId}, but hostId is ${hostId}`,
            details: { hostFromRole: hosts[0].userId, hostId }
        };
    }

    // Verify CU admins are speakers by default
    const cuAdmins = participants.filter(p => p.memberRole === 'subgrid_admin');
    const nonHostCuAdmins = cuAdmins.filter(p => p.voiceRole !== 'host');
    const cuAdminsSpeakers = nonHostCuAdmins.every(p => p.voiceRole === 'speaker');

    return {
        test,
        passed: cuAdminsSpeakers || nonHostCuAdmins.length === 0,
        message: cuAdminsSpeakers
            ? 'Voice roles correctly assigned (CU admins are speakers)'
            : 'Some CU admins are not speakers',
        details: {
            totalParticipants: participants.length,
            hosts: hosts.length,
            speakers: participants.filter(p => p.voiceRole === 'speaker').length,
            listeners: participants.filter(p => p.voiceRole === 'listener').length,
            cuAdmins: cuAdmins.length
        }
    };
};

/**
 * Test 5: Verify wave to speak functionality
 */
export const testWaveToSpeak = async (
    waveFn: () => Promise<void>,
    cancelWaveFn: () => Promise<void>,
    getIsHandRaised: () => boolean
): Promise<VoiceChannelTestResult> => {
    const test = 'Wave to Speak';
    const startTime = Date.now();

    try {
        const initialState = getIsHandRaised();
        console.log('[VoiceChannelTest] Initial hand raised:', initialState);

        // If already raised, lower first
        if (initialState) {
            await cancelWaveFn();
            await new Promise(resolve => setTimeout(resolve, 300));
        }

        // Raise hand
        console.log('[VoiceChannelTest] Raising hand...');
        await waveFn();
        await new Promise(resolve => setTimeout(resolve, 300));

        const afterWave = getIsHandRaised();
        if (!afterWave) {
            return {
                test,
                passed: false,
                message: 'Hand should be raised after wave'
            };
        }

        // Lower hand
        console.log('[VoiceChannelTest] Lowering hand...');
        await cancelWaveFn();
        await new Promise(resolve => setTimeout(resolve, 300));

        const afterCancel = getIsHandRaised();
        const duration = Date.now() - startTime;

        if (afterCancel) {
            return {
                test,
                passed: false,
                message: 'Hand should be lowered after cancel',
                duration
            };
        }

        return {
            test,
            passed: true,
            message: 'Wave to speak functionality works correctly',
            duration
        };
    } catch (error: any) {
        return {
            test,
            passed: false,
            message: `Error during test: ${error.message}`,
            details: { error: error.message }
        };
    }
};

/**
 * Diagnostic function for voice channel state
 */
export const diagnoseVoiceChannelState = (state: {
    callState: string;
    participants: any[];
    hostId: string | null;
    myVoiceRole: string;
    isHandRaised: boolean;
    isMuted: boolean;
    error: string | null;
    client: any;
}) => {
    console.log('=== Voice Channel State Diagnostic ===');
    console.log('Call State:', state.callState);
    console.log('Total Participants:', state.participants?.length || 0);
    console.log('Host ID:', state.hostId);
    console.log('My Voice Role:', state.myVoiceRole);
    console.log('Is Hand Raised:', state.isHandRaised);
    console.log('Is Muted:', state.isMuted);
    console.log('Error:', state.error);

    if (state.client) {
        console.log('--- Agora Client ---');
        console.log('Connection State:', state.client.connectionState);
        console.log('Local UID:', state.client.uid);
        console.log('Remote Users:', state.client.remoteUsers?.map((u: any) => u.uid) || []);
    }

    if (state.participants?.length > 0) {
        console.log('--- Participants ---');
        const grouped = {
            hosts: state.participants.filter(p => p.voiceRole === 'host'),
            speakers: state.participants.filter(p => p.voiceRole === 'speaker'),
            listeners: state.participants.filter(p => p.voiceRole === 'listener')
        };
        console.log('Hosts:', grouped.hosts.map(p => ({ id: p.userId, name: p.displayName })));
        console.log('Speakers:', grouped.speakers.map(p => ({ id: p.userId, name: p.displayName })));
        console.log('Listeners:', grouped.listeners.map(p => ({ id: p.userId, name: p.displayName })));
    }

    console.log('=====================================');

    return {
        callState: state.callState,
        isConnected: state.callState === 'connected',
        participantCount: state.participants?.length || 0,
        hasHost: !!state.hostId,
        myRole: state.myVoiceRole,
        clientState: state.client?.connectionState,
        error: state.error
    };
};

/**
 * Run voice channel connection tests
 */
export const runVoiceChannelConnectionTests = async (config: {
    getClient: () => any;
    joinFn?: () => Promise<void>;
    leaveFn?: () => Promise<void>;
}): Promise<VoiceChannelTestReport> => {
    console.log('[VoiceChannelTest] Starting voice channel connection tests...');
    const results: VoiceChannelTestResult[] = [];

    // Test 1: Client state
    console.log('[VoiceChannelTest] Running Test 1: Client Connection State');
    const stateResult = testClientConnectionState(config.getClient());
    results.push(stateResult);

    // Test 2 & 3: Join/Leave and UID Conflict (only if join/leave functions provided)
    if (config.joinFn && config.leaveFn) {
        await new Promise(resolve => setTimeout(resolve, 500));

        console.log('[VoiceChannelTest] Running Test 2: Join/Leave Cycle');
        const joinLeaveResult = await testChannelJoinLeave(
            config.joinFn,
            config.leaveFn,
            config.getClient
        );
        results.push(joinLeaveResult);

        await new Promise(resolve => setTimeout(resolve, 500));

        console.log('[VoiceChannelTest] Running Test 3: No UID Conflict on Rejoin');
        const uidConflictResult = await testNoUidConflictOnRejoin(
            config.joinFn,
            config.leaveFn,
            config.getClient
        );
        results.push(uidConflictResult);
    }

    const report: VoiceChannelTestReport = {
        timestamp: new Date().toISOString(),
        totalTests: results.length,
        passed: results.filter(r => r.passed).length,
        failed: results.filter(r => !r.passed).length,
        results
    };

    console.log('[VoiceChannelTest] Test Report:', report);
    return report;
};

export default {
    testClientConnectionState,
    testChannelJoinLeave,
    testNoUidConflictOnRejoin,
    testVoiceRoleAssignment,
    testWaveToSpeak,
    diagnoseVoiceChannelState,
    runVoiceChannelConnectionTests
};
