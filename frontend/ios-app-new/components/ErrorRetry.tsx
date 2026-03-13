import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { AlertCircle, RefreshCw } from 'lucide-react-native';
import { useTheme } from '../lib/theme';

interface ErrorRetryProps {
    message?: string;
    onRetry: () => void;
    loading?: boolean;
}

export const ErrorRetry: React.FC<ErrorRetryProps> = ({ message = 'Something went wrong', onRetry, loading }) => {
    const { colors } = useTheme();
    return (
        <View style={styles.container}>
            <AlertCircle size={32} color={colors.textMuted} />
            <Text style={[styles.message, { color: colors.textMuted }]}>{message}</Text>
            <TouchableOpacity style={[styles.button, { backgroundColor: colors.primary }]} onPress={onRetry} disabled={loading}>
                {loading ? <ActivityIndicator size="small" color="#fff" /> : (
                    <>
                        <RefreshCw size={16} color="#fff" />
                        <Text style={styles.buttonText}>Try Again</Text>
                    </>
                )}
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, gap: 12 },
    message: { fontSize: 15, textAlign: 'center' },
    button: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
    buttonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
});
