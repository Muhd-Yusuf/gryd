import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Modal,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    useWindowDimensions,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
    Search,
    Tag,
    X,
    ExternalLink,
    ShoppingBag,
    Percent,
    ArrowLeft,
} from 'lucide-react-native';
import { useTheme } from '../../../lib/theme';
import { communityGet, communityPost, getTenantId, getAuthUser } from '../../../lib/api';

// ─── Types ───────────────────────────────────────────────────────────────────

type Listing = {
    _id: string;
    partnerName: string;
    category: 'Discounts' | 'Services' | 'Products' | 'Events';
    title: string;
    description: string;
    discountPercent: number;
    redemptionType: 'code' | 'link';
    code?: string;
    url?: string;
};

type RedemptionResult = {
    code?: string;
    url?: string;
    instructions?: string;
};

const CATEGORIES = ['All', 'Discounts', 'Services', 'Products', 'Events'] as const;
type Category = typeof CATEGORIES[number];

const CATEGORY_COLORS: Record<string, string> = {
    Discounts: '#3B82F6',
    Services: '#8B5CF6',
    Products: '#F59E0B',
    Events: '#10B981',
};

// ─── Redemption Bottom Sheet ─────────────────────────────────────────────────

function RedemptionModal({
    visible,
    onClose,
    listing,
    colors,
}: {
    visible: boolean;
    onClose: () => void;
    listing: Listing | null;
    colors: ReturnType<typeof useTheme>['colors'];
}) {
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<RedemptionResult | null>(null);
    const [error, setError] = useState('');

    useEffect(() => {
        if (visible && listing) {
            setResult(null);
            setError('');
            redeem();
        }
    }, [visible, listing?._id]);

    const redeem = async () => {
        if (!listing) return;
        setLoading(true);
        try {
            const data = await communityPost(`/marketplace/${listing._id}/redeem`, {});
            setResult(data?.redemption ?? { code: listing.code, url: listing.url, instructions: 'Show this code at checkout.' });
        } catch {
            setError('Could not load redemption details. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' }}>
                <View style={{
                    backgroundColor: colors.surface,
                    borderTopLeftRadius: 24,
                    borderTopRightRadius: 24,
                    borderWidth: 1,
                    borderColor: colors.glassBorder,
                    padding: 24,
                    paddingBottom: 40,
                }}>
                    {/* Handle */}
                    <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: colors.glassBorder, alignSelf: 'center', marginBottom: 20 }} />

                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                        <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text }}>
                            Redeem Offer
                        </Text>
                        <TouchableOpacity onPress={onClose}>
                            <X size={22} color={colors.textMuted} />
                        </TouchableOpacity>
                    </View>

                    {listing && (
                        <Text style={{ color: colors.textMuted, fontSize: 14, marginBottom: 20 }}>
                            {listing.title} — {listing.partnerName}
                        </Text>
                    )}

                    {loading && <ActivityIndicator color={colors.primary} style={{ marginVertical: 24 }} />}

                    {!!error && (
                        <Text style={{ color: colors.error, textAlign: 'center', marginVertical: 12 }}>{error}</Text>
                    )}

                    {result && !loading && (
                        <View style={{
                            backgroundColor: colors.glassBg,
                            borderWidth: 1,
                            borderColor: colors.glassBorder,
                            borderRadius: 16,
                            padding: 20,
                        }}>
                            {result.code ? (
                                <>
                                    <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>
                                        Redemption Code
                                    </Text>
                                    <Text style={{
                                        fontSize: 28,
                                        fontWeight: '800',
                                        color: colors.primary,
                                        letterSpacing: 4,
                                        marginBottom: 12,
                                    }}>
                                        {result.code}
                                    </Text>
                                </>
                            ) : result.url ? (
                                <TouchableOpacity
                                    style={{
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        gap: 8,
                                        backgroundColor: colors.primary,
                                        borderRadius: 12,
                                        padding: 14,
                                        justifyContent: 'center',
                                        marginBottom: 12,
                                    }}
                                >
                                    <ExternalLink size={18} color="#fff" />
                                    <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Open Redemption Link</Text>
                                </TouchableOpacity>
                            ) : null}
                            {result.instructions && (
                                <Text style={{ color: colors.textMuted, fontSize: 13, lineHeight: 20 }}>
                                    {result.instructions}
                                </Text>
                            )}
                        </View>
                    )}

                    <TouchableOpacity
                        onPress={onClose}
                        style={{
                            marginTop: 20,
                            paddingVertical: 14,
                            borderRadius: 12,
                            borderWidth: 1,
                            borderColor: colors.glassBorder,
                            alignItems: 'center',
                        }}
                    >
                        <Text style={{ color: colors.textMuted, fontWeight: '600' }}>Close</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
}

// ─── Listing Card ─────────────────────────────────────────────────────────────

function ListingCard({
    item,
    colors,
    onRedeem,
    onPress,
    numColumns,
}: {
    item: Listing;
    colors: ReturnType<typeof useTheme>['colors'];
    onRedeem: (item: Listing) => void;
    onPress: (item: Listing) => void;
    numColumns: number;
}) {
    const catColor = CATEGORY_COLORS[item.category] ?? colors.primary;

    return (
        <Pressable
            onPress={() => onPress(item)}
            style={({ pressed }) => ({
                flex: 1 / numColumns,
                margin: 6,
                backgroundColor: colors.glassBg,
                borderWidth: 1,
                borderColor: colors.glassBorder,
                borderRadius: 16,
                padding: 14,
                opacity: pressed ? 0.85 : 1,
            })}
        >
            {/* Category badge */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10, alignItems: 'center' }}>
                <View style={{
                    backgroundColor: catColor + '22',
                    borderRadius: 8,
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                }}>
                    <Text style={{ color: catColor, fontSize: 11, fontWeight: '700' }}>{item.category}</Text>
                </View>
                {/* Discount badge */}
                <View style={{
                    backgroundColor: '#10B98122',
                    borderRadius: 8,
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 3,
                }}>
                    <Percent size={11} color="#10B981" />
                    <Text style={{ color: '#10B981', fontSize: 11, fontWeight: '800' }}>
                        {item.discountPercent}% OFF
                    </Text>
                </View>
            </View>

            <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: 4 }}>{item.partnerName}</Text>
            <Text style={{ color: colors.text, fontSize: 15, fontWeight: '700', marginBottom: 6 }} numberOfLines={2}>
                {item.title}
            </Text>
            <Text style={{ color: colors.textMuted, fontSize: 13, lineHeight: 18, marginBottom: 14 }} numberOfLines={3}>
                {item.description}
            </Text>

            <TouchableOpacity
                onPress={(e) => { e.stopPropagation(); onRedeem(item); }}
                style={{
                    backgroundColor: colors.primary,
                    borderRadius: 10,
                    paddingVertical: 10,
                    alignItems: 'center',
                }}
            >
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>Redeem</Text>
            </TouchableOpacity>
        </Pressable>
    );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function MarketplaceScreen() {
    const { colors } = useTheme();
    const router = useRouter();
    const { width } = useWindowDimensions();

    const numColumns = Platform.OS !== 'web' ? (width >= 768 ? 3 : 2) : (width >= 1024 ? 3 : 2);

    const [listings, setListings] = useState<Listing[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [search, setSearch] = useState('');
    const [activeCategory, setActiveCategory] = useState<Category>('All');
    const [redeemTarget, setRedeemTarget] = useState<Listing | null>(null);
    const [redeemVisible, setRedeemVisible] = useState(false);

    // Role guard — stakeholders should be on their listings dashboard, not here
    useEffect(() => {
        getAuthUser().then((user) => {
            if (user?.role === 'stakeholder') {
                router.replace('/(main)/partner' as any);
            }
        });
    }, []);

    const fetchListings = useCallback(async (isRefresh = false) => {
        isRefresh ? setRefreshing(true) : setLoading(true);
        try {
            const cuId = getTenantId();
            const data = await communityGet(`/marketplace?cuId=${cuId}`);
            setListings(Array.isArray(data) ? data : data?.listings ?? []);
        } catch (err) {
            console.error('[Marketplace] fetch error:', err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => { fetchListings(); }, [fetchListings]);

    const filtered = useMemo(() => {
        let result = listings;
        if (activeCategory !== 'All') {
            result = result.filter(l => l.category === activeCategory);
        }
        if (search.trim()) {
            const q = search.toLowerCase();
            result = result.filter(l =>
                l.title.toLowerCase().includes(q) ||
                l.partnerName.toLowerCase().includes(q) ||
                l.description.toLowerCase().includes(q)
            );
        }
        return result;
    }, [listings, activeCategory, search]);

    const handleRedeem = (item: Listing) => {
        setRedeemTarget(item);
        setRedeemVisible(true);
    };

    const handlePress = (item: Listing) => {
        router.push(`/(main)/marketplace/${item._id}` as any);
    };

    const s = useMemo(() => createStyles(colors), [colors]);

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.appBg }} edges={['top']}>
            {/* Header */}
            <View style={s.header}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <ShoppingBag size={22} color={colors.primary} />
                        <Text style={s.title}>Marketplace</Text>
                    </View>
                    <TouchableOpacity
                        onPress={() => router.canGoBack() ? router.back() : router.replace('/(main)' as any)}
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: colors.glassBorder, backgroundColor: colors.glassBg }}
                    >
                        <ArrowLeft size={14} color={colors.textMuted} />
                        <Text style={{ color: colors.textMuted, fontSize: 13, fontWeight: '500' }}>Home</Text>
                    </TouchableOpacity>
                </View>

                {/* Search */}
                <View style={s.searchRow}>
                    <Search size={16} color={colors.textMuted} style={{ position: 'absolute', left: 12, zIndex: 1 }} />
                    <TextInput
                        style={s.searchInput}
                        placeholder="Search offers, partners..."
                        placeholderTextColor={colors.textMuted}
                        value={search}
                        onChangeText={setSearch}
                    />
                </View>

                {/* Category tabs */}
                <FlatList
                    data={CATEGORIES as unknown as Category[]}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    keyExtractor={(c) => c}
                    contentContainerStyle={{ gap: 8, paddingVertical: 4 }}
                    renderItem={({ item: cat }) => {
                        const active = cat === activeCategory;
                        return (
                            <TouchableOpacity
                                onPress={() => setActiveCategory(cat)}
                                style={[s.tab, active && s.tabActive]}
                            >
                                <Text style={[s.tabText, active && s.tabTextActive]}>{cat}</Text>
                            </TouchableOpacity>
                        );
                    }}
                />
            </View>

            {loading ? (
                <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
            ) : (
                <FlatList
                    key={`cols-${numColumns}`}
                    data={filtered}
                    numColumns={numColumns}
                    keyExtractor={(item) => item._id}
                    contentContainerStyle={{ padding: 10 }}
                    showsVerticalScrollIndicator={false}
                    refreshing={refreshing}
                    onRefresh={() => fetchListings(true)}
                    ListEmptyComponent={
                        <View style={{ alignItems: 'center', marginTop: 60 }}>
                            <Tag size={40} color={colors.textMuted} />
                            <Text style={{ color: colors.textMuted, marginTop: 12, fontSize: 15 }}>
                                No listings found
                            </Text>
                        </View>
                    }
                    renderItem={({ item }) => (
                        <ListingCard
                            item={item}
                            colors={colors}
                            onRedeem={handleRedeem}
                            onPress={handlePress}
                            numColumns={numColumns}
                        />
                    )}
                />
            )}

            <RedemptionModal
                visible={redeemVisible}
                onClose={() => setRedeemVisible(false)}
                listing={redeemTarget}
                colors={colors}
            />
        </SafeAreaView>
    );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

function createStyles(colors: ReturnType<typeof useTheme>['colors']) {
    return StyleSheet.create({
        header: {
            paddingHorizontal: 16,
            paddingTop: 16,
            paddingBottom: 10,
            borderBottomWidth: 1,
            borderBottomColor: colors.glassBorder,
        },
        title: {
            fontSize: 22,
            fontWeight: '800',
            color: colors.text,
        },
        searchRow: {
            position: 'relative',
            marginBottom: 12,
        },
        searchInput: {
            backgroundColor: colors.glassBg,
            borderWidth: 1,
            borderColor: colors.glassBorder,
            borderRadius: 12,
            paddingLeft: 38,
            paddingRight: 14,
            paddingVertical: 11,
            color: colors.text,
            fontSize: 15,
        },
        tab: {
            paddingHorizontal: 16,
            paddingVertical: 7,
            borderRadius: 20,
            backgroundColor: colors.glassBg,
            borderWidth: 1,
            borderColor: colors.glassBorder,
        },
        tabActive: {
            backgroundColor: colors.primary,
            borderColor: colors.primary,
        },
        tabText: {
            color: colors.textMuted,
            fontSize: 13,
            fontWeight: '600',
        },
        tabTextActive: {
            color: '#fff',
        },
    });
}
