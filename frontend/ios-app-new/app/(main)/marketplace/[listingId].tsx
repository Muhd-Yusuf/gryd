import React, { useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    useWindowDimensions,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
    ArrowLeft,
    Tag,
    Percent,
    ExternalLink,
    X,
    Copy,
    CheckCircle,
    CreditCard,
    Lock,
    ShieldCheck,
    DollarSign,
} from 'lucide-react-native';
import { useTheme } from '../../../lib/theme';
import { communityGet, communityPost } from '../../../lib/api';

// ─── Types ───────────────────────────────────────────────────────────────────

type ListingDetail = {
    _id: string;
    partnerName: string;
    category: string;
    title: string;
    description: string;
    discountPercent: number;
    originalPrice?: number;
    discountedPrice?: number;
    currency?: string;
    redemptionType: 'code' | 'link';
    imageUrl?: string;
    termsAndConditions?: string;
};

type RedemptionResult = {
    code?: string;
    url?: string;
    instructions?: string;
};

const CATEGORY_COLORS: Record<string, string> = {
    Discounts: '#3B82F6',
    Services: '#8B5CF6',
    Products: '#F59E0B',
    Events: '#10B981',
};

// ─── Placeholder Gradient Banner ──────────────────────────────────────────────

function ImageBanner({ category, colors }: { category: string; colors: any }) {
    const catColor = CATEGORY_COLORS[category] ?? colors.primary;
    return (
        <View style={{
            height: 200,
            backgroundColor: catColor + '33',
            borderBottomWidth: 1,
            borderBottomColor: colors.glassBorder,
            alignItems: 'center',
            justifyContent: 'center',
        }}>
            <Tag size={60} color={catColor} />
        </View>
    );
}

// ─── Payment Modal ────────────────────────────────────────────────────────────

function formatCardNumber(raw: string) {
    return raw.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim();
}
function formatExpiry(raw: string) {
    const digits = raw.replace(/\D/g, '').slice(0, 4);
    if (digits.length >= 3) return digits.slice(0, 2) + '/' + digits.slice(2);
    return digits;
}

function PaymentModal({
    visible,
    onClose,
    onSuccess,
    listing,
    colors,
}: {
    visible: boolean;
    onClose: () => void;
    onSuccess: () => void;
    listing: ListingDetail | null;
    colors: any;
}) {
    const [cardNumber, setCardNumber] = useState('');
    const [expiry, setExpiry] = useState('');
    const [cvv, setCvv] = useState('');
    const [cardName, setCardName] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [step, setStep] = useState<'form' | 'processing' | 'success'>('form');

    const reset = () => {
        setCardNumber(''); setExpiry(''); setCvv(''); setCardName('');
        setError(''); setStep('form'); setLoading(false);
    };

    const handleClose = () => { reset(); onClose(); };

    const price = listing?.discountedPrice ?? listing?.originalPrice ?? 0;
    const currency = listing?.currency ?? '$';
    const platformFee = +(price * 0.029 + 0.30).toFixed(2);
    const total = +(price + platformFee).toFixed(2);

    const handlePay = async () => {
        if (!cardNumber || !expiry || !cvv || !cardName) {
            setError('Please fill in all card details.');
            return;
        }
        setError('');
        setLoading(true);
        setStep('processing');
        try {
            await communityPost(`/marketplace/${listing?._id}/checkout`, {
                amount: total,
                currency: listing?.currency ?? 'usd',
            });
            setStep('success');
            setTimeout(() => {
                reset();
                onSuccess();
            }, 1800);
        } catch (e: any) {
            setError(e?.message ?? 'Payment failed. Please try again.');
            setStep('form');
        } finally {
            setLoading(false);
        }
    };

    const inputStyle = {
        backgroundColor: colors.glassBg,
        borderWidth: 1,
        borderColor: colors.glassBorder,
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 12,
        color: colors.text,
        fontSize: 15,
        // @ts-ignore
        outlineStyle: 'none',
    } as const;

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
            <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.7)' }}>
                <View style={{
                    backgroundColor: colors.surface,
                    borderTopLeftRadius: 28,
                    borderTopRightRadius: 28,
                    borderWidth: 1,
                    borderColor: colors.glassBorder,
                    padding: 24,
                    paddingBottom: 44,
                }}>
                    {/* Handle */}
                    <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: colors.glassBorder, alignSelf: 'center', marginBottom: 20 }} />

                    {step === 'success' ? (
                        <View style={{ alignItems: 'center', paddingVertical: 32 }}>
                            <ShieldCheck size={56} color="#10B981" />
                            <Text style={{ color: colors.text, fontSize: 20, fontWeight: '800', marginTop: 16 }}>Payment Successful!</Text>
                            <Text style={{ color: colors.textMuted, fontSize: 14, marginTop: 8, textAlign: 'center' }}>
                                Your redemption code is being generated…
                            </Text>
                        </View>
                    ) : step === 'processing' ? (
                        <View style={{ alignItems: 'center', paddingVertical: 32 }}>
                            <ActivityIndicator color={colors.primary} size="large" />
                            <Text style={{ color: colors.textMuted, fontSize: 15, marginTop: 16 }}>Processing payment…</Text>
                        </View>
                    ) : (
                        <>
                            {/* Header */}
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                    <CreditCard size={20} color={colors.primary} />
                                    <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text }}>Checkout</Text>
                                </View>
                                <TouchableOpacity onPress={handleClose}>
                                    <X size={22} color={colors.textMuted} />
                                </TouchableOpacity>
                            </View>

                            {/* Order Summary */}
                            <View style={{
                                backgroundColor: colors.glassBg,
                                borderWidth: 1,
                                borderColor: colors.glassBorder,
                                borderRadius: 14,
                                padding: 14,
                                marginBottom: 20,
                                gap: 8,
                            }}>
                                <Text style={{ color: colors.textMuted, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Order Summary</Text>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                    <Text style={{ color: colors.text, fontSize: 14, flex: 1 }} numberOfLines={1}>{listing?.title}</Text>
                                    <Text style={{ color: colors.text, fontSize: 14, fontWeight: '600' }}>{currency}{price.toFixed(2)}</Text>
                                </View>
                                {listing?.discountPercent > 0 && listing?.originalPrice && (
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                        <Text style={{ color: '#10B981', fontSize: 13 }}>{listing.discountPercent}% discount applied</Text>
                                        <Text style={{ color: '#10B981', fontSize: 13, fontWeight: '600' }}>−{currency}{(listing.originalPrice - price).toFixed(2)}</Text>
                                    </View>
                                )}
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                    <Text style={{ color: colors.textMuted, fontSize: 13 }}>Processing fee</Text>
                                    <Text style={{ color: colors.textMuted, fontSize: 13 }}>{currency}{platformFee.toFixed(2)}</Text>
                                </View>
                                <View style={{ height: 1, backgroundColor: colors.glassBorder, marginVertical: 4 }} />
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                    <Text style={{ color: colors.text, fontSize: 15, fontWeight: '700' }}>Total</Text>
                                    <Text style={{ color: colors.primary, fontSize: 15, fontWeight: '800' }}>{currency}{total.toFixed(2)}</Text>
                                </View>
                            </View>

                            {/* Card Inputs */}
                            <View style={{ gap: 10, marginBottom: 16 }}>
                                <TextInput
                                    style={inputStyle}
                                    placeholder="Cardholder name"
                                    placeholderTextColor={colors.textMuted}
                                    value={cardName}
                                    onChangeText={setCardName}
                                    autoCapitalize="words"
                                />
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                    <CreditCard size={16} color={colors.textMuted} />
                                    <TextInput
                                        style={[inputStyle, { flex: 1 }]}
                                        placeholder="Card number"
                                        placeholderTextColor={colors.textMuted}
                                        value={cardNumber}
                                        onChangeText={(t) => setCardNumber(formatCardNumber(t))}
                                        keyboardType="number-pad"
                                        maxLength={19}
                                    />
                                </View>
                                <View style={{ flexDirection: 'row', gap: 10 }}>
                                    <TextInput
                                        style={[inputStyle, { flex: 1 }]}
                                        placeholder="MM/YY"
                                        placeholderTextColor={colors.textMuted}
                                        value={expiry}
                                        onChangeText={(t) => setExpiry(formatExpiry(t))}
                                        keyboardType="number-pad"
                                        maxLength={5}
                                    />
                                    <TextInput
                                        style={[inputStyle, { flex: 1 }]}
                                        placeholder="CVV"
                                        placeholderTextColor={colors.textMuted}
                                        value={cvv}
                                        onChangeText={(t) => setCvv(t.replace(/\D/g, '').slice(0, 4))}
                                        keyboardType="number-pad"
                                        secureTextEntry
                                        maxLength={4}
                                    />
                                </View>
                            </View>

                            {!!error && (
                                <Text style={{ color: colors.error, fontSize: 13, marginBottom: 10, textAlign: 'center' }}>{error}</Text>
                            )}

                            {/* Pay Button */}
                            <TouchableOpacity
                                onPress={handlePay}
                                disabled={loading}
                                style={{
                                    backgroundColor: colors.primary,
                                    borderRadius: 14,
                                    paddingVertical: 15,
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: 8,
                                    opacity: loading ? 0.7 : 1,
                                }}
                            >
                                <Lock size={16} color="#fff" />
                                <Text style={{ color: '#fff', fontSize: 16, fontWeight: '800' }}>
                                    Pay {currency}{total.toFixed(2)}
                                </Text>
                            </TouchableOpacity>

                            {/* Security note */}
                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 12 }}>
                                <ShieldCheck size={13} color={colors.textMuted} />
                                <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                                    Secured by Stripe · SSL encrypted
                                </Text>
                            </View>
                        </>
                    )}
                </View>
            </View>
        </Modal>
    );
}

// ─── Redemption Modal ─────────────────────────────────────────────────────────

function RedemptionModal({
    visible,
    onClose,
    result,
    loading,
    error,
    colors,
}: {
    visible: boolean;
    onClose: () => void;
    result: RedemptionResult | null;
    loading: boolean;
    error: string;
    colors: any;
}) {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        if (result?.code) {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.65)' }}>
                <View style={{
                    backgroundColor: colors.surface,
                    borderTopLeftRadius: 24,
                    borderTopRightRadius: 24,
                    borderWidth: 1,
                    borderColor: colors.glassBorder,
                    padding: 24,
                    paddingBottom: 44,
                }}>
                    {/* Handle */}
                    <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: colors.glassBorder, alignSelf: 'center', marginBottom: 20 }} />

                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                        <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text }}>Your Redemption</Text>
                        <TouchableOpacity onPress={onClose}>
                            <X size={22} color={colors.textMuted} />
                        </TouchableOpacity>
                    </View>

                    {loading && (
                        <View style={{ alignItems: 'center', paddingVertical: 32 }}>
                            <ActivityIndicator color={colors.primary} size="large" />
                            <Text style={{ color: colors.textMuted, marginTop: 12 }}>Generating your code...</Text>
                        </View>
                    )}

                    {!!error && !loading && (
                        <Text style={{ color: colors.error, textAlign: 'center', marginVertical: 16 }}>{error}</Text>
                    )}

                    {result && !loading && (
                        <View style={{
                            backgroundColor: colors.glassBg,
                            borderWidth: 1,
                            borderColor: colors.glassBorder,
                            borderRadius: 16,
                            padding: 20,
                        }}>
                            {result.code && (
                                <>
                                    <Text style={{ color: colors.textMuted, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 8 }}>
                                        Redemption Code
                                    </Text>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <Text style={{
                                            fontSize: 30,
                                            fontWeight: '900',
                                            color: colors.primary,
                                            letterSpacing: 5,
                                        }}>
                                            {result.code}
                                        </Text>
                                        <TouchableOpacity onPress={handleCopy} style={{ padding: 8 }}>
                                            {copied
                                                ? <CheckCircle size={22} color={colors.successText} />
                                                : <Copy size={22} color={colors.primary} />
                                            }
                                        </TouchableOpacity>
                                    </View>
                                    {copied && (
                                        <Text style={{ color: colors.successText, fontSize: 12, marginTop: 4 }}>Copied!</Text>
                                    )}
                                </>
                            )}

                            {result.url && !result.code && (
                                <TouchableOpacity style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: 8,
                                    backgroundColor: colors.primary,
                                    borderRadius: 12,
                                    padding: 14,
                                }}>
                                    <ExternalLink size={18} color="#fff" />
                                    <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Open Redemption Link</Text>
                                </TouchableOpacity>
                            )}

                            {result.instructions && (
                                <Text style={{ color: colors.textMuted, fontSize: 13, lineHeight: 20, marginTop: 14 }}>
                                    {result.instructions}
                                </Text>
                            )}
                        </View>
                    )}

                    <TouchableOpacity
                        onPress={onClose}
                        style={{
                            marginTop: 20,
                            paddingVertical: 13,
                            borderRadius: 12,
                            borderWidth: 1,
                            borderColor: colors.glassBorder,
                            alignItems: 'center',
                        }}
                    >
                        <Text style={{ color: colors.textMuted, fontWeight: '600' }}>Done</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function ListingDetailScreen() {
    const { colors } = useTheme();
    const router = useRouter();
    const { listingId } = useLocalSearchParams<{ listingId: string }>();
    const { width } = useWindowDimensions();

    const [listing, setListing] = useState<ListingDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const [redeemVisible, setRedeemVisible] = useState(false);
    const [redeemLoading, setRedeemLoading] = useState(false);
    const [redeemResult, setRedeemResult] = useState<RedemptionResult | null>(null);
    const [redeemError, setRedeemError] = useState('');
    const [paymentVisible, setPaymentVisible] = useState(false);

    useEffect(() => {
        if (!listingId) return;
        const fetch = async () => {
            setLoading(true);
            try {
                const data = await communityGet(`/marketplace/${listingId}`);
                setListing(data?.listing ?? data);
            } catch {
                setError('Could not load listing. Please go back and try again.');
            } finally {
                setLoading(false);
            }
        };
        fetch();
    }, [listingId]);

    const isPaid = !!(listing?.discountedPrice || listing?.originalPrice);

    const openRedemption = async () => {
        setRedeemResult(null);
        setRedeemError('');
        setRedeemVisible(true);
        setRedeemLoading(true);
        try {
            const data = await communityPost(`/marketplace/${listingId}/redeem`, {});
            setRedeemResult(data?.redemption ?? data);
        } catch {
            setRedeemError('Could not generate redemption. Please try again.');
        } finally {
            setRedeemLoading(false);
        }
    };

    const handleRedeem = () => {
        if (isPaid) {
            setPaymentVisible(true);
        } else {
            openRedemption();
        }
    };

    const s = useMemo(() => createStyles(colors), [colors]);
    const isWide = width >= 768;

    if (loading) {
        return (
            <SafeAreaView style={[s.screen]} edges={['top']}>
                <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
                    <ArrowLeft size={22} color={colors.text} />
                </TouchableOpacity>
                <ActivityIndicator color={colors.primary} style={{ marginTop: 60 }} />
            </SafeAreaView>
        );
    }

    if (error || !listing) {
        return (
            <SafeAreaView style={s.screen} edges={['top']}>
                <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
                    <ArrowLeft size={22} color={colors.text} />
                </TouchableOpacity>
                <Text style={{ color: colors.error, textAlign: 'center', marginTop: 60, paddingHorizontal: 24 }}>
                    {error || 'Listing not found.'}
                </Text>
            </SafeAreaView>
        );
    }

    const catColor = CATEGORY_COLORS[listing.category] ?? colors.primary;
    const currency = listing.currency ?? '$';

    return (
        <SafeAreaView style={s.screen} edges={['top']}>
            {/* Back button overlay */}
            <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
                <ArrowLeft size={22} color={colors.text} />
            </TouchableOpacity>

            <ScrollView showsVerticalScrollIndicator={false}>
                <ImageBanner category={listing.category} colors={colors} />

                <View style={[s.body, isWide && { maxWidth: 680, alignSelf: 'center', width: '100%' }]}>
                    {/* Category + Discount badges */}
                    <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
                        <View style={{ backgroundColor: catColor + '22', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 }}>
                            <Text style={{ color: catColor, fontWeight: '700', fontSize: 12 }}>{listing.category}</Text>
                        </View>
                        <View style={{ backgroundColor: '#10B98122', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                            <Percent size={12} color="#10B981" />
                            <Text style={{ color: '#10B981', fontWeight: '800', fontSize: 12 }}>{listing.discountPercent}% OFF</Text>
                        </View>
                    </View>

                    <Text style={{ color: colors.textMuted, fontSize: 13, marginBottom: 6 }}>{listing.partnerName}</Text>
                    <Text style={{ color: colors.text, fontSize: 22, fontWeight: '800', marginBottom: 12 }}>{listing.title}</Text>

                    {/* Pricing */}
                    {(listing.originalPrice || listing.discountedPrice) ? (
                        <View style={{
                            backgroundColor: colors.glassBg,
                            borderWidth: 1,
                            borderColor: colors.glassBorder,
                            borderRadius: 16,
                            padding: 16,
                            marginBottom: 16,
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 16,
                        }}>
                            {listing.originalPrice && (
                                <Text style={{ color: colors.textMuted, fontSize: 18, textDecorationLine: 'line-through' }}>
                                    {currency}{listing.originalPrice.toFixed(2)}
                                </Text>
                            )}
                            {listing.discountedPrice && (
                                <Text style={{ color: '#10B981', fontSize: 24, fontWeight: '800' }}>
                                    {currency}{listing.discountedPrice.toFixed(2)}
                                </Text>
                            )}
                        </View>
                    ) : null}

                    {/* Description */}
                    <View style={{
                        backgroundColor: colors.glassBg,
                        borderWidth: 1,
                        borderColor: colors.glassBorder,
                        borderRadius: 16,
                        padding: 16,
                        marginBottom: 16,
                    }}>
                        <Text style={{ color: colors.textMuted, fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
                            About This Offer
                        </Text>
                        <Text style={{ color: colors.text, fontSize: 15, lineHeight: 24 }}>{listing.description}</Text>
                    </View>

                    {/* Terms */}
                    {listing.termsAndConditions && (
                        <View style={{
                            backgroundColor: colors.glassBg,
                            borderWidth: 1,
                            borderColor: colors.glassBorder,
                            borderRadius: 16,
                            padding: 16,
                            marginBottom: 24,
                        }}>
                            <Text style={{ color: colors.textMuted, fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
                                Terms & Conditions
                            </Text>
                            <Text style={{ color: colors.textMuted, fontSize: 13, lineHeight: 20 }}>
                                {listing.termsAndConditions}
                            </Text>
                        </View>
                    )}

                    {/* Redeem / Buy Button */}
                    <TouchableOpacity onPress={handleRedeem} style={s.redeemBtn}>
                        {isPaid
                            ? <DollarSign size={18} color="#fff" />
                            : <Tag size={18} color="#fff" />
                        }
                        <Text style={s.redeemBtnText}>
                            {isPaid
                                ? `Buy Now · ${listing?.currency ?? '$'}${(listing?.discountedPrice ?? listing?.originalPrice ?? 0).toFixed(2)}`
                                : 'Redeem Now'
                            }
                        </Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>

            <PaymentModal
                visible={paymentVisible}
                onClose={() => setPaymentVisible(false)}
                onSuccess={() => {
                    setPaymentVisible(false);
                    openRedemption();
                }}
                listing={listing}
                colors={colors}
            />

            <RedemptionModal
                visible={redeemVisible}
                onClose={() => setRedeemVisible(false)}
                result={redeemResult}
                loading={redeemLoading}
                error={redeemError}
                colors={colors}
            />
        </SafeAreaView>
    );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

function createStyles(colors: ReturnType<typeof useTheme>['colors']) {
    return StyleSheet.create({
        screen: {
            flex: 1,
            backgroundColor: colors.appBg,
        },
        backBtn: {
            position: 'absolute',
            top: 56,
            left: 16,
            zIndex: 10,
            backgroundColor: colors.glassBg,
            borderWidth: 1,
            borderColor: colors.glassBorder,
            borderRadius: 20,
            padding: 8,
        },
        body: {
            padding: 20,
        },
        redeemBtn: {
            backgroundColor: colors.primary,
            borderRadius: 14,
            paddingVertical: 16,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            marginBottom: 32,
        },
        redeemBtnText: {
            color: '#fff',
            fontWeight: '800',
            fontSize: 17,
        },
    });
}
