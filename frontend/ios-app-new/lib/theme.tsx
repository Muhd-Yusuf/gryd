import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Platform, useColorScheme } from 'react-native';

export type ThemeMode = 'light' | 'dark';

const THEME_STORAGE_KEY = 'gryd_theme_mode';

function loadSavedTheme(): ThemeMode | null {
    try {
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
            const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
            if (saved === 'dark' || saved === 'light') return saved;
        }
    } catch {}
    return null;
}

function saveTheme(mode: ThemeMode) {
    try {
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
            window.localStorage.setItem(THEME_STORAGE_KEY, mode);
        }
    } catch {}
}

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
    glassBgHover: 'rgba(255,255,255,0.72)',
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
    modalBg: 'rgba(248, 249, 255, 0.97)',
};

export const darkColors: typeof lightColors = {
    appBg: 'transparent',           // gradient shows through
    surface: 'rgba(255,255,255,0.07)',  // white-tinted glass surface on black
    surfaceMuted: 'rgba(255,255,255,0.05)',
    surfaceHover: 'rgba(255,255,255,0.10)',
    cardBg: 'rgba(255,255,255,0.08)',
    text: '#FFFFFF',
    textMuted: '#C4C4CC',
    textSubtle: '#888898',
    border: 'rgba(255,255,255,0.12)',
    icon: '#C4C4CC',
    primary: '#3B82F6',
    primaryText: '#FFFFFF',
    sidebarBg: 'rgba(255,255,255,0.04)',
    sidebarText: '#FFFFFF',
    sidebarTextMuted: '#C4C4CC',
    sidebarActiveBg: 'rgba(59,130,246,0.85)',
    sidebarActiveText: '#FFFFFF',
    overlay: 'rgba(0,0,0,0.75)',
    successBg: 'rgba(134,239,172,0.12)',
    successText: '#86EFAC',
    warningBg: 'rgba(252,211,77,0.12)',
    warningText: '#FCD34D',
    dangerBg: 'rgba(252,165,165,0.12)',
    dangerText: '#FCA5A5',
    error: '#EF4444',
    // Glass tokens — white-tinted frost on pure black for true liquid glass
    glassBg: 'rgba(255,255,255,0.08)',
    glassBgHover: 'rgba(255,255,255,0.14)',
    glassBorder: 'rgba(255,255,255,0.22)',
    glassShadow: 'rgba(0,0,0,0.6)',
    glassBlurIntensity: 40,
    glassNavBg: 'rgba(255,255,255,0.05)',
    glassNavBorder: 'rgba(255,255,255,0.15)',
    glassActiveBg: 'rgba(59,130,246,0.85)',
    glassActiveText: '#FFFFFF',
    gradientStart: '#000000',
    gradientEnd: '#03030A',
    metallicShimmer: ['rgba(255,255,255,0)', 'rgba(255,255,255,0.18)', 'rgba(255,255,255,0)'] as string[],
    modalBg: 'rgba(18, 20, 30, 0.96)',
};

type ThemeContextValue = {
    mode: ThemeMode;
    colors: typeof lightColors;
    toggleTheme: () => void;
    setTheme: (mode: ThemeMode) => void;
};

const ThemeContext = createContext<ThemeContextValue>({
    mode: 'dark',
    colors: darkColors,
    toggleTheme: () => {},
    setTheme: () => {},
});

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
    const systemScheme = useColorScheme();

    const [mode, setModeState] = useState<ThemeMode>(() => {
        // 1. Check persisted preference first
        const saved = loadSavedTheme();
        if (saved) return saved;
        // 2. Fall back to system scheme, default to 'dark' if unknown
        return systemScheme === 'light' ? 'light' : 'dark';
    });

    const setMode = (newMode: ThemeMode) => {
        saveTheme(newMode);
        setModeState(newMode);
    };

    const colors = mode === 'dark' ? darkColors : lightColors;
    const toggleTheme = () => setMode(mode === 'dark' ? 'light' : 'dark');

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
