// Mock expo-router
jest.mock('expo-router', () => ({
    useRouter: () => ({
        push: jest.fn(),
        replace: jest.fn(),
        back: jest.fn(),
    }),
    useLocalSearchParams: () => ({}),
}));

// Mock react-native-svg
jest.mock('react-native-svg', () => {
    const { View } = require('react-native');
    const MockSvg = (props) => <View {...props} />;
    return {
        __esModule: true,
        default: MockSvg,
        Svg: MockSvg,
        Circle: MockSvg,
        Defs: MockSvg,
        LinearGradient: MockSvg,
        Line: MockSvg,
        Path: MockSvg,
        Stop: MockSvg,
    };
});

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
    getItem: jest.fn(() => Promise.resolve(null)),
    setItem: jest.fn(() => Promise.resolve()),
    removeItem: jest.fn(() => Promise.resolve()),
}));

// Mock the theme hook
jest.mock('./lib/theme', () => ({
    useTheme: () => ({
        colors: {
            appBg: '#0f1117',
            surface: '#1a1d27',
            surfaceHover: '#22252f',
            surfaceMuted: '#1e2130',
            border: '#2a2d3a',
            text: '#ffffff',
            textMuted: '#8b8fa3',
            textSubtle: '#555872',
            primary: '#22c55e',
            primaryText: '#ffffff',
            error: '#ef4444',
            overlay: 'rgba(0,0,0,0.6)',
            sidebarBg: '#1a1d27',
            sidebarText: '#ffffff',
            sidebarTextMuted: '#8b8fa3',
            sidebarActiveBg: '#22252f',
            sidebarActiveText: '#22c55e',
            successBg: '#052e16',
            successText: '#22c55e',
            dangerBg: '#450a0a',
            warningText: '#f59e0b',
        },
        mode: 'dark',
        toggleTheme: jest.fn(),
    }),
}));

// Mock the API module
jest.mock('./lib/api', () => ({
    getSuperAdminOverview: jest.fn(() => Promise.resolve({
        data: {
            stats: { totalCustomers: 10, activeChannels: 5, totalMembers: 100, activeSubscriptions: 8 },
            recentCustomers: [],
            customerGrowth: { labels: [], values: [] },
            systemUptime: { labels: [], values: [] },
        },
    })),
    getSuperAdminCustomers: jest.fn(() => Promise.resolve({ data: { customers: [], total: 0, stats: { totalCustomers: 0, activeCustomers: 0, trialCustomers: 0, premiumCustomers: 0 } } })),
    getSuperAdminCustomerDetails: jest.fn(() => Promise.resolve({ data: {} })),
    updateSuperAdminCustomer: jest.fn(() => Promise.resolve({ data: {} })),
    getSuperAdminModeration: jest.fn(() => Promise.resolve({ data: {} })),
    getSuperAdminConfig: jest.fn(() => Promise.resolve({ data: {} })),
    updateSuperAdminConfig: jest.fn(() => Promise.resolve({ data: {} })),
    getSuperAdminTeamMembers: jest.fn(() => Promise.resolve({ data: [] })),
    inviteSuperAdminTeamMember: jest.fn(() => Promise.resolve({ data: {} })),
    getAuthUser: jest.fn(() => Promise.resolve({ role: 'super_admin', firstName: 'Test', lastName: 'Admin' })),
    logout: jest.fn(() => Promise.resolve()),
    superAdminPost: jest.fn(() => Promise.resolve({ data: {} })),
    superAdminPatch: jest.fn(() => Promise.resolve({ data: {} })),
}));
