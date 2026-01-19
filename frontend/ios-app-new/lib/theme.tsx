import React, { createContext, useContext, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';

export type ThemeMode = 'light' | 'dark';

export const lightColors = {
    appBg: '#F5F5F5',
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
};

export const darkColors: typeof lightColors = {
    appBg: '#0D0D0D',
    surface: '#1A1A1A',
    surfaceMuted: '#242424',
    surfaceHover: '#2A2A2A',
    cardBg: '#1A1A1A',
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
