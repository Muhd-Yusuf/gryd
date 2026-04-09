import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AlertCircle } from 'lucide-react-native';
import { useTheme } from '../lib/theme';
import { GlassButton } from './glass';

interface ErrorRetryProps {
    message?: string;
    onRetry: () => void;
    loading?: boolean;
}

export const ErrorRetry: React.FC<ErrorRetryProps> = ({ message = 'Something went wrong', onRetry, loading }) => {
    const { colors } = useTheme();
    return (
        <View style={[styles.container, { backgroundColor: colors.glassBg, borderColor: colors.glassBorder }]}>
            <AlertCircle size={32} color={colors.dangerText} />
            <Text style={[styles.message, { color: colors.textMuted }]}>{message}</Text>
            <GlassButton label="Try Again" onPress={onRetry} loading={loading} variant="secondary" size="sm" />
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, gap: 14, borderRadius: 16, borderWidth: 1, margin: 16 },
    message: { fontSize: 15, textAlign: 'center' },
});
