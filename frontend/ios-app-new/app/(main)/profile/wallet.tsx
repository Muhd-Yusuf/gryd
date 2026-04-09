import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    StyleSheet,
    Text,
    View,
    ScrollView,
    ActivityIndicator,
    Alert,
    Platform,
    useWindowDimensions,
    TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
    ArrowLeft,
    Wallet,
    BadgeCheck,
    RefreshCw,
    Link2,
    AlertCircle,
    Copy,
    Globe,
    Zap,
    CheckCircle2,
    AtSign,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useNavigation } from '@react-navigation/native';
import { communityGet, communityPost } from '../../../lib/api';
import { useTheme } from '../../../lib/theme';
import {
    GlassButton,
    GlassCard,
    GlassIconButton,
    GlassInput,
    GradientBackground,
    GlassHeader,
} from '../../../components/glass';

// ─── Types ────────────────────────────────────────────────────────────────────

type WalletInfo = {
    address: string;
    ensName?: string;
    verified: boolean;
    connectedAt?: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const shortenAddress = (addr: string) => {
    if (!addr || addr.length < 12) return addr;
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
};

const isValidAddress = (addr: string) =>
    /^0x[0-9a-fA-F]{40}$/.test(addr.trim());

const isValidEnsName = (name: string) =>
    /^[a-zA-Z0-9-]+\.eth$/.test(name.trim());

const showAlert = (title: string, msg: string) => {
    if (Platform.OS === 'web') {
        window.alert(`${title}: ${msg}`);
    } else {
        Alert.alert(title, msg);
    }
};

// ─── Benefit cards data ───────────────────────────────────────────────────────

const BENEFIT_CARDS = [
    {
        icon: AtSign,
        title: 'Link your .eth identity',
        desc: 'Display your ENS name on your Gryd profile',
    },
    {
        icon: Zap,
        title: 'Interact with crypto-native members',
        desc: 'Connect with web3 communities inside Gryd',
    },
    {
        icon: Globe,
        title: 'Show your web3 presence',
        desc: 'Make your on-chain identity visible to others',
    },
] as const;

// ─── Screen ───────────────────────────────────────────────────────────────────

const WalletScreen = () => {
    const { colors, mode } = useTheme();
    const { width } = useWindowDimensions();
    const styles = useMemo(() => createStyles(colors, width), [colors, width]);
    const router = useRouter();
    const navigation = useNavigation();

    // State
    const [wallet, setWallet] = useState<WalletInfo | null>(null);
    const [loading, setLoading] = useState(true);
    const [addressInput, setAddressInput] = useState('');
    const [connecting, setConnecting] = useState(false);
    const [refreshingEns, setRefreshingEns] = useState(false);
    const [disconnecting, setDisconnecting] = useState(false);
    const [nonce, setNonce] = useState<string | null>(null);
    const [nonceLoading, setNonceLoading] = useState(false);

    // ENS linking state
    const [ensInput, setEnsInput] = useState('');
    const [ensLinking, setEnsLinking] = useState(false);
    const [ensLinked, setEnsLinked] = useState(false);
    const [ensError, setEnsError] = useState<string | null>(null);

    const handleBack = useCallback(() => {
        if (navigation.canGoBack()) {
            router.back();
        } else {
            router.push('/(main)/profile');
        }
    }, [navigation, router]);

    // ─── Fetch wallet ─────────────────────────────────────────────────────────

    const fetchWallet = useCallback(async () => {
        setLoading(true);
        try {
            const data = await communityGet('/wallet/me');
            setWallet(data?.address ? data : null);
        } catch {
            setWallet(null);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchWallet();
    }, [fetchWallet]);

    // ─── Get nonce ────────────────────────────────────────────────────────────

    const handleGetNonce = useCallback(async () => {
        const addr = addressInput.trim();
        if (!isValidAddress(addr)) {
            showAlert('Invalid Address', 'Please enter a valid Ethereum address (0x...)');
            return;
        }
        setNonceLoading(true);
        try {
            const data = await communityGet(`/wallet/nonce?address=${encodeURIComponent(addr)}`);
            setNonce(data?.message || data?.nonce || 'Sign this message to verify wallet ownership.');
        } catch (err: any) {
            showAlert('Error', err?.message || 'Failed to get nonce');
        } finally {
            setNonceLoading(false);
        }
    }, [addressInput]);

    // ─── Connect & verify ─────────────────────────────────────────────────────

    const handleConnect = useCallback(async () => {
        const addr = addressInput.trim();
        if (!isValidAddress(addr)) {
            showAlert('Invalid Address', 'Please enter a valid Ethereum address (0x...)');
            return;
        }
        setConnecting(true);
        try {
            const result = await communityPost('/wallet/verify', {
                address: addr,
                signature: 'manual-verify',
            });
            setWallet(result?.wallet || { address: addr, verified: true });
            setAddressInput('');
            setNonce(null);
            showAlert('Wallet Connected', 'Your wallet has been connected and verified.');
        } catch (err: any) {
            showAlert('Error', err?.message || 'Failed to connect wallet');
        } finally {
            setConnecting(false);
        }
    }, [addressInput]);

    // ─── Refresh ENS ──────────────────────────────────────────────────────────

    const handleRefreshEns = useCallback(async () => {
        if (!wallet?.address) return;
        setRefreshingEns(true);
        try {
            const data = await communityGet('/wallet/me');
            setWallet(data?.address ? data : null);
            showAlert('ENS Refreshed', data?.ensName ? `ENS name: ${data.ensName}` : 'No ENS name found for this address.');
        } catch (err: any) {
            showAlert('Error', err?.message || 'Failed to refresh ENS');
        } finally {
            setRefreshingEns(false);
        }
    }, [wallet]);

    // ─── Link ENS manually ────────────────────────────────────────────────────

    const handleLinkEns = useCallback(async () => {
        const ensName = ensInput.trim().toLowerCase();
        setEnsError(null);

        if (!isValidEnsName(ensName)) {
            setEnsError('Please enter a valid .eth domain (e.g. yourname.eth)');
            return;
        }

        setEnsLinking(true);
        try {
            await communityPost('/wallet/ens', { ensName });
            setWallet((prev) => prev ? { ...prev, ensName } : prev);
            setEnsLinked(true);
            setEnsInput('');
        } catch (err: any) {
            setEnsError(err?.message || 'Failed to link ENS name. Please try again.');
        } finally {
            setEnsLinking(false);
        }
    }, [ensInput]);

    // ─── Disconnect ───────────────────────────────────────────────────────────

    const handleDisconnect = useCallback(async () => {
        const confirm = () => new Promise<boolean>((resolve) => {
            if (Platform.OS === 'web') {
                resolve(window.confirm('Disconnect your wallet? You can reconnect at any time.'));
            } else {
                Alert.alert(
                    'Disconnect Wallet',
                    'Are you sure you want to disconnect your wallet?',
                    [
                        { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
                        { text: 'Disconnect', style: 'destructive', onPress: () => resolve(true) },
                    ],
                );
            }
        });

        const ok = await confirm();
        if (!ok) return;

        setDisconnecting(true);
        try {
            await communityPost('/wallet/disconnect', {});
            setWallet(null);
            setEnsLinked(false);
            setEnsInput('');
            setEnsError(null);
        } catch (err: any) {
            showAlert('Error', err?.message || 'Failed to disconnect wallet');
        } finally {
            setDisconnecting(false);
        }
    }, []);

    // ─── Copy address helper ──────────────────────────────────────────────────

    const handleCopyAddress = useCallback((address: string) => {
        if (Platform.OS === 'web' && navigator?.clipboard) {
            navigator.clipboard.writeText(address);
        }
        showAlert('Copied', 'Wallet address copied to clipboard.');
    }, []);

    // ─── Render connected ─────────────────────────────────────────────────────

    const renderConnected = () => {
        if (!wallet) return null;
        const hasEns = Boolean(wallet.ensName);

        return (
            <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* ── ENS name hero (prominent display) ── */}
                {hasEns && (
                    <View style={styles.ensHero}>
                        <View style={styles.ensHeroNameRow}>
                            <BadgeCheck size={22} color="#22C55E" />
                            <Text style={styles.ensHeroName}>{wallet.ensName}</Text>
                        </View>
                        <View style={styles.ensBadge}>
                            <BadgeCheck size={14} color="#22C55E" />
                            <Text style={styles.ensBadgeText}>ENS Verified</Text>
                        </View>
                        {/* Address below ENS, smaller */}
                        <View style={styles.ensHeroAddressRow}>
                            <Text style={styles.ensHeroAddress}>{shortenAddress(wallet.address)}</Text>
                            <GlassIconButton
                                icon={<Copy size={13} color={colors.textMuted} />}
                                onPress={() => handleCopyAddress(wallet.address)}
                                size="sm"
                                variant="ghost"
                                accessibilityLabel="Copy wallet address"
                            />
                        </View>
                    </View>
                )}

                {/* ── Wallet card ── */}
                <GlassCard style={styles.glassCard}>
                    <View style={styles.cardInner}>
                        {/* Header row */}
                        <View style={styles.cardHeaderRow}>
                            <View style={styles.walletIconWrap}>
                                <Wallet size={22} color={colors.primary} />
                            </View>
                            <View style={styles.cardHeaderText}>
                                <Text style={styles.cardTitle}>Connected Wallet</Text>
                                {wallet.verified && (
                                    <View style={styles.verifiedBadge}>
                                        <BadgeCheck size={12} color="#22C55E" />
                                        <Text style={styles.verifiedText}>Verified</Text>
                                    </View>
                                )}
                            </View>
                        </View>

                        {/* Address row — shown here only if no ENS hero above */}
                        {!hasEns && (
                            <View style={styles.addressRow}>
                                <Text style={styles.addressLabel}>Address</Text>
                                <View style={styles.addressValueRow}>
                                    <Text style={styles.addressValue}>{shortenAddress(wallet.address)}</Text>
                                    <GlassIconButton
                                        icon={<Copy size={14} color={colors.textMuted} />}
                                        onPress={() => handleCopyAddress(wallet.address)}
                                        size="sm"
                                        variant="ghost"
                                        accessibilityLabel="Copy wallet address"
                                    />
                                </View>
                            </View>
                        )}

                        {/* ENS name row (compact, if available) */}
                        {hasEns && (
                            <View style={styles.addressRow}>
                                <Text style={styles.addressLabel}>ENS Name</Text>
                                <Text style={[styles.addressValue, { color: colors.primary }]}>{wallet.ensName}</Text>
                            </View>
                        )}

                        {/* Full address when ENS hero is shown */}
                        {hasEns && (
                            <View style={styles.addressRow}>
                                <Text style={styles.addressLabel}>Address</Text>
                                <View style={styles.addressValueRow}>
                                    <Text style={styles.addressValue}>{shortenAddress(wallet.address)}</Text>
                                    <GlassIconButton
                                        icon={<Copy size={14} color={colors.textMuted} />}
                                        onPress={() => handleCopyAddress(wallet.address)}
                                        size="sm"
                                        variant="ghost"
                                        accessibilityLabel="Copy wallet address"
                                    />
                                </View>
                            </View>
                        )}
                    </View>
                </GlassCard>

                {/* ── Link ENS domain section (shown only if no ENS yet) ── */}
                {!hasEns && (
                    <GlassCard style={styles.glassCard}>
                        <View style={styles.cardInner}>
                            <View style={styles.cardHeaderRow}>
                                <View style={[styles.walletIconWrap, { backgroundColor: `${colors.primary}18` }]}>
                                    <AtSign size={20} color={colors.primary} />
                                </View>
                                <View style={styles.cardHeaderText}>
                                    <Text style={styles.cardTitle}>Link ENS Domain</Text>
                                    <Text style={styles.cardSubtitle}>Connect your .eth name to your profile</Text>
                                </View>
                            </View>

                            {ensLinked ? (
                                <View style={styles.ensSuccessBox}>
                                    <CheckCircle2 size={18} color="#22C55E" />
                                    <Text style={styles.ensSuccessText}>ENS domain linked successfully!</Text>
                                </View>
                            ) : (
                                <>
                                    <GlassInput
                                        label="ENS Domain"
                                        placeholder="yourname.eth"
                                        value={ensInput}
                                        onChangeText={(v) => {
                                            setEnsInput(v);
                                            setEnsError(null);
                                        }}
                                        icon={<AtSign size={16} color={colors.textMuted} />}
                                        error={ensError ?? undefined}
                                        autoCapitalize="none"
                                        autoCorrect={false}
                                        spellCheck={false}
                                        keyboardType="email-address"
                                    />
                                    <GlassButton
                                        label="Link ENS Domain"
                                        onPress={handleLinkEns}
                                        variant="primary"
                                        loading={ensLinking}
                                        icon={<Link2 size={16} color="#fff" />}
                                        fullWidth
                                    />
                                    <Text style={styles.ensHint}>
                                        Enter the .eth domain you own. We'll associate it with your connected wallet.
                                    </Text>
                                </>
                            )}
                        </View>
                    </GlassCard>
                )}

                {/* ── Actions ── */}
                <View style={styles.actionsRow}>
                    <GlassButton
                        label="Refresh ENS"
                        onPress={handleRefreshEns}
                        variant="secondary"
                        loading={refreshingEns}
                        icon={<RefreshCw size={16} color={colors.textMuted} />}
                        style={{ flex: 1 }}
                    />
                    <GlassButton
                        label="Disconnect"
                        onPress={handleDisconnect}
                        variant="danger"
                        loading={disconnecting}
                        style={{ flex: 1 }}
                    />
                </View>

                {/* ── Web3 payments info card ── */}
                <GlassCard style={styles.infoGlassCard}>
                    <View style={styles.infoCardInner}>
                        <View style={styles.infoCardIconWrap}>
                            <Zap size={16} color={colors.primary} />
                        </View>
                        <Text style={styles.infoCardText}>
                            Using crypto or stablecoins? Your wallet can be used to interact with other Gryd members who support web3 payments.
                        </Text>
                    </View>
                </GlassCard>

                <Text style={styles.disclaimerText}>
                    Your wallet address is used to display your Web3 identity and enable crypto features. Real signing via WalletConnect is coming in Phase 2.
                </Text>
            </ScrollView>
        );
    };

    // ─── Render disconnected ──────────────────────────────────────────────────

    const renderDisconnected = () => (
        <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
        >
            {/* ── Info banner ── */}
            <GlassCard style={styles.infoBannerCard}>
                <View style={styles.infoBannerInner}>
                    <AlertCircle size={18} color={colors.primary} />
                    <Text style={styles.infoBannerText}>
                        Connect your Ethereum wallet to use crypto features and display your .eth domain
                    </Text>
                </View>
            </GlassCard>

            {/* ── "What you can do" benefit cards (horizontal scroll) ── */}
            <View style={styles.benefitsSection}>
                <Text style={styles.benefitsHeading}>What you can do</Text>
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.benefitsScroll}
                >
                    {BENEFIT_CARDS.map((card, idx) => {
                        const Icon = card.icon;
                        return (
                            <GlassCard key={idx} style={styles.benefitCard}>
                                <View style={styles.benefitCardInner}>
                                    <View style={styles.benefitIconWrap}>
                                        <Icon size={18} color={colors.primary} />
                                    </View>
                                    <Text style={styles.benefitTitle}>{card.title}</Text>
                                    <Text style={styles.benefitDesc}>{card.desc}</Text>
                                </View>
                            </GlassCard>
                        );
                    })}
                </ScrollView>
            </View>

            {/* ── Connect card ── */}
            <GlassCard style={styles.glassCard}>
                <View style={styles.cardInner}>
                    <View style={styles.cardHeaderRow}>
                        <View style={styles.walletIconWrap}>
                            <Link2 size={22} color={colors.primary} />
                        </View>
                        <View style={styles.cardHeaderText}>
                            <Text style={styles.cardTitle}>Connect Wallet</Text>
                            <Text style={styles.cardSubtitle}>Enter your Ethereum address manually</Text>
                        </View>
                    </View>

                    {/* Address input */}
                    <GlassInput
                        label="Wallet Address"
                        placeholder="0x..."
                        value={addressInput}
                        onChangeText={setAddressInput}
                        icon={<Wallet size={16} color={colors.textMuted} />}
                        autoCapitalize="none"
                        autoCorrect={false}
                        spellCheck={false}
                    />

                    {/* Step 1: get nonce (show message to sign) */}
                    {!nonce && (
                        <GlassButton
                            label="Get Sign Message"
                            onPress={handleGetNonce}
                            variant="secondary"
                            loading={nonceLoading}
                            icon={<Link2 size={16} color={colors.textMuted} />}
                            fullWidth
                        />
                    )}

                    {/* Step 2: show nonce message + verify button */}
                    {nonce && (
                        <View style={styles.nonceSection}>
                            <Text style={styles.nonceLabel}>Message to Sign</Text>
                            <View style={styles.nonceBox}>
                                <Text style={styles.nonceText} selectable>{nonce}</Text>
                            </View>
                            <Text style={styles.nonceHint}>
                                In Phase 2 you'll sign this with WalletConnect. For now, tap Verify to proceed.
                            </Text>
                            <GlassButton
                                label="Connect & Verify"
                                onPress={handleConnect}
                                variant="primary"
                                loading={connecting}
                                fullWidth
                            />
                            <GlassButton
                                label="Cancel"
                                onPress={() => setNonce(null)}
                                variant="ghost"
                                fullWidth
                            />
                        </View>
                    )}

                    {/* Quick-connect without nonce step */}
                    {!nonce && (
                        <View style={styles.orDividerRow}>
                            <View style={styles.orLine} />
                            <Text style={styles.orText}>or</Text>
                            <View style={styles.orLine} />
                        </View>
                    )}
                    {!nonce && (
                        <GlassButton
                            label="Connect & Verify"
                            onPress={handleConnect}
                            variant="primary"
                            loading={connecting}
                            fullWidth
                        />
                    )}
                </View>
            </GlassCard>

            {/* ── Web3 payments info card ── */}
            <GlassCard style={styles.infoGlassCard}>
                <View style={styles.infoCardInner}>
                    <View style={styles.infoCardIconWrap}>
                        <Globe size={16} color={colors.primary} />
                    </View>
                    <Text style={styles.infoCardText}>
                        Using crypto or stablecoins? Your wallet can be used to interact with other Gryd members who support web3 payments.
                    </Text>
                </View>
            </GlassCard>

            <Text style={styles.disclaimerText}>
                Real signing via WalletConnect is coming in Phase 2. Your address will be stored securely and linked to your profile.
            </Text>
        </ScrollView>
    );

    return (
        <GradientBackground>
            <SafeAreaView style={styles.safe}>
                <View style={styles.container}>
                    {/* Header */}
                    <GlassHeader
                        title="Web3 Wallet"
                        onBack={handleBack}
                    />

                    {loading ? (
                        <View style={styles.loadingContainer}>
                            <ActivityIndicator size="large" color={colors.primary} />
                        </View>
                    ) : wallet ? (
                        renderConnected()
                    ) : (
                        renderDisconnected()
                    )}
                </View>
            </SafeAreaView>
        </GradientBackground>
    );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const createStyles = (
    colors: ReturnType<typeof import('../../../lib/theme').useTheme>['colors'],
    width: number,
) =>
    StyleSheet.create({
        safe: {
            flex: 1,
            backgroundColor: 'transparent',
        },
        container: {
            flex: 1,
        },
        loadingContainer: {
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
        },
        scroll: {
            flex: 1,
        },
        scrollContent: {
            padding: width < 768 ? 16 : 24,
            paddingBottom: 48,
            gap: 20,
            ...(width >= 768 ? {
                maxWidth: 700,
                width: '100%',
                alignSelf: 'center',
            } : {}),
        },

        // ── Info banner ──
        infoBannerCard: {
            borderRadius: 12,
        },
        infoBannerInner: {
            flexDirection: 'row',
            padding: 16,
            gap: 12,
            alignItems: 'flex-start',
        },
        infoBannerText: {
            flex: 1,
            fontSize: 13,
            color: colors.textMuted,
            lineHeight: 18,
        },

        // ── Benefit cards ──
        benefitsSection: {
            gap: 10,
        },
        benefitsHeading: {
            fontSize: 13,
            fontWeight: '600',
            color: colors.textMuted,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
            paddingHorizontal: 2,
        },
        benefitsScroll: {
            gap: 12,
            paddingRight: 4,
        },
        benefitCard: {
            width: 150,
            borderRadius: 14,
        },
        benefitCardInner: {
            padding: 14,
            gap: 8,
        },
        benefitIconWrap: {
            width: 36,
            height: 36,
            borderRadius: 10,
            backgroundColor: `${colors.primary}18`,
            alignItems: 'center',
            justifyContent: 'center',
        },
        benefitTitle: {
            fontSize: 13,
            fontWeight: '700',
            color: colors.text,
            lineHeight: 17,
        },
        benefitDesc: {
            fontSize: 11,
            color: colors.textMuted,
            lineHeight: 15,
        },

        // ── Glass card ──
        glassCard: {
            borderRadius: 16,
        },
        cardInner: {
            padding: 20,
            gap: 16,
        },
        cardHeaderRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 14,
        },
        walletIconWrap: {
            width: 46,
            height: 46,
            borderRadius: 14,
            backgroundColor: `${colors.primary}20`,
            alignItems: 'center',
            justifyContent: 'center',
        },
        cardHeaderText: {
            flex: 1,
            gap: 4,
        },
        cardTitle: {
            fontSize: 16,
            fontWeight: '700',
            color: colors.text,
        },
        cardSubtitle: {
            fontSize: 13,
            color: colors.textMuted,
        },

        // ── ENS hero (prominent, when ENS is set) ──
        ensHero: {
            alignItems: 'center',
            paddingVertical: 16,
            gap: 10,
        },
        ensHeroNameRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
        },
        ensHeroName: {
            fontSize: 26,
            fontWeight: '800',
            color: colors.text,
            letterSpacing: -0.5,
        },
        ensHeroAddressRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            marginTop: 2,
        },
        ensHeroAddress: {
            fontSize: 13,
            color: colors.textMuted,
            fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
        },
        ensBadge: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            backgroundColor: 'rgba(34,197,94,0.12)',
            paddingHorizontal: 12,
            paddingVertical: 5,
            borderRadius: 20,
        },
        ensBadgeText: {
            fontSize: 13,
            fontWeight: '600',
            color: '#22C55E',
        },

        // ── Address rows inside card ──
        addressRow: {
            gap: 4,
        },
        addressLabel: {
            fontSize: 12,
            fontWeight: '500',
            color: colors.textMuted,
            textTransform: 'uppercase',
            letterSpacing: 0.4,
        },
        addressValueRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
        },
        addressValue: {
            fontSize: 15,
            fontWeight: '600',
            color: colors.text,
            fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
        },
        verifiedBadge: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            backgroundColor: 'rgba(34,197,94,0.12)',
            paddingHorizontal: 8,
            paddingVertical: 3,
            borderRadius: 8,
            alignSelf: 'flex-start',
        },
        verifiedText: {
            fontSize: 12,
            fontWeight: '600',
            color: '#22C55E',
        },

        // ── ENS link section ──
        ensSuccessBox: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            backgroundColor: 'rgba(34,197,94,0.10)',
            borderRadius: 10,
            paddingHorizontal: 14,
            paddingVertical: 12,
        },
        ensSuccessText: {
            fontSize: 14,
            fontWeight: '600',
            color: '#22C55E',
        },
        ensHint: {
            fontSize: 12,
            color: colors.textSubtle,
            lineHeight: 16,
        },

        // ── Actions ──
        actionsRow: {
            flexDirection: 'row',
            gap: 12,
        },

        // ── Info card (web3 payments) ──
        infoGlassCard: {
            borderRadius: 12,
        },
        infoCardInner: {
            flexDirection: 'row',
            alignItems: 'flex-start',
            gap: 12,
            padding: 14,
        },
        infoCardIconWrap: {
            width: 32,
            height: 32,
            borderRadius: 8,
            backgroundColor: `${colors.primary}15`,
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: 1,
        },
        infoCardText: {
            flex: 1,
            fontSize: 13,
            color: colors.textMuted,
            lineHeight: 19,
        },

        // ── Nonce flow ──
        nonceSection: {
            gap: 12,
        },
        nonceLabel: {
            fontSize: 12,
            fontWeight: '600',
            color: colors.textMuted,
            textTransform: 'uppercase',
            letterSpacing: 0.4,
        },
        nonceBox: {
            backgroundColor: colors.surfaceMuted,
            borderRadius: 10,
            padding: 14,
            borderWidth: 1,
            borderColor: colors.glassBorder,
        },
        nonceText: {
            fontSize: 12,
            color: colors.textMuted,
            lineHeight: 18,
            fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
        },
        nonceHint: {
            fontSize: 12,
            color: colors.textSubtle,
            lineHeight: 16,
        },
        orDividerRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
        },
        orLine: {
            flex: 1,
            height: 1,
            backgroundColor: colors.glassBorder,
        },
        orText: {
            fontSize: 12,
            color: colors.textSubtle,
        },
        disclaimerText: {
            fontSize: 12,
            color: colors.textSubtle,
            lineHeight: 18,
            textAlign: 'center',
            paddingHorizontal: 8,
        },
    });

export default WalletScreen;
