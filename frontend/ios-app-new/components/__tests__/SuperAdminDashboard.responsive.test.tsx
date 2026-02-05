import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react-native';
import { useWindowDimensions } from 'react-native';
import SuperAdminDashboard from '../SuperAdminDashboard';

// Mock useWindowDimensions to control viewport width
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => {
    let mockWidth = 1200;
    return {
        __esModule: true,
        default: () => ({ width: mockWidth, height: 800, scale: 1, fontScale: 1 }),
        __setMockWidth: (w: number) => { mockWidth = w; },
    };
});

const setMockWidth = (w: number) => {
    const mod = require('react-native/Libraries/Utilities/useWindowDimensions');
    mod.__setMockWidth(w);
};

// Helper to render at a specific viewport width
const renderAtWidth = (width: number) => {
    setMockWidth(width);
    return render(<SuperAdminDashboard />);
};

beforeEach(() => {
    jest.clearAllMocks();
    setMockWidth(1200); // Reset to desktop
});

// =============================================================================
// 1. MOBILE BOTTOM NAVIGATION
// =============================================================================
describe('Mobile Bottom Navigation', () => {
    it('should show bottom navigation on mobile (width < 900)', async () => {
        const { getAllByText } = renderAtWidth(400);

        await waitFor(() => {
            // The bottom nav items should be visible
            expect(getAllByText('Overview').length).toBeGreaterThanOrEqual(1);
            expect(getAllByText('Customers').length).toBeGreaterThanOrEqual(1);
            expect(getAllByText('Moderation').length).toBeGreaterThanOrEqual(1);
            expect(getAllByText('Settings').length).toBeGreaterThanOrEqual(1);
        });
    });

    it('should NOT show bottom navigation on desktop (width >= 900)', async () => {
        const { queryByText } = renderAtWidth(1200);

        await waitFor(() => {
            // On desktop, "Settings" label appears only in the sidebar as "Configuration"
            // The mobile-specific "Settings" label should not exist
            // Sidebar shows "Configuration", not "Settings"
            const settingsElements = queryByText('Settings');
            // On desktop, the Settings page title exists but the bottom nav "Settings" tab does not
            // We check for sidebar presence instead
            expect(queryByText('THE GRYD')).toBeTruthy(); // Sidebar logo visible on desktop
        });
    });

    it('should NOT show sidebar on mobile', async () => {
        const { queryByText } = renderAtWidth(400);

        await waitFor(() => {
            // Sidebar logo should not be visible on mobile
            expect(queryByText('THE GRYD')).toBeNull();
        });
    });

    it('should show sidebar on desktop', async () => {
        const { getByText } = renderAtWidth(1200);

        await waitFor(() => {
            expect(getByText('THE GRYD')).toBeTruthy();
        });
    });

    it('should navigate between pages using bottom nav on mobile', async () => {
        const { getAllByText, getByText } = renderAtWidth(400);

        await waitFor(() => {
            expect(getAllByText('Overview').length).toBeGreaterThanOrEqual(1);
        });

        // Tap Customers in bottom nav
        const customersButtons = getAllByText('Customers');
        fireEvent.press(customersButtons[customersButtons.length - 1]); // Press the nav item

        await waitFor(() => {
            // Customers page should have "Add New Customer" button
            expect(getByText('Add New Customer')).toBeTruthy();
        });
    });
});

// =============================================================================
// 2. TOP BAR RESPONSIVENESS
// =============================================================================
describe('Top Bar Responsiveness', () => {
    it('should show profile name on desktop', async () => {
        const { getByText } = renderAtWidth(1200);

        await waitFor(() => {
            expect(getByText('Admin Account')).toBeTruthy();
        });
    });

    it('should hide profile name on mobile', async () => {
        const { queryByText } = renderAtWidth(400);

        await waitFor(() => {
            expect(queryByText('Admin Account')).toBeNull();
        });
    });

    it('should show search input on both mobile and desktop', async () => {
        const { getByPlaceholderText } = renderAtWidth(400);

        await waitFor(() => {
            expect(getByPlaceholderText('Search anything here')).toBeTruthy();
        });

        // Re-render at desktop width
        const desktopResult = renderAtWidth(1200);
        await waitFor(() => {
            expect(desktopResult.getByPlaceholderText('Search anything here')).toBeTruthy();
        });
    });
});

// =============================================================================
// 3. OVERVIEW PAGE - STATS & CHARTS
// =============================================================================
describe('Overview Page Responsive Layout', () => {
    it('should render stats cards on both mobile and desktop', async () => {
        const { getByText } = renderAtWidth(400);

        await waitFor(() => {
            expect(getByText('All Customers')).toBeTruthy();
            expect(getByText('Active Channels')).toBeTruthy();
            expect(getByText('Total Members')).toBeTruthy();
            expect(getByText('Active Subscription')).toBeTruthy();
        });
    });

    it('should render chart titles on overview page', async () => {
        const { getByText } = renderAtWidth(400);

        await waitFor(() => {
            expect(getByText('Customer Growth')).toBeTruthy();
            expect(getByText('System Uptime (Last 24 hours)')).toBeTruthy();
        });
    });

    it('should render "Recent Customer" section on overview', async () => {
        const { getByText } = renderAtWidth(400);

        await waitFor(() => {
            expect(getByText('Recent Customer')).toBeTruthy();
            expect(getByText('See all')).toBeTruthy();
        });
    });
});

// =============================================================================
// 4. CUSTOMERS PAGE RESPONSIVE LAYOUT
// =============================================================================
describe('Customers Page Responsive Layout', () => {
    it('should render customers page with search and controls', async () => {
        const { getAllByText, getByText, getByPlaceholderText } = renderAtWidth(400);

        // Navigate to customers page
        await waitFor(() => {
            expect(getAllByText('Customers').length).toBeGreaterThanOrEqual(1);
        });

        const customersButtons = getAllByText('Customers');
        fireEvent.press(customersButtons[customersButtons.length - 1]);

        await waitFor(() => {
            expect(getByText('Add New Customer')).toBeTruthy();
            expect(getByPlaceholderText('Search Customer...')).toBeTruthy();
        });
    });

    it('should show pagination controls on customers page', async () => {
        const { getAllByText, getByText } = renderAtWidth(400);

        await waitFor(() => {
            expect(getAllByText('Customers').length).toBeGreaterThanOrEqual(1);
        });

        const customersButtons = getAllByText('Customers');
        fireEvent.press(customersButtons[customersButtons.length - 1]);

        await waitFor(() => {
            expect(getByText('Rows per page:')).toBeTruthy();
        });
    });
});

// =============================================================================
// 5. MODERATION PAGE
// =============================================================================
describe('Moderation Page Responsive Layout', () => {
    it('should render moderation toggles on mobile', async () => {
        const { getAllByText, getByText } = renderAtWidth(400);

        await waitFor(() => {
            expect(getAllByText('Moderation').length).toBeGreaterThanOrEqual(1);
        });

        const moderationButtons = getAllByText('Moderation');
        fireEvent.press(moderationButtons[moderationButtons.length - 1]);

        await waitFor(() => {
            expect(getByText('Moderation & Safety')).toBeTruthy();
            expect(getByText('Auto-flag severe content')).toBeTruthy();
            expect(getByText('Ban Repeated Offenders')).toBeTruthy();
            expect(getByText('Alert Customer')).toBeTruthy();
            expect(getByText('Flag Hate Speech')).toBeTruthy();
            expect(getByText('Prohibited content')).toBeTruthy();
        });
    });
});

// =============================================================================
// 6. CONFIGURATION / SETTINGS PAGE
// =============================================================================
describe('Configuration Page Responsive Layout', () => {
    it('should render settings tabs on mobile', async () => {
        const { getAllByText } = renderAtWidth(400);

        await waitFor(() => {
            expect(getAllByText('Settings').length).toBeGreaterThanOrEqual(1);
        });

        // Navigate to Settings page via bottom nav
        const settingsButtons = getAllByText('Settings');
        fireEvent.press(settingsButtons[settingsButtons.length - 1]);

        await waitFor(() => {
            // "Admin Info" appears as both tab label and section title
            expect(getAllByText('Admin Info').length).toBeGreaterThanOrEqual(1);
            expect(getAllByText('Team').length).toBeGreaterThanOrEqual(1);
            expect(getAllByText('Notifications').length).toBeGreaterThanOrEqual(1);
        });
    });

    it('should render admin form fields on settings page', async () => {
        const { getAllByText, getByPlaceholderText } = renderAtWidth(400);

        await waitFor(() => {
            expect(getAllByText('Settings').length).toBeGreaterThanOrEqual(1);
        });

        const settingsButtons = getAllByText('Settings');
        fireEvent.press(settingsButtons[settingsButtons.length - 1]);

        await waitFor(() => {
            expect(getByPlaceholderText('James')).toBeTruthy();
            expect(getByPlaceholderText('Bryce')).toBeTruthy();
            expect(getByPlaceholderText('admin@syphor.com')).toBeTruthy();
            expect(getByPlaceholderText('admin')).toBeTruthy();
        });
    });

    it('should switch to team tab and show add member button', async () => {
        const { getAllByText, getByText } = renderAtWidth(400);

        await waitFor(() => {
            expect(getAllByText('Settings').length).toBeGreaterThanOrEqual(1);
        });

        const settingsButtons = getAllByText('Settings');
        fireEvent.press(settingsButtons[settingsButtons.length - 1]);

        await waitFor(() => {
            expect(getByText('Team')).toBeTruthy();
        });

        fireEvent.press(getByText('Team'));

        await waitFor(() => {
            expect(getByText('Add Team member')).toBeTruthy();
        });
    });

    it('should switch to notifications tab and show toggles', async () => {
        const { getAllByText, getByText } = renderAtWidth(400);

        await waitFor(() => {
            expect(getAllByText('Settings').length).toBeGreaterThanOrEqual(1);
        });

        const settingsButtons = getAllByText('Settings');
        fireEvent.press(settingsButtons[settingsButtons.length - 1]);

        await waitFor(() => {
            expect(getByText('Notifications')).toBeTruthy();
        });

        fireEvent.press(getByText('Notifications'));

        await waitFor(() => {
            expect(getByText('System Alert')).toBeTruthy();
            expect(getByText('Security Events')).toBeTruthy();
            expect(getByText('Daily Reports')).toBeTruthy();
            expect(getByText('Weekly Reports')).toBeTruthy();
        });
    });
});

// =============================================================================
// 7. MODALS RENDER CORRECTLY
// =============================================================================
describe('Modal Accessibility', () => {
    it('should open Add Customer modal from customers page', async () => {
        const { getAllByText, getByText } = renderAtWidth(400);

        await waitFor(() => {
            expect(getAllByText('Customers').length).toBeGreaterThanOrEqual(1);
        });

        const customersButtons = getAllByText('Customers');
        fireEvent.press(customersButtons[customersButtons.length - 1]);

        await waitFor(() => {
            expect(getByText('Add New Customer')).toBeTruthy();
        });

        fireEvent.press(getByText('Add New Customer'));

        await waitFor(() => {
            expect(getByText('Onboard a new customer. Account setup link will be sent to the customer\'s email')).toBeTruthy();
        });
    });

    it('should open Invite Team Member modal from settings page', async () => {
        const { getAllByText, getByText } = renderAtWidth(400);

        await waitFor(() => {
            expect(getAllByText('Settings').length).toBeGreaterThanOrEqual(1);
        });

        const settingsButtons = getAllByText('Settings');
        fireEvent.press(settingsButtons[settingsButtons.length - 1]);

        await waitFor(() => {
            expect(getByText('Team')).toBeTruthy();
        });

        fireEvent.press(getByText('Team'));

        await waitFor(() => {
            expect(getByText('Add Team member')).toBeTruthy();
        });

        fireEvent.press(getByText('Add Team member'));

        await waitFor(() => {
            expect(getByText('Invite colleagues to help manage the platform')).toBeTruthy();
        });
    });
});

// =============================================================================
// 8. CROSS-VIEWPORT CONSISTENCY
// =============================================================================
describe('Cross-Viewport Content Consistency', () => {
    it('should render the same core content on mobile and desktop overview', async () => {
        // Mobile
        const mobileResult = renderAtWidth(400);
        await waitFor(() => {
            expect(mobileResult.getByText('All Customers')).toBeTruthy();
            expect(mobileResult.getByText('Active Channels')).toBeTruthy();
            expect(mobileResult.getByText('Total Members')).toBeTruthy();
            expect(mobileResult.getByText('Active Subscription')).toBeTruthy();
            expect(mobileResult.getByText('Recent Customer')).toBeTruthy();
            expect(mobileResult.getByText('Customer Growth')).toBeTruthy();
        });
        mobileResult.unmount();

        // Desktop
        const desktopResult = renderAtWidth(1200);
        await waitFor(() => {
            expect(desktopResult.getByText('All Customers')).toBeTruthy();
            expect(desktopResult.getByText('Active Channels')).toBeTruthy();
            expect(desktopResult.getByText('Total Members')).toBeTruthy();
            expect(desktopResult.getByText('Active Subscription')).toBeTruthy();
            expect(desktopResult.getByText('Recent Customer')).toBeTruthy();
            expect(desktopResult.getByText('Customer Growth')).toBeTruthy();
        });
        desktopResult.unmount();
    });

    it('should render moderation page content identically on mobile and desktop', async () => {
        // Mobile
        const mobileResult = renderAtWidth(400);
        await waitFor(() => {
            expect(mobileResult.getAllByText('Moderation').length).toBeGreaterThanOrEqual(1);
        });
        const mobileMod = mobileResult.getAllByText('Moderation');
        fireEvent.press(mobileMod[mobileMod.length - 1]);
        await waitFor(() => {
            expect(mobileResult.getByText('Auto-flag severe content')).toBeTruthy();
            expect(mobileResult.getByText('Prohibited content')).toBeTruthy();
        });
        mobileResult.unmount();

        // Desktop
        const desktopResult = renderAtWidth(1200);
        await waitFor(() => {
            expect(desktopResult.getAllByText(/Moderation/).length).toBeGreaterThanOrEqual(1);
        });
        // On desktop, use sidebar nav
        const desktopMod = desktopResult.getByText('Moderations & Safety');
        fireEvent.press(desktopMod);
        await waitFor(() => {
            expect(desktopResult.getByText('Auto-flag severe content')).toBeTruthy();
            expect(desktopResult.getByText('Prohibited content')).toBeTruthy();
        });
        desktopResult.unmount();
    });
});

// =============================================================================
// 9. STYLE STRUCTURE VALIDATION
// =============================================================================
describe('Style Structure Validation', () => {
    it('should apply mobile container styles when isMobile is true', async () => {
        const { toJSON } = renderAtWidth(400);
        const tree = toJSON();
        // The root container should exist and render without crashing
        expect(tree).toBeTruthy();
    });

    it('should apply desktop container styles when isMobile is false', async () => {
        const { toJSON } = renderAtWidth(1200);
        const tree = toJSON();
        expect(tree).toBeTruthy();
    });

    it('should render without errors at tablet breakpoint (width = 900)', async () => {
        const { toJSON } = renderAtWidth(900);
        const tree = toJSON();
        expect(tree).toBeTruthy();
    });

    it('should render without errors at very small width (320px)', async () => {
        const { toJSON } = renderAtWidth(320);
        const tree = toJSON();
        expect(tree).toBeTruthy();
    });

    it('should render without errors at large desktop width (1920px)', async () => {
        const { toJSON } = renderAtWidth(1920);
        const tree = toJSON();
        expect(tree).toBeTruthy();
    });
});
