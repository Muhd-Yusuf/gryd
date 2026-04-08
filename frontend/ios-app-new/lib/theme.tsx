import React, { createContext, useContext, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';

export type ThemeMode = 'light' | 'dark';

// Original colors preserved exactly — glass effect comes from
// semi-transparent surface + GradientBackground behind everything,
// NOT from changing text/primary/border colors.
export const lightColors = {
    appBg: 'transparent',           // gradient shows through
    surface: 'rgba(255,255,255,0.75)',
    surfaceMuted: 'rgba(243,244,246,0.72)',
    surfaceHover: 'rgba(249,250,251,0.72)',
    cardBg: 'rgba(255,255,255,0.75)',
    text: '#111827',
    textMuted: '#6B7280',
    textSubtle: '#9CA3AF',
    border: '#E5E7EB',
    icon: '#6B7280',
    primary: '#111827',
    primaryText: '#FFFFFF',
    sidebarBg: '#000000',
    sidebarText: '#E5E7EB',
    sidebarTextMuted: '#CBD5F5',
    sidebarActiveBg: '#FFFFFF',
    sidebarActiveText: '#111827',
    overlay: 'rgba(0,0,0,0.5)',
    successBg: '#DCFCE7',
    successText: '#16A34A',
    warningBg: '#FEF3C7',
    warningText: '#D97706',
    dangerBg: '#FEE2E2',
    dangerText: '#DC2626',
    error: '#EF4444',
    // Glass tokens
    glassBg: 'rgba(255,255,255,0.55)',
    glassBorder: 'rgba(255,255,255,0.85)',
    glassShadow: 'rgba(0,0,0,0.08)',
    glassBlurIntensity: 28,
    glassNavBg: 'rgba(255,255,255,0.68)',
    glassNavBorder: 'rgba(255,255,255,0.90)',
    glassActiveBg: 'rgba(17,24,39,0.90)',
    glassActiveText: '#FFFFFF',
    gradientStart: '#E2E8F8',
    gradientEnd: '#EEF2FF',
    metallicShimmer: ['rgba(255,255,255,0)', 'rgba(255,255,255,0.75)', 'rgba(255,255,255,0)'] as string[],
};

export const darkColors: typeof lightColors = {
    appBg: 'transparent',           // gradient shows through
    surface: 'rgba(26,26,26,0.82)', // original #1A1A1A but semi-transparent
    surfaceMuted: 'rgba(36,36,36,0.80)',
    surfaceHover: 'rgba(42,42,42,0.80)',
    cardBg: 'rgba(26,26,26,0.82)',
    text: '#FFFFFF',
    textMuted: '#A1A1A1',
    textSubtle: '#6B6B6B',
    border: '#2E2E2E',
    icon: '#A1A1A1',
    primary: '#3B82F6',
    primaryText: '#FFFFFF',
    sidebarBg: '#141414',
    sidebarText: '#FFFFFF',
    sidebarTextMuted: '#A1A1A1',
    sidebarActiveBg: '#3B82F6',
    sidebarActiveText: '#FFFFFF',
    overlay: 'rgba(0,0,0,0.8)',
    successBg: '#1F2E22',
    successText: '#86EFAC',
    warningBg: '#2A2116',
    warningText: '#FCD34D',
    dangerBg: '#2B1717',
    dangerText: '#FCA5A5',
    error: '#EF4444',
    // Glass tokens
    glassBg: 'rgba(26,26,26,0.70)',
    glassBorder: 'rgba(255,255,255,0.08)',
    glassShadow: 'rgba(0,0,0,0.5)',
    glassBlurIntensity: 30,
    glassNavBg: 'rgba(20,20,20,0.78)',
    glassNavBorder: 'rgba(255,255,255,0.06)',
    glassActiveBg: 'rgba(59,130,246,0.90)',
    glassActiveText: '#FFFFFF',
    gradientStart: '#0D0D0D',
    gradientEnd: '#111111',
    metallicShimmer: ['rgba(255,255,255,0)', 'rgba(255,255,255,0.12)', 'rgba(255,255,255,0)'] as string[],
};

type ThemeContextValue = {
    mode: ThemeMode;
    colors: typeof lightColors;
    toggleTheme: () => void;
    setTheme: (mode: ThemeMode) => void;
};

const ThemeContext = createContext<ThemeContextValue>({
    mode: 'light',
    colors: lightColors,
    toggleTheme: () => {},
    setTheme: () => {},
});

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
    const systemScheme = useColorScheme();
    const [mode, setMode] = useState<ThemeMode>(systemScheme === 'dark' ? 'dark' : 'light');

    const colors = mode === 'dark' ? darkColors : lightColors;
    const toggleTheme = () => setMode((prev) => (prev === 'dark' ? 'light' : 'dark'));

    const value = useMemo(
        () => ({
            mode,
            colors,
            toggleTheme,
            setTheme: setMode,
        }),
        [mode, colors]
    );

    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => useContext(ThemeContext);
