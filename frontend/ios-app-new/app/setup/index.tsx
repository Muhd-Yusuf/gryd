import React, { useState, useEffect } from 'react';
import {
    StyleSheet,
    Text,
    View,
    TouchableOpacity,
    ActivityIndicator,
    TextInput,
    ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { validateSetupToken } from '../../lib/api';
import { useTheme } from '../../lib/theme';
import { GlassButton } from '../../components/glass';

export default function SetupScreen() {
    const router = useRouter();
    const params = useLocalSearchParams<{ token?: string; tenant?: string }>();
    const { colors } = useTheme();
    const styles = createStyles(colors);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [serverName, setServerName] = useState('');
    const [description, setDescription] = useState('');
    const [formError, setFormError] = useState('');
    const [setupData, setSetupData] = useState<{
        email: string;
        customerName: string;
        tenantId: string;
        subgridId: string | null;
        subgridName: string;
        logoUrl: string;
    } | null>(null);

    useEffect(() => {
        if (params.token && params.tenant) {
            validateToken();
        } else {
            setError('Invalid setup link. Missing required parameters.');
            setLoading(false);
        }
    }, [params.token, params.tenant]);

    const validateToken = async () => {
        try {
            const data = await validateSetupToken(params.token!, params.tenant!);
            setSetupData(data);
            setServerName(data.subgridName || '');
        } catch (err: any) {
            setError(err.message || 'Invalid or expired setup link');
        } finally {
            setLoading(false);
        }
    };

    const handleNext = () => {
        if (!serverName.trim()) {
            setFormError('Please enter a server name');
            return;
        }

        setFormError('');
        router.push({
            pathname: '/setup/server-icon',
            params: {
                token: params.token,
                tenant: params.tenant,
                email: setupData?.email || '',
                tenantId: setupData?.tenantId || '',
                subgridId: setupData?.subgridId || '',
                serverName: serverName.trim(),
                description: description.trim(),
            },
        });
    };

    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={colors.primary} />
                    <Text style={styles.loadingText}>Validating setup link...</Text>
                </View>
            </SafeAreaView>
        );
    }

    if (error || !setupData) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.errorContainer}>
                    <View style={styles.errorCard}>
                        <Text style={styles.errorTitle}>Invalid Setup Link</Text>
                        <Text style={styles.errorMessage}>{error || 'Unable to validate setup link'}</Text>
                        <GlassButton
                            label="Go to Login"
                            onPress={() => router.replace('/login')}
                            variant="primary"
                            size="md"
                        />
                    </View>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.headerTitle}>The Gryd Onboarding</Text>
            </View>

            <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.card}>
                    {/* Step Indicator */}
                    <View style={styles.stepRow}>
                        <View style={styles.stepItem}>
                            <View style={[styles.stepDot, styles.stepDotActive]} />
                            <Text style={[styles.stepLabel, styles.stepLabelActive]}>Profile Setup</Text>
                        </View>
                        <View style={styles.stepLine} />
                        <View style={styles.stepItem}>
                            <View style={styles.stepDot} />
                            <Text style={styles.stepLabel}>Profile Icon</Text>
                        </View>
                        <View style={styles.stepLine} />
                        <View style={styles.stepItem}>
                            <View style={styles.stepDot} />
                            <Text style={styles.stepLabel}>Preview Profile</Text>
                        </View>
                        <TouchableOpacity
                            style={styles.logoutButton}
                            onPress={() => router.replace('/login')}
                        >
                            <Text style={styles.logoutText}>Logout</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Form */}
                    <View style={styles.formContainer}>
                        <Text style={styles.title}>Choose your Server Name</Text>
                        <Text style={styles.subtitle}>How would you like to be addressed?</Text>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Full Name</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="RBFCU"
                                placeholderTextColor={colors.textSubtle}
                                value={serverName}
                                onChangeText={(text) => {
                                    setServerName(text);
                                    setFormError('');
                                }}
                            />
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Description</Text>
                            <TextInput
                                style={[styles.input, styles.textArea]}
                                placeholder="Describe server"
                                placeholderTextColor={colors.textSubtle}
                                value={description}
                                onChangeText={setDescription}
                                multiline
                                numberOfLines={4}
                                textAlignVertical="top"
                            />
                        </View>

                        {!!formError && (
                            <Text style={styles.errorText}>{formError}</Text>
                        )}

                        <GlassButton
                            label="Next"
                            onPress={handleNext}
                            variant="primary"
                            size="md"
                        />
                    </View>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const createStyles = (colors: ReturnType<typeof useTheme>['colors']) =>
    StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: 'transparent',
        },
        header: {
            backgroundColor: colors.glassBg,
            paddingVertical: 12,
            paddingHorizontal: 24,
        },
        headerTitle: {
            color: colors.text,
            fontSize: 14,
            fontWeight: '500',
        },
        loadingContainer: {
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            gap: 16,
        },
        loadingText: {
            color: colors.textMuted,
            fontSize: 14,
        },
        errorContainer: {
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            padding: 24,
        },
        errorCard: {
            backgroundColor: colors.glassBg,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.glassBorder,
            padding: 32,
            alignItems: 'center',
            maxWidth: 400,
            width: '100%',
        },
        errorTitle: {
            fontSize: 20,
            fontWeight: '600',
            color: colors.error,
            marginBottom: 12,
        },
        errorMessage: {
            fontSize: 14,
            color: colors.textMuted,
            marginBottom: 24,
            textAlign: 'center',
        },
        errorButton: {
            backgroundColor: colors.primary,
            borderRadius: 8,
            paddingVertical: 12,
            paddingHorizontal: 24,
        },
        errorButtonText: {
            color: colors.primaryText,
            fontSize: 14,
            fontWeight: '600',
        },
        scrollContent: {
            flexGrow: 1,
            justifyContent: 'center',
            padding: 24,
        },
        card: {
            backgroundColor: colors.glassBg,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.glassBorder,
            padding: 24,
            maxWidth: 500,
            width: '100%',
            alignSelf: 'center',
        },
        stepRow: {
            flexDirection: 'row',
            alignItems: 'center',
            marginBottom: 32,
            flexWrap: 'wrap',
            gap: 8,
        },
        stepItem: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
        },
        stepDot: {
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: colors.glassBorder,
        },
        stepDotActive: {
            backgroundColor: colors.primary,
        },
        stepLabel: {
            fontSize: 12,
            color: colors.textMuted,
        },
        stepLabelActive: {
            color: colors.text,
            fontWeight: '500',
        },
        stepLine: {
            width: 24,
            height: 1,
            backgroundColor: colors.glassBorder,
        },
        logoutButton: {
            marginLeft: 'auto',
            borderWidth: 1,
            borderColor: colors.glassBorder,
            borderRadius: 6,
            paddingVertical: 6,
            paddingHorizontal: 12,
        },
        logoutText: {
            fontSize: 12,
            color: colors.textMuted,
        },
        formContainer: {
            maxWidth: 320,
        },
        title: {
            fontSize: 18,
            fontWeight: '600',
            color: colors.text,
            marginBottom: 4,
        },
        subtitle: {
            fontSize: 13,
            color: colors.textMuted,
            marginBottom: 24,
        },
        inputGroup: {
            marginBottom: 20,
        },
        label: {
            fontSize: 13,
            fontWeight: '500',
            color: colors.text,
            marginBottom: 8,
        },
        input: {
            backgroundColor: colors.glassBg,
            borderWidth: 1,
            borderColor: colors.glassBorder,
            borderRadius: 8,
            paddingHorizontal: 12,
            paddingVertical: 10,
            fontSize: 14,
            color: colors.text,
        },
        textArea: {
            height: 100,
            paddingTop: 12,
        },
        errorText: {
            color: colors.error,
            fontSize: 13,
            marginBottom: 16,
        },
        button: {
            backgroundColor: colors.primary,
            borderRadius: 8,
            paddingVertical: 12,
            alignItems: 'center',
            width: 120,
        },
        buttonText: {
            color: colors.primaryText,
            fontSize: 14,
            fontWeight: '600',
        },
    });
