import React, { createContext, useContext, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';

export type ThemeMode = 'light' | 'dark';

export const lightColors = {
    appBg: '#F0F2F5',
    surface: '#FFFFFF',
    surfaceMuted: '#F3F4F6',
    surfaceHover: '#F9FAFB',
    cardBg: '#FFFFFF',
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
    glassBorder: 'rgba(255,255,255,0.75)',
    glassShadow: 'rgba(0,0,0,0.08)',
    glassBlurIntensity: 24,
    glassNavBg: 'rgba(255,255,255,0.72)',
    glassNavBorder: 'rgba(255,255,255,0.9)',
    glassActiveBg: 'rgba(17,24,39,0.9)',
    glassActiveText: '#FFFFFF',
    gradientStart: '#E8ECF4',
    gradientEnd: '#F5F7FA',
    metallicShimmer: ['rgba(255,255,255,0)', 'rgba(255,255,255,0.7)', 'rgba(255,255,255,0)'] as string[],
};

export const darkColors: typeof lightColors = {
    appBg: '#0A0A0F',
    surface: '#1A1A2E',
    surfaceMuted: '#16213E',
    surfaceHover: '#1F2B47',
    cardBg: '#1A1A2E',
    text: '#FFFFFF',
    textMuted: '#A1A1AA',
    textSubtle: '#6B6B7B',
    border: '#2E2E3E',
    icon: '#A1A1AA',
    primary: '#6366F1',
    primaryText: '#FFFFFF',
    sidebarBg: '#0D0D1A',
    sidebarText: '#FFFFFF',
    sidebarTextMuted: '#A1A1AA',
    sidebarActiveBg: '#6366F1',
    sidebarActiveText: '#FFFFFF',
    overlay: 'rgba(0,0,0,0.85)',
    successBg: '#1F2E22',
    successText: '#86EFAC',
    warningBg: '#2A2116',
    warningText: '#FCD34D',
    dangerBg: '#2B1717',
    dangerText: '#FCA5A5',
    error: '#EF4444',
    // Glass tokens
    glassBg: 'rgba(30,30,60,0.55)',
    glassBorder: 'rgba(255,255,255,0.10)',
    glassShadow: 'rgba(0,0,0,0.4)',
    glassBlurIntensity: 28,
    glassNavBg: 'rgba(15,15,35,0.75)',
    glassNavBorder: 'rgba(255,255,255,0.08)',
    glassActiveBg: 'rgba(99,102,241,0.85)',
    glassActiveText: '#FFFFFF',
    gradientStart: '#0A0A1A',
    gradientEnd: '#0D0D2E',
    metallicShimmer: ['rgba(255,255,255,0)', 'rgba(255,255,255,0.18)', 'rgba(255,255,255,0)'] as string[],
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
