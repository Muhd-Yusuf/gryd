import React, { createContext, useContext, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';

export type ThemeMode = 'light' | 'dark';

export const lightColors = {
    // App background — transparent so GradientBackground shows through
    appBg: 'transparent',
    // Surface — semi-transparent glass so gradient bleeds through every card
    surface: 'rgba(255,255,255,0.62)',
    surfaceMuted: 'rgba(243,244,246,0.55)',
    surfaceHover: 'rgba(249,250,251,0.60)',
    cardBg: 'rgba(255,255,255,0.62)',
    text: '#111827',
    textMuted: '#4B5563',
    textSubtle: '#9CA3AF',
    border: 'rgba(209,213,219,0.6)',
    icon: '#6B7280',
    primary: '#4F46E5',
    primaryText: '#FFFFFF',
    sidebarBg: 'rgba(255,255,255,0.55)',
    sidebarText: '#111827',
    sidebarTextMuted: '#6B7280',
    sidebarActiveBg: '#4F46E5',
    sidebarActiveText: '#FFFFFF',
    overlay: 'rgba(0,0,0,0.45)',
    successBg: 'rgba(220,252,231,0.7)',
    successText: '#16A34A',
    warningBg: 'rgba(254,243,199,0.7)',
    warningText: '#D97706',
    dangerBg: 'rgba(254,226,226,0.7)',
    dangerText: '#DC2626',
    error: '#EF4444',
    // Glass tokens
    glassBg: 'rgba(255,255,255,0.55)',
    glassBorder: 'rgba(255,255,255,0.80)',
    glassShadow: 'rgba(0,0,0,0.07)',
    glassBlurIntensity: 26,
    glassNavBg: 'rgba(255,255,255,0.65)',
    glassNavBorder: 'rgba(255,255,255,0.85)',
    glassActiveBg: 'rgba(79,70,229,0.88)',
    glassActiveText: '#FFFFFF',
    gradientStart: '#DDE3F5',
    gradientEnd: '#EBF0FF',
    metallicShimmer: ['rgba(255,255,255,0)', 'rgba(255,255,255,0.75)', 'rgba(255,255,255,0)'] as string[],
};

export const darkColors: typeof lightColors = {
    appBg: 'transparent',
    surface: 'rgba(30,30,55,0.60)',
    surfaceMuted: 'rgba(20,20,45,0.55)',
    surfaceHover: 'rgba(35,35,65,0.60)',
    cardBg: 'rgba(30,30,55,0.60)',
    text: '#F1F1FF',
    textMuted: '#A1A1C0',
    textSubtle: '#6B6B8B',
    border: 'rgba(80,80,120,0.35)',
    icon: '#A1A1C0',
    primary: '#818CF8',
    primaryText: '#FFFFFF',
    sidebarBg: 'rgba(12,12,30,0.70)',
    sidebarText: '#F1F1FF',
    sidebarTextMuted: '#A1A1C0',
    sidebarActiveBg: '#6366F1',
    sidebarActiveText: '#FFFFFF',
    overlay: 'rgba(0,0,0,0.80)',
    successBg: 'rgba(31,46,34,0.7)',
    successText: '#86EFAC',
    warningBg: 'rgba(42,33,22,0.7)',
    warningText: '#FCD34D',
    dangerBg: 'rgba(43,23,23,0.7)',
    dangerText: '#FCA5A5',
    error: '#F87171',
    // Glass tokens
    glassBg: 'rgba(25,25,55,0.58)',
    glassBorder: 'rgba(255,255,255,0.09)',
    glassShadow: 'rgba(0,0,0,0.45)',
    glassBlurIntensity: 30,
    glassNavBg: 'rgba(12,12,35,0.72)',
    glassNavBorder: 'rgba(255,255,255,0.07)',
    glassActiveBg: 'rgba(99,102,241,0.88)',
    glassActiveText: '#FFFFFF',
    gradientStart: '#07071A',
    gradientEnd: '#0D0D2E',
    metallicShimmer: ['rgba(255,255,255,0)', 'rgba(255,255,255,0.20)', 'rgba(255,255,255,0)'] as string[],
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
