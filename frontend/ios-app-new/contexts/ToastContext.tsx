import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Animated,
    TouchableOpacity,
    Platform,
} from 'react-native';
import {
    CheckCircle,
    AlertCircle,
    Info,
    XCircle,
    X,
    Bell,
    MessageSquare,
} from 'lucide-react-native';
import { useTheme } from '../lib/theme';

export type ToastType = 'success' | 'error' | 'warning' | 'info' | 'notification';

interface Toast {
    id: string;
    type: ToastType;
    title: string;
    message?: string;
    duration?: number;
    action?: {
        label: string;
        onPress: () => void;
    };
}

interface ToastContextValue {
    showToast: (toast: Omit<Toast, 'id'>) => void;
    hideToast: (id: string) => void;
    hideAllToasts: () => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
};

interface ToastProviderProps {
    children: React.ReactNode;
}

export const ToastProvider: React.FC<ToastProviderProps> = ({ children }) => {
    const { colors } = useTheme();
    const [toasts, setToasts] = useState<Toast[]>([]);
    const animatedValues = useRef<Map<string, Animated.Value>>(new Map());

    const showToast = useCallback((toast: Omit<Toast, 'id'>) => {
        const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const newToast: Toast = { ...toast, id };

        // Create animated value for this toast
        const animatedValue = new Animated.Value(0);
        animatedValues.current.set(id, animatedValue);

        setToasts(prev => [...prev, newToast]);

        // Animate in
        Animated.spring(animatedValue, {
            toValue: 1,
            useNativeDriver: true,
            tension: 50,
            friction: 8,
        }).start();

        // Auto-dismiss
        const duration = toast.duration ?? 4000;
        if (duration > 0) {
            setTimeout(() => {
                hideToast(id);
            }, duration);
        }
    }, []);

    const hideToast = useCallback((id: string) => {
        const animatedValue = animatedValues.current.get(id);
        if (animatedValue) {
            Animated.timing(animatedValue, {
                toValue: 0,
                duration: 200,
                useNativeDriver: true,
            }).start(() => {
                setToasts(prev => prev.filter(t => t.id !== id));
                animatedValues.current.delete(id);
            });
        } else {
            setToasts(prev => prev.filter(t => t.id !== id));
        }
    }, []);

    const hideAllToasts = useCallback(() => {
        toasts.forEach(toast => hideToast(toast.id));
    }, [toasts, hideToast]);

    const getToastConfig = (type: ToastType) => {
        switch (type) {
            case 'success':
                return {
                    icon: CheckCircle,
                    bgColor: '#10B981',
                    textColor: '#FFFFFF',
                };
            case 'error':
                return {
                    icon: XCircle,
                    bgColor: '#EF4444',
                    textColor: '#FFFFFF',
                };
            case 'warning':
                return {
                    icon: AlertCircle,
                    bgColor: '#F59E0B',
                    textColor: '#FFFFFF',
                };
            case 'info':
                return {
                    icon: Info,
                    bgColor: '#3B82F6',
                    textColor: '#FFFFFF',
                };
            case 'notification':
                return {
                    icon: Bell,
                    bgColor: colors.surface,
                    textColor: colors.text,
                    borderColor: colors.border,
                };
            default:
                return {
                    icon: Info,
                    bgColor: colors.surface,
                    textColor: colors.text,
                };
        }
    };

    const styles = createStyles(colors);

    return (
        <ToastContext.Provider value={{ showToast, hideToast, hideAllToasts }}>
            {children}
            <View style={styles.container} pointerEvents="box-none">
                {toasts.map((toast, index) => {
                    const config = getToastConfig(toast.type);
                    const Icon = config.icon;
                    const animatedValue = animatedValues.current.get(toast.id);

                    const animatedStyle = animatedValue ? {
                        opacity: animatedValue,
                        transform: [
                            {
                                translateY: animatedValue.interpolate({
                                    inputRange: [0, 1],
                                    outputRange: [-20, 0],
                                }),
                            },
                            {
                                scale: animatedValue.interpolate({
                                    inputRange: [0, 1],
                                    outputRange: [0.9, 1],
                                }),
                            },
                        ],
                    } : {};

                    return (
                        <Animated.View
                            key={toast.id}
                            style={[
                                styles.toast,
                                {
                                    backgroundColor: config.bgColor,
                                    borderColor: config.borderColor || 'transparent',
                                    borderWidth: config.borderColor ? 1 : 0,
                                },
                                animatedStyle,
                                { marginTop: index * 8 },
                            ]}
                        >
                            <View style={styles.toastContent}>
                                <Icon size={20} color={config.textColor} />
                                <View style={styles.toastText}>
                                    <Text style={[styles.toastTitle, { color: config.textColor }]}>
                                        {toast.title}
                                    </Text>
                                    {toast.message && (
                                        <Text style={[styles.toastMessage, { color: config.textColor }]} numberOfLines={2}>
                                            {toast.message}
                                        </Text>
                                    )}
                                </View>
                                {toast.action && (
                                    <TouchableOpacity
                                        style={styles.toastAction}
                                        onPress={() => {
                                            toast.action?.onPress();
                                            hideToast(toast.id);
                                        }}
                                    >
                                        <Text style={[styles.toastActionText, { color: config.textColor }]}>
                                            {toast.action.label}
                                        </Text>
                                    </TouchableOpacity>
                                )}
                                <TouchableOpacity
                                    style={styles.toastClose}
                                    onPress={() => hideToast(toast.id)}
                                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                >
                                    <X size={16} color={config.textColor} />
                                </TouchableOpacity>
                            </View>
                        </Animated.View>
                    );
                })}
            </View>
        </ToastContext.Provider>
    );
};

const createStyles = (colors: any) => StyleSheet.create({
    container: {
        position: 'absolute',
        top: Platform.OS === 'ios' ? 60 : 40,
        left: 16,
        right: 16,
        zIndex: 9999,
        alignItems: 'center',
    },
    toast: {
        maxWidth: 400,
        width: '100%',
        borderRadius: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 8,
    },
    toastContent: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 14,
        gap: 12,
    },
    toastText: {
        flex: 1,
    },
    toastTitle: {
        fontSize: 14,
        fontWeight: '600',
    },
    toastMessage: {
        fontSize: 13,
        marginTop: 2,
        opacity: 0.9,
    },
    toastAction: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 6,
        backgroundColor: 'rgba(255,255,255,0.2)',
    },
    toastActionText: {
        fontSize: 13,
        fontWeight: '600',
    },
    toastClose: {
        padding: 4,
        marginLeft: 4,
    },
});

export default ToastContext;
