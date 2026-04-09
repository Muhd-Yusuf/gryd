import React, { useMemo, useState, useEffect } from 'react';
import {
    StyleSheet,
    Text,
    View,
    TouchableOpacity,
    ScrollView,
    Switch,
    Alert,
    Platform,
    useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Shield, Eye, EyeOff, MessageSquare, UserPlus, Wifi } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../lib/theme';
import { usePrivacySettings, useUpdatePrivacySettings } from '../../hooks/queries';

type VisibilityOption = 'hidden' | 'friends_only' | 'public';
type DMOption = 'nobody' | 'friends_only' | 'everyone';
type FriendRequestOption = 'nobody' | 'members_only' | 'everyone';

const PrivacySettingsScreen = () => {
    const { colors } = useTheme();
    const { width } = useWindowDimensions();
    const styles = useMemo(() => createStyles(colors, width), [colors, width]);
    const router = useRouter();
    const navigation = useNavigation();

    const privacyQuery = usePrivacySettings();
    const updateMutation = useUpdatePrivacySettings();

    const [profileVisibility, setProfileVisibility] = useState<VisibilityOption>('hidden');
    const [allowDMsFrom, setAllowDMsFrom] = useState<DMOption>('friends_only');
    const [allowFriendRequestsFrom, setAllowFriendRequestsFrom] = useState<FriendRequestOption>('everyone');
    const [showOnlineStatus, setShowOnlineStatus] = useState(true);

    useEffect(() => {
        if (privacyQuery.data) {
            setProfileVisibility(privacyQuery.data.profileVisibility || 'hidden');
            setAllowDMsFrom(privacyQuery.data.allowDMsFrom || 'friends_only');
            setAllowFriendRequestsFrom(privacyQuery.data.allowFriendRequestsFrom || 'everyone');
            setShowOnlineStatus(privacyQuery.data.showOnlineStatus !== false);
        }
    }, [privacyQuery.data]);

    const handleUpdate = async (field: string, value: string | boolean) => {
        try {
            await updateMutation.mutateAsync({ [field]: value });
            const msg = 'Privacy settings updated';
            if (Platform.OS === 'web') {
                window.alert(msg);
            } else {
                Alert.alert('Success', msg);
            }
        } catch {
            const errMsg = 'Failed to update privacy settings';
            if (Platform.OS === 'web') {
                window.alert(errMsg);
            } else {
                Alert.alert('Error', errMsg);
            }
        }
    };

    const handleBack = () => {
        if (navigation.canGoBack()) {
            router.back();
        } else {
            router.push('/(main)/profile');
        }
    };

    const RadioOption = ({ label, description, selected, onPress }: {
        label: string;
        description: string;
        selected: boolean;
        onPress: () => void;
    }) => (
        <TouchableOpacity style={styles.radioRow} onPress={onPress} activeOpacity={0.7}>
            <View style={styles.radioContent}>
                <Text style={styles.radioLabel}>{label}</Text>
                <Text style={styles.radioDescription}>{description}</Text>
            </View>
            <View style={[styles.radioCircle, selected && styles.radioCircleSelected]}>
                {selected && <View style={styles.radioInner} />}
            </View>
        </TouchableOpacity>
    );

    return (
        <SafeAreaView style={styles.safe}>
            <View style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity style={styles.backButton} onPress={handleBack}>
                        <ArrowLeft size={24} color={colors.text} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Privacy & Safety</Text>
                    <View style={{ width: 40 }} />
                </View>

                <ScrollView
                    style={styles.content}
                    contentContainerStyle={styles.contentContainer}
                    showsVerticalScrollIndicator={false}
                >
                    {/* Info Banner */}
                    <View style={styles.infoBanner}>
                        <Shield size={20} color={colors.primary} />
                        <Text style={styles.infoBannerText}>
                            Control who can see your profile, send you messages, and add you as a friend. Admins can always see your information.
                        </Text>
                    </View>

                    {/* Profile Visibility */}
                    <View style={styles.section}>
                        <View style={styles.sectionHeader}>
                            <Eye size={18} color={colors.textMuted} />
                            <Text style={styles.sectionTitle}>Profile Visibility</Text>
                        </View>
                        <View style={styles.card}>
                            <RadioOption
                                label="Hidden"
                                description="Only people you approve (friends) can see your name and profile"
                                selected={profileVisibility === 'hidden'}
                                onPress={() => {
                                    setProfileVisibility('hidden');
                                    handleUpdate('profileVisibility', 'hidden');
                                }}
                            />
                            <View style={styles.divider} />
                            <RadioOption
                                label="Friends Only"
                                description="Only your friends can see your profile details"
                                selected={profileVisibility === 'friends_only'}
                                onPress={() => {
                                    setProfileVisibility('friends_only');
                                    handleUpdate('profileVisibility', 'friends_only');
                                }}
                            />
                            <View style={styles.divider} />
                            <RadioOption
                                label="Public"
                                description="Anyone in your communities can see your profile"
                                selected={profileVisibility === 'public'}
                                onPress={() => {
                                    setProfileVisibility('public');
                                    handleUpdate('profileVisibility', 'public');
                                }}
                            />
                        </View>
                    </View>

                    {/* Direct Messages */}
                    <View style={styles.section}>
                        <View style={styles.sectionHeader}>
                            <MessageSquare size={18} color={colors.textMuted} />
                            <Text style={styles.sectionTitle}>Direct Messages</Text>
                        </View>
                        <View style={styles.card}>
                            <RadioOption
                                label="Friends Only"
                                description="Only your friends can send you direct messages"
                                selected={allowDMsFrom === 'friends_only'}
                                onPress={() => {
                                    setAllowDMsFrom('friends_only');
                                    handleUpdate('allowDMsFrom', 'friends_only');
                                }}
                            />
                            <View style={styles.divider} />
                            <RadioOption
                                label="Everyone"
                                description="Anyone in your communities can message you"
                                selected={allowDMsFrom === 'everyone'}
                                onPress={() => {
                                    setAllowDMsFrom('everyone');
                                    handleUpdate('allowDMsFrom', 'everyone');
                                }}
                            />
                            <View style={styles.divider} />
                            <RadioOption
                                label="Nobody"
                                description="No one can send you direct messages"
                                selected={allowDMsFrom === 'nobody'}
                                onPress={() => {
                                    setAllowDMsFrom('nobody');
                                    handleUpdate('allowDMsFrom', 'nobody');
                                }}
                            />
                        </View>
                    </View>

                    {/* Friend Requests */}
                    <View style={styles.section}>
                        <View style={styles.sectionHeader}>
                            <UserPlus size={18} color={colors.textMuted} />
                            <Text style={styles.sectionTitle}>Friend Requests</Text>
                        </View>
                        <View style={styles.card}>
                            <RadioOption
                                label="Everyone"
                                description="Anyone can send you a friend request"
                                selected={allowFriendRequestsFrom === 'everyone'}
                                onPress={() => {
                                    setAllowFriendRequestsFrom('everyone');
                                    handleUpdate('allowFriendRequestsFrom', 'everyone');
                                }}
                            />
                            <View style={styles.divider} />
                            <RadioOption
                                label="Members Only"
                                description="Only regular members can add you (not business partners)"
                                selected={allowFriendRequestsFrom === 'members_only'}
                                onPress={() => {
                                    setAllowFriendRequestsFrom('members_only');
                                    handleUpdate('allowFriendRequestsFrom', 'members_only');
                                }}
                            />
                            <View style={styles.divider} />
                            <RadioOption
                                label="Nobody"
                                description="No one can send you friend requests"
                                selected={allowFriendRequestsFrom === 'nobody'}
                                onPress={() => {
                                    setAllowFriendRequestsFrom('nobody');
                                    handleUpdate('allowFriendRequestsFrom', 'nobody');
                                }}
                            />
                        </View>
                    </View>

                    {/* Online Status */}
                    <View style={styles.section}>
                        <View style={styles.sectionHeader}>
                            <Wifi size={18} color={colors.textMuted} />
                            <Text style={styles.sectionTitle}>Online Status</Text>
                        </View>
                        <View style={styles.card}>
                            <View style={styles.switchRow}>
                                <View style={styles.switchContent}>
                                    <Text style={styles.radioLabel}>Show Online Status</Text>
                                    <Text style={styles.radioDescription}>
                                        Let others see when you're online
                                    </Text>
                                </View>
                                <Switch
                                    value={showOnlineStatus}
                                    onValueChange={(value) => {
                                        setShowOnlineStatus(value);
                                        handleUpdate('showOnlineStatus', value);
                                    }}
                                    trackColor={{ false: colors.glassBorder, true: colors.primary }}
                                    thumbColor="#FFFFFF"
                                />
                            </View>
                        </View>
                    </View>
                </ScrollView>
            </View>
        </SafeAreaView>
    );
};

const createStyles = (colors: ReturnType<typeof import('../../lib/theme').useTheme>['colors'], width: number) =>
    StyleSheet.create({
        safe: {
            flex: 1,
            backgroundColor: 'transparent',
        },
        container: {
            flex: 1,
        },
        header: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 16,
            paddingVertical: 12,
            borderBottomWidth: 1,
            borderBottomColor: colors.glassBorder,
            backgroundColor: colors.glassBg,
        },
        backButton: {
            width: 40,
            height: 40,
            borderRadius: 20,
            alignItems: 'center',
            justifyContent: 'center',
        },
        headerTitle: {
            fontSize: 18,
            fontWeight: '700',
            color: colors.text,
        },
        content: {
            flex: 1,
        },
        contentContainer: {
            padding: 16,
            paddingBottom: 40,
            gap: 24,
        },
        infoBanner: {
            flexDirection: 'row',
            backgroundColor: colors.glassBg,
            borderRadius: 12,
            padding: 16,
            gap: 12,
            borderWidth: 1,
            borderColor: colors.primary,
            alignItems: 'flex-start',
        },
        infoBannerText: {
            flex: 1,
            fontSize: 13,
            color: colors.textMuted,
            lineHeight: 18,
        },
        section: {
            gap: 10,
        },
        sectionHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            marginLeft: 4,
        },
        sectionTitle: {
            fontSize: 14,
            fontWeight: '600',
            color: colors.textMuted,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
        },
        card: {
            backgroundColor: colors.glassBg,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: colors.glassBorder,
            overflow: 'hidden',
        },
        radioRow: {
            flexDirection: 'row',
            alignItems: 'center',
            padding: 16,
            gap: 12,
        },
        radioContent: {
            flex: 1,
            gap: 2,
        },
        radioLabel: {
            fontSize: 15,
            fontWeight: '600',
            color: colors.text,
        },
        radioDescription: {
            fontSize: 13,
            color: colors.textMuted,
            lineHeight: 18,
        },
        radioCircle: {
            width: 22,
            height: 22,
            borderRadius: 11,
            borderWidth: 2,
            borderColor: colors.glassBorder,
            alignItems: 'center',
            justifyContent: 'center',
        },
        radioCircleSelected: {
            borderColor: colors.primary,
        },
        radioInner: {
            width: 12,
            height: 12,
            borderRadius: 6,
            backgroundColor: colors.primary,
        },
        switchRow: {
            flexDirection: 'row',
            alignItems: 'center',
            padding: 16,
            gap: 12,
        },
        switchContent: {
            flex: 1,
            gap: 2,
        },
        divider: {
            height: 1,
            backgroundColor: colors.glassBorder,
            marginLeft: 16,
        },
    });

export default PrivacySettingsScreen;
