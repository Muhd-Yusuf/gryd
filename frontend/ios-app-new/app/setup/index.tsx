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

export default function SetupScreen() {
    const router = useRouter();
    const params = useLocalSearchParams<{ token?: string; tenant?: string }>();

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
                    <ActivityIndicator size="large" color="#000000" />
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
                        <TouchableOpacity
                            style={styles.errorButton}
                            onPress={() => router.replace('/login')}
                        >
                            <Text style={styles.errorButtonText}>Go to Login</Text>
                        </TouchableOpacity>
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
                                placeholderTextColor="#9CA3AF"
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
                                placeholderTextColor="#9CA3AF"
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

                        <TouchableOpacity
                            style={styles.button}
                            onPress={handleNext}
                        >
                            <Text style={styles.buttonText}>Next</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F5F5F5',
    },
    header: {
        backgroundColor: '#000000',
        paddingVertical: 12,
        paddingHorizontal: 24,
    },
    headerTitle: {
        color: '#FFFFFF',
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
        color: '#6B7280',
        fontSize: 14,
    },
    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    errorCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 32,
        alignItems: 'center',
        maxWidth: 400,
        width: '100%',
    },
    errorTitle: {
        fontSize: 20,
        fontWeight: '600',
        color: '#EF4444',
        marginBottom: 12,
    },
    errorMessage: {
        fontSize: 14,
        color: '#6B7280',
        marginBottom: 24,
        textAlign: 'center',
    },
    errorButton: {
        backgroundColor: '#000000',
        borderRadius: 8,
        paddingVertical: 12,
        paddingHorizontal: 24,
    },
    errorButtonText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '600',
    },
    scrollContent: {
        flexGrow: 1,
        justifyContent: 'center',
        padding: 24,
    },
    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
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
        backgroundColor: '#E5E7EB',
    },
    stepDotActive: {
        backgroundColor: '#000000',
    },
    stepLabel: {
        fontSize: 12,
        color: '#9CA3AF',
    },
    stepLabelActive: {
        color: '#000000',
        fontWeight: '500',
    },
    stepLine: {
        width: 24,
        height: 1,
        backgroundColor: '#E5E7EB',
    },
    logoutButton: {
        marginLeft: 'auto',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 6,
        paddingVertical: 6,
        paddingHorizontal: 12,
    },
    logoutText: {
        fontSize: 12,
        color: '#374151',
    },
    formContainer: {
        maxWidth: 320,
    },
    title: {
        fontSize: 18,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 4,
    },
    subtitle: {
        fontSize: 13,
        color: '#6B7280',
        marginBottom: 24,
    },
    inputGroup: {
        marginBottom: 20,
    },
    label: {
        fontSize: 13,
        fontWeight: '500',
        color: '#374151',
        marginBottom: 8,
    },
    input: {
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 10,
        fontSize: 14,
        color: '#111827',
    },
    textArea: {
        height: 100,
        paddingTop: 12,
    },
    errorText: {
        color: '#EF4444',
        fontSize: 13,
        marginBottom: 16,
    },
    button: {
        backgroundColor: '#000000',
        borderRadius: 8,
        paddingVertical: 12,
        alignItems: 'center',
        width: 120,
    },
    buttonText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '600',
    },
});
