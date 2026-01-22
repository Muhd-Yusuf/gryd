import React, { useState, useEffect } from 'react';
import {
    StyleSheet,
    Text,
    View,
    TouchableOpacity,
    ActivityIndicator,
    ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { getUserSubgrids, StakeholderBadge } from '../../lib/api';

const BADGE_COLORS: Record<StakeholderBadge, string> = {
    stakeholder: '#3B82F6',
    vendor: '#8B5CF6',
    partner: '#10B981',
    sponsor: '#F59E0B',
    investor: '#EC4899',
};

interface Subgrid {
    id: string;
    name: string;
    clientName?: string;
    logoUrl?: string;
    memberCount?: number;
}

export default function StakeholderWelcomeScreen() {
    const router = useRouter();
    const params = useLocalSearchParams<{
        userId: string;
        firstName: string;
        lastName: string;
        email: string;
        stakeholderBadge: string;
    }>();

    const [loading, setLoading] = useState(true);
    const [subgrids, setSubgrids] = useState<Subgrid[]>([]);
    const [selectedSubgrid, setSelectedSubgrid] = useState<Subgrid | null>(null);
    const [error, setError] = useState('');

    useEffect(() => {
        fetchUserSubgrids();
    }, []);

    const fetchUserSubgrids = async () => {
        try {
            // Fetch subgrids the user has access to
            const result = await getUserSubgrids();
            const userSubgrids = result.subgrids || [];

            setSubgrids(userSubgrids);

            // Auto-select first subgrid if only one
            if (userSubgrids.length === 1) {
                setSelectedSubgrid(userSubgrids[0]);
            }
        } catch (err: any) {
            setError(err.message || 'Failed to load servers');
        } finally {
            setLoading(false);
        }
    };

    const getInitials = (name: string) => {
        return name
            .split(' ')
            .map(n => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);
    };

    const getBadgeLabel = (badge: string) => {
        return badge.charAt(0).toUpperCase() + badge.slice(1);
    };

    const getBadgeColor = (badge: string) => {
        return BADGE_COLORS[badge as StakeholderBadge] || '#3B82F6';
    };

    const handleContinue = () => {
        if (!selectedSubgrid) {
            setError('Please select a server to continue');
            return;
        }

        // Navigate to main app
        router.replace('/(main)');
    };

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <View style={styles.logoContainer}>
                    <Text style={styles.logoText}>THE GRYD</Text>
                </View>
                {/* Step indicator - step 3 of 3 (all completed) */}
                <View style={styles.stepIndicator}>
                    <View style={[styles.step, styles.stepCompleted]} />
                    <View style={[styles.stepLine, styles.stepLineCompleted]} />
                    <View style={[styles.step, styles.stepCompleted]} />
                    <View style={[styles.stepLine, styles.stepLineCompleted]} />
                    <View style={[styles.step, styles.stepActive]} />
                </View>
                <TouchableOpacity
                    style={styles.logoutButton}
                    onPress={() => router.replace('/login')}
                >
                    <Text style={styles.logoutText}>Logout</Text>
                </TouchableOpacity>
            </View>

            <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.card}>
                    <Text style={styles.title}>Welcome Back!</Text>
                    <Text style={styles.subtitle}>
                        Select a server to continue
                    </Text>

                    {/* User Info Section */}
                    <View style={styles.userSection}>
                        <View style={styles.userAvatar}>
                            <Text style={styles.userAvatarText}>
                                {getInitials(`${params.firstName} ${params.lastName}`)}
                            </Text>
                        </View>
                        <View style={styles.userInfo}>
                            <Text style={styles.userName}>
                                {params.firstName} {params.lastName}
                            </Text>
                            <Text style={styles.userEmail}>{params.email}</Text>
                        </View>
                        {params.stakeholderBadge && (
                            <View style={[styles.badge, { backgroundColor: getBadgeColor(params.stakeholderBadge) }]}>
                                <Text style={styles.badgeText}>
                                    {getBadgeLabel(params.stakeholderBadge)}
                                </Text>
                            </View>
                        )}
                    </View>

                    {/* Server Selection */}
                    {loading ? (
                        <View style={styles.loadingContainer}>
                            <ActivityIndicator size="large" color="#3B82F6" />
                            <Text style={styles.loadingText}>Loading servers...</Text>
                        </View>
                    ) : subgrids.length === 0 ? (
                        <View style={styles.emptyContainer}>
                            <Text style={styles.emptyTitle}>No Servers Found</Text>
                            <Text style={styles.emptyText}>
                                You haven't been added to any servers yet.
                                Contact your Credit Union administrator for access.
                            </Text>
                        </View>
                    ) : (
                        <View style={styles.serverList}>
                            <Text style={styles.serverListTitle}>Your Servers</Text>
                            {subgrids.map((subgrid) => (
                                <TouchableOpacity
                                    key={subgrid.id}
                                    style={[
                                        styles.serverCard,
                                        selectedSubgrid?.id === subgrid.id && styles.serverCardSelected,
                                    ]}
                                    onPress={() => setSelectedSubgrid(subgrid)}
                                >
                                    {/* Server Avatar with Pink Header */}
                                    <View style={styles.serverAvatarWrapper}>
                                        <View style={styles.serverAvatarHeader} />
                                        <View style={styles.serverAvatar}>
                                            <Text style={styles.serverAvatarText}>
                                                {getInitials(subgrid.name)}
                                            </Text>
                                        </View>
                                    </View>
                                    <View style={styles.serverInfo}>
                                        <Text style={styles.serverName}>{subgrid.name}</Text>
                                        {subgrid.clientName && (
                                            <Text style={styles.serverClient}>{subgrid.clientName}</Text>
                                        )}
                                        {subgrid.memberCount !== undefined && (
                                            <Text style={styles.serverMembers}>
                                                {subgrid.memberCount} members
                                            </Text>
                                        )}
                                    </View>
                                    {selectedSubgrid?.id === subgrid.id && (
                                        <View style={styles.checkmark}>
                                            <Text style={styles.checkmarkText}>✓</Text>
                                        </View>
                                    )}
                                </TouchableOpacity>
                            ))}
                        </View>
                    )}

                    {!!error && (
                        <View style={styles.errorContainer}>
                            <Text style={styles.errorText}>{error}</Text>
                        </View>
                    )}

                    <TouchableOpacity
                        style={[
                            styles.button,
                            (!selectedSubgrid || loading) && styles.buttonDisabled,
                        ]}
                        onPress={handleContinue}
                        disabled={!selectedSubgrid || loading}
                    >
                        <Text style={styles.buttonText}>Continue to Server</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#1F2937',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 24,
        paddingVertical: 16,
    },
    logoContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    logoText: {
        fontSize: 18,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    stepIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    step: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: 'rgba(255,255,255,0.3)',
    },
    stepActive: {
        backgroundColor: '#3B82F6',
    },
    stepCompleted: {
        backgroundColor: '#22C55E',
    },
    stepLine: {
        width: 20,
        height: 2,
        backgroundColor: 'rgba(255,255,255,0.2)',
    },
    stepLineCompleted: {
        backgroundColor: '#22C55E',
    },
    logoutButton: {
        backgroundColor: 'rgba(255,255,255,0.1)',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 8,
    },
    logoutText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '500',
    },
    scrollContent: {
        flexGrow: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    card: {
        width: '100%',
        maxWidth: 500,
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 32,
    },
    title: {
        fontSize: 26,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 15,
        color: '#6B7280',
        marginBottom: 24,
    },
    userSection: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F9FAFB',
        borderRadius: 12,
        padding: 16,
        marginBottom: 24,
        gap: 12,
    },
    userAvatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#E5E7EB',
        justifyContent: 'center',
        alignItems: 'center',
    },
    userAvatarText: {
        fontSize: 18,
        fontWeight: '600',
        color: '#6B7280',
    },
    userInfo: {
        flex: 1,
    },
    userName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#111827',
    },
    userEmail: {
        fontSize: 13,
        color: '#6B7280',
    },
    badge: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
    },
    badgeText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '600',
    },
    loadingContainer: {
        alignItems: 'center',
        padding: 32,
    },
    loadingText: {
        marginTop: 12,
        fontSize: 14,
        color: '#6B7280',
    },
    emptyContainer: {
        alignItems: 'center',
        padding: 24,
        backgroundColor: '#FEF2F2',
        borderRadius: 12,
        marginBottom: 24,
    },
    emptyTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#991B1B',
        marginBottom: 8,
    },
    emptyText: {
        fontSize: 14,
        color: '#B91C1C',
        textAlign: 'center',
    },
    serverList: {
        marginBottom: 24,
    },
    serverListTitle: {
        fontSize: 14,
        fontWeight: '500',
        color: '#6B7280',
        marginBottom: 12,
    },
    serverCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F9FAFB',
        borderWidth: 2,
        borderColor: '#E5E7EB',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        gap: 16,
    },
    serverCardSelected: {
        borderColor: '#3B82F6',
        backgroundColor: '#EFF6FF',
    },
    serverAvatarWrapper: {
        width: 56,
        height: 56,
        position: 'relative',
    },
    serverAvatarHeader: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 20,
        backgroundColor: '#EC4899',
        borderTopLeftRadius: 8,
        borderTopRightRadius: 8,
    },
    serverAvatar: {
        position: 'absolute',
        bottom: 0,
        left: 4,
        right: 4,
        height: 44,
        backgroundColor: '#FFFFFF',
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    serverAvatarText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#6B7280',
    },
    serverInfo: {
        flex: 1,
    },
    serverName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#111827',
    },
    serverClient: {
        fontSize: 13,
        color: '#6B7280',
        marginTop: 2,
    },
    serverMembers: {
        fontSize: 12,
        color: '#9CA3AF',
        marginTop: 2,
    },
    checkmark: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: '#3B82F6',
        justifyContent: 'center',
        alignItems: 'center',
    },
    checkmarkText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
    errorContainer: {
        backgroundColor: '#FEF2F2',
        padding: 12,
        borderRadius: 12,
        marginBottom: 16,
    },
    errorText: {
        color: '#EF4444',
        fontSize: 14,
        textAlign: 'center',
    },
    button: {
        backgroundColor: '#3B82F6',
        borderRadius: 30,
        paddingVertical: 16,
        alignItems: 'center',
    },
    buttonDisabled: {
        opacity: 0.5,
    },
    buttonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
});
