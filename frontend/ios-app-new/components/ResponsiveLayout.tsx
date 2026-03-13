import React, { useMemo, useState } from 'react';
import {
    View,
    StyleSheet,
    TouchableOpacity,
    Platform,
    Modal,
    Text,
    useWindowDimensions
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import Sidebar from './Sidebar';
import { Menu } from 'lucide-react-native';
import { useTheme } from '../lib/theme';

// Simple hook to detect screen width (simplified for basic responsive check)
// In a real app, use useWindowDimensions()
const isWeb = Platform.OS === 'web';

interface LayoutProps {
    children: React.ReactNode;
    title?: string;
    action?: React.ReactNode;
}

const ResponsiveLayout = ({ children, title, action }: LayoutProps) => {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const { width } = useWindowDimensions();
    const isDesktop = width > 768; // Simple breakpoint
    const { colors } = useTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);

    const TheGrydLogoSmall = () => (
        <Image source={require('../assets/icon.png')} style={{ width: 28, height: 28, borderRadius: 6 }} />
    );

    return (
        <View style={styles.container}>
            {/* Desktop: Sidebar is always visible on left */}
            {isDesktop && isWeb && (
                <View style={styles.sidebarWrapper}>
                    <Sidebar />
                </View>
            )}

            {/* Main Content Area */}
            <View style={styles.mainContent}>
                {/* Mobile/Tablet Header */}
                {(!isDesktop || !isWeb) && (
                    <SafeAreaView edges={['top']} style={styles.mobileHeaderSafe}>
                        <View style={styles.mobileHeader}>
                            <View style={styles.headerLeft}>
                                <TheGrydLogoSmall />
                                <Text style={styles.headerBrand}>THE GRYD</Text>
                            </View>
                            <TouchableOpacity
                                style={styles.menuBtn}
                                onPress={() => setSidebarOpen(true)}
                            >
                                <Menu size={24} color={colors.text} />
                                <Text style={styles.menuText}>Menu</Text>
                            </TouchableOpacity>
                        </View>
                    </SafeAreaView>
                )}

                {/* Content Slot */}
                <View style={styles.contentScroll}>
                    {children}
                </View>
            </View>

            {/* Mobile Sidebar Overlay (Modal for simplicity & z-index safety) */}
            <Modal
                visible={sidebarOpen}
                animationType="fade"
                transparent={true}
                onRequestClose={() => setSidebarOpen(false)}
            >
                <View style={styles.overlay}>
                    <TouchableOpacity
                        style={styles.backdrop}
                        activeOpacity={1}
                        onPress={() => setSidebarOpen(false)}
                    />
                    <View style={styles.drawer}>
                        <Sidebar
                            isMobile={true}
                            onClose={() => setSidebarOpen(false)}
                        />
                    </View>
                </View>
            </Modal>
        </View>
    );
};

const createStyles = (colors: ReturnType<typeof useTheme>['colors']) =>
    StyleSheet.create({
    container: {
        flex: 1,
        flexDirection: 'row',
        backgroundColor: colors.appBg,
    },
    sidebarWrapper: {
        width: 280,
        height: '100%',
        borderRightWidth: 1,
        borderColor: colors.border,
    },
    mainContent: {
        flex: 1,
        height: '100%',
        flexDirection: 'column',
    },
    mobileHeaderSafe: {
        backgroundColor: colors.appBg,
    },
    mobileHeader: {
        height: 60,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    headerBrand: {
        fontSize: 18,
        fontWeight: '900',
        letterSpacing: 2,
        color: colors.text,
    },
    menuBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: colors.surface,
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: colors.border,
    },
    menuText: {
        fontWeight: 'bold',
        fontSize: 14,
        color: colors.text,
    },
    logoContainer: {
        width: 28,
        height: 28,
    },
    contentScroll: {
        flex: 1,
    },
    // Overlay Drawer Styles
    overlay: {
        flex: 1,
        backgroundColor: colors.overlay,
        flexDirection: 'row',
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
    },
    drawer: {
        width: '80%',
        maxWidth: 320,
        height: '100%',
        backgroundColor: colors.surface,
        shadowColor: '#000',
        shadowOffset: { width: 2, height: 0 },
        shadowOpacity: 0.25,
        shadowRadius: 10,
        elevation: 16,
    },
});

export default ResponsiveLayout;

