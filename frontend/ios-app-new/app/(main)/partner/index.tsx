import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    KeyboardAvoidingView,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
    LayoutList,
    BarChart3,
    DollarSign,
    TrendingUp,
    Plus,
    Edit3,
    Trash2,
    X,
    Percent,
    Tag,
    CheckCircle,
    Circle,
    AlertCircle,
    FileText,
    Handshake,
    MapPin,
    Search,
    Users,
    Building2,
    ArrowLeft,
} from 'lucide-react-native';
import { useTheme } from '../../../lib/theme';
import { communityGet, communityPost, communityPut, communityDelete, getAuthUser } from '../../../lib/api';
import { useRouter } from 'expo-router';
import {
    GlassButton,
    GlassBadge,
    GlassCard,
    GlassInput,
    GlassStatCard,
    GlassIconButton,
    GradientBackground,
} from '../../../components/glass';
import { LinearGradient } from 'expo-linear-gradient';
import SafeBlurView from '../../../components/SafeBlurView';

// ─── Types ────────────────────────────────────────────────────────────────────

type Listing = {
    _id: string;
    title: string;
    description: string;
    category: 'Discounts' | 'Services' | 'Products' | 'Events';
    discountPercent: number;
    redemptionType: 'code' | 'link';
    redemptionValue: string;
    isActive: boolean;
};

type MonthlySummary = {
    month: string;  // e.g. "2026-03"
    label: string;  // e.g. "Mar"
    total: number;
};

type Transaction = {
    _id: string;
    amount: number;
    description: string;
    date: string;
    status: 'paid' | 'pending' | 'failed';
};

type Tab = 'listings' | 'analytics' | 'partnerships';
type FormCategory = 'Discounts' | 'Services' | 'Products' | 'Events';

type Community = {
    id: string;
    name: string;
    memberCount?: number;
    location?: string;
    partnershipStatus?: 'Open' | 'By Invite' | 'Closed';
    description?: string;
};

type PartnerApplication = {
    id: string;
    communityName?: string;
    submittedAt?: string;
    status?: 'Pending' | 'Approved' | 'Rejected' | 'Under Review';
    proposal?: string;
    feedback?: string;
};
type RedemptionType = 'code' | 'link';

const LISTING_CATEGORIES: FormCategory[] = ['Discounts', 'Services', 'Products', 'Events'];

const CATEGORY_COLORS: Record<string, string> = {
    Discounts: '#3B82F6',
    Services: '#8B5CF6',
    Products: '#F59E0B',
    Events: '#10B981',
};

const EMPTY_FORM = {
    title: '',
    description: '',
    category: 'Discounts' as FormCategory,
    discountPercent: '',
    redemptionType: 'code' as RedemptionType,
    redemptionValue: '',
};

const PARTNERSHIP_CATEGORIES = ['Retail','Financial','Healthcare','Technology','Food & Beverage','Professional Services','Other'];

function nameToColor(name: string): string {
    const palette = ['#6366F1','#EC4899','#F59E0B','#10B981','#3B82F6','#EF4444','#8B5CF6','#14B8A6'];
    let h = 0;
    for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
    return palette[Math.abs(h) % palette.length];
}
function getInitials(name: string): string {
    const words = name.trim().split(/\s+/);
    return words.length === 1 ? name.slice(0,2).toUpperCase() : (words[0][0]+words[1][0]).toUpperCase();
}
function formatPartnerDate(iso?: string): string {
    if (!iso) return '—';
    try { return new Date(iso).toLocaleDateString(undefined, {year:'numeric',month:'short',day:'numeric'}); } catch { return iso; }
}
function psBadgeVariant(s?: string): 'success'|'warning'|'danger'|'muted' {
    return s==='Open' ? 'success' : s==='By Invite' ? 'warning' : s==='Closed' ? 'danger' : 'muted';
}
function asBadgeVariant(s?: string): 'warning'|'success'|'danger'|'info'|'muted' {
    return s==='Pending' ? 'warning' : s==='Approved' ? 'success' : s==='Rejected' ? 'danger' : s==='Under Review' ? 'info' : 'muted';
}

// ─── Glass Surface Helper ─────────────────────────────────────────────────────

function GlassSurface({ children, style, mode, colors }: {
    children: React.ReactNode; style?: object;
    mode: 'dark'|'light'; colors: ReturnType<typeof useTheme>['colors'];
}) {
    return (
        <SafeBlurView intensity={20} tint={mode==='dark'?'dark':'light'} style={[{borderRadius:20,overflow:'hidden'},style]}>
            <LinearGradient
                colors={mode==='dark'?['rgba(255,255,255,0.08)','rgba(255,255,255,0.04)']:['rgba(255,255,255,0.92)','rgba(255,255,255,0.72)']}
                style={{...StyleSheet.absoluteFillObject as any}}
            />
            <View style={{position:'absolute',top:0,left:10,right:10,height:1,backgroundColor:'rgba(255,255,255,0.55)',borderRadius:1}} />
            <View style={{borderWidth:1,borderColor:colors.glassBorder,borderRadius:20,flex:1,overflow:'hidden'}}>
                {children}
            </View>
        </SafeBlurView>
    );
}

// ─── Application Modal ────────────────────────────────────────────────────────

function ApplicationModal({ visible, community, onClose, colors, mode }: {
    visible: boolean; community: Community|null; onClose: ()=>void;
    colors: ReturnType<typeof useTheme>['colors']; mode: 'dark'|'light';
}) {
    const [businessName, setBusinessName] = useState('');
    const [website, setWebsite] = useState('');
    const [category, setCategory] = useState('');
    const [proposal, setProposal] = useState('');
    const [expectedValue, setExpectedValue] = useState('');
    const [contactEmail, setContactEmail] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState('');

    useEffect(()=>{
        if(visible){setBusinessName('');setWebsite('');setCategory('');setProposal('');setExpectedValue('');setContactEmail('');setSubmitting(false);setSubmitted(false);setError('');}
    },[visible]);

    const handleSubmit = async () => {
        if (!community) return;
        setError(''); setSubmitting(true);
        try {
            await communityPost('/partnership-forum/apply', {
                targetCuId: community.id,
                businessName,
                contactEmail,
                website,
                businessType: category,
                pitch: proposal + (expectedValue ? `\n\nExpected member value: ${expectedValue}` : ''),
            });
            setSubmitted(true);
        } catch(e:any){ setError(e?.message??'Failed to submit. Please try again.'); }
        finally { setSubmitting(false); }
    };

    const gradColors: [string,string] = mode==='dark' ? ['rgba(20,20,30,0.98)','rgba(10,10,20,0.99)'] : ['rgba(255,255,255,0.98)','rgba(245,247,255,0.99)'];

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <KeyboardAvoidingView behavior={Platform.OS==='ios'?'padding':'height'} style={{flex:1,justifyContent:'flex-end',backgroundColor:'rgba(0,0,0,0.60)'}}>
                <SafeBlurView intensity={20} tint={mode==='dark'?'dark':'light'} style={{borderTopLeftRadius:28,borderTopRightRadius:28,overflow:'hidden'}}>
                    <LinearGradient colors={gradColors} style={StyleSheet.absoluteFillObject as any} />
                    <View style={{position:'absolute',top:0,left:10,right:10,height:1,backgroundColor:'rgba(255,255,255,0.55)',borderRadius:1}} />
                    <View style={{padding:24,paddingBottom:40,maxHeight:'92%'}}>
                        <View style={{width:40,height:4,backgroundColor:colors.glassBorder,borderRadius:2,alignSelf:'center',marginBottom:20}} />
                        <View style={{flexDirection:'row',alignItems:'flex-start',justifyContent:'space-between',marginBottom:20}}>
                            <Text style={{color:colors.text,fontSize:18,fontWeight:'700',flex:1,paddingRight:12}}>Apply to Partner with{'\n'}{community?.name??''}</Text>
                            <GlassIconButton icon={<X size={18} color={colors.textMuted}/>} onPress={onClose} variant="ghost" size="sm" />
                        </View>
                        {submitted ? (
                            <View style={{alignItems:'center',paddingVertical:32,gap:16}}>
                                <CheckCircle size={56} color="#22C55E" />
                                <Text style={{color:colors.text,fontSize:20,fontWeight:'700'}}>Application Submitted!</Text>
                                <Text style={{color:colors.textMuted,fontSize:14,textAlign:'center'}}>Your partnership application has been sent. The community will review it and get back to you.</Text>
                                <GlassButton label="Done" onPress={onClose} variant="primary" fullWidth style={{marginTop:8}} />
                            </View>
                        ) : (
                            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{gap:14,paddingBottom:8}}>
                                <GlassInput label="Business Name" placeholder="Your business name" value={businessName} onChangeText={setBusinessName} returnKeyType="next" />
                                <GlassInput label="Business Website" placeholder="https://example.com" value={website} onChangeText={setWebsite} keyboardType="url" autoCapitalize="none" />
                                <View style={{gap:6}}>
                                    <Text style={{color:colors.textMuted,fontSize:13,fontWeight:'600',letterSpacing:0.3}}>Category</Text>
                                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:8,paddingVertical:2}}>
                                        {PARTNERSHIP_CATEGORIES.map(cat=>(
                                            <GlassButton key={cat} label={cat} onPress={()=>setCategory(cat)} variant={category===cat?'primary':'ghost'} size="sm" />
                                        ))}
                                    </ScrollView>
                                </View>
                                <View style={{gap:4}}>
                                    <GlassInput label="Partnership Proposal" placeholder="Describe your proposal..." value={proposal} onChangeText={setProposal} multiline numberOfLines={5} maxLength={500} inputStyle={{minHeight:100,textAlignVertical:'top'} as any} />
                                    <Text style={{color:colors.textSubtle,fontSize:12,textAlign:'right'}}>{proposal.length}/500</Text>
                                </View>
                                <View style={{gap:4}}>
                                    <GlassInput label="Expected Value for Members" placeholder="What value will members get?" value={expectedValue} onChangeText={setExpectedValue} multiline numberOfLines={3} maxLength={200} inputStyle={{minHeight:70,textAlignVertical:'top'} as any} />
                                    <Text style={{color:colors.textSubtle,fontSize:12,textAlign:'right'}}>{expectedValue.length}/200</Text>
                                </View>
                                <GlassInput label="Contact Email" placeholder="contact@yourbusiness.com" value={contactEmail} onChangeText={setContactEmail} keyboardType="email-address" autoCapitalize="none" returnKeyType="done" />
                                {error ? <Text style={{color:'#EF4444',fontSize:13,fontWeight:'500'}}>{error}</Text> : null}
                                <GlassButton label="Submit Application" onPress={handleSubmit} variant="primary" fullWidth loading={submitting} style={{marginTop:4}} />
                            </ScrollView>
                        )}
                    </View>
                </SafeBlurView>
            </KeyboardAvoidingView>
        </Modal>
    );
}

// ─── Create / Edit Modal ──────────────────────────────────────────────────────

function ListingFormModal({
    visible,
    onClose,
    onSaved,
    editing,
    colors,
}: {
    visible: boolean;
    onClose: () => void;
    onSaved: () => void;
    editing: Listing | null;
    colors: ReturnType<typeof useTheme>['colors'];
}) {
    const [form, setForm] = useState(EMPTY_FORM);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (visible) {
            if (editing) {
                setForm({
                    title: editing.title,
                    description: editing.description,
                    category: editing.category,
                    discountPercent: String(editing.discountPercent ?? ''),
                    redemptionType: editing.redemptionType,
                    redemptionValue: editing.redemptionValue ?? '',
                });
            } else {
                setForm(EMPTY_FORM);
            }
            setError('');
        }
    }, [visible, editing]);

    const handleSave = async () => {
        if (!form.title.trim()) {
            setError('Title is required.');
            return;
        }
        if (!form.redemptionValue.trim()) {
            setError('Redemption value is required.');
            return;
        }
        setSaving(true);
        setError('');
        try {
            const payload = {
                title: form.title.trim(),
                description: form.description.trim(),
                category: form.category,
                discountPercent: Number(form.discountPercent) || 0,
                redemptionType: form.redemptionType,
                redemptionValue: form.redemptionValue.trim(),
            };
            if (editing) {
                await communityPut(`/marketplace/${editing._id}`, payload);
            } else {
                await communityPost('/marketplace', payload);
            }
            onSaved();
            onClose();
        } catch (e: any) {
            setError(e?.message ?? 'Failed to save listing. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <KeyboardAvoidingView
                style={{ flex: 1, justifyContent: 'flex-end' }}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
                {/* Dimmed backdrop */}
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.60)' }} />

                {/* Glass sheet */}
                <GlassCard
                    variant="modal"
                    style={styles.sheet}
                >
                    {/* Handle */}
                    <View style={styles.sheetHandle} />

                    {/* Header */}
                    <View style={styles.sheetHeader}>
                        <Text style={[styles.sheetTitle, { color: colors.text }]}>
                            {editing ? 'Edit Listing' : 'New Listing'}
                        </Text>
                        <GlassIconButton
                            icon={<X size={18} color={colors.textMuted} />}
                            onPress={onClose}
                            variant="ghost"
                            size="sm"
                            accessibilityLabel="Close modal"
                        />
                    </View>

                    <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                        {/* Title */}
                        <GlassInput
                            label="Title *"
                            placeholder="e.g. 20% off premium membership"
                            value={form.title}
                            onChangeText={(v) => setForm(f => ({ ...f, title: v }))}
                            containerStyle={styles.fieldSpacing}
                        />

                        {/* Description */}
                        <GlassInput
                            label="Description"
                            placeholder="Describe the offer..."
                            value={form.description}
                            onChangeText={(v) => setForm(f => ({ ...f, description: v }))}
                            multiline
                            numberOfLines={3}
                            inputStyle={{ minHeight: 80, textAlignVertical: 'top' }}
                            containerStyle={styles.fieldSpacing}
                        />

                        {/* Category chips */}
                        <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Category</Text>
                        <View style={styles.chipRow}>
                            {LISTING_CATEGORIES.map((cat) => {
                                const active = form.category === cat;
                                const catColor = CATEGORY_COLORS[cat] ?? colors.primary;
                                return (
                                    <TouchableOpacity
                                        key={cat}
                                        onPress={() => setForm(f => ({ ...f, category: cat }))}
                                        style={[
                                            styles.chip,
                                            {
                                                backgroundColor: active ? catColor : colors.glassBg,
                                                borderColor: active ? catColor : colors.glassBorder,
                                            },
                                        ]}
                                    >
                                        <Text style={[styles.chipText, { color: active ? '#fff' : colors.textMuted }]}>
                                            {cat}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>

                        {/* Discount % */}
                        <GlassInput
                            label="Discount %"
                            placeholder="0"
                            value={form.discountPercent}
                            onChangeText={(v) => setForm(f => ({ ...f, discountPercent: v.replace(/[^0-9]/g, '') }))}
                            keyboardType="numeric"
                            icon={<Percent size={16} color={colors.textMuted} />}
                            containerStyle={styles.fieldSpacing}
                        />

                        {/* Redemption Type toggle */}
                        <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Redemption Type</Text>
                        <View style={styles.toggleRow}>
                            {(['code', 'link'] as RedemptionType[]).map((t) => {
                                const active = form.redemptionType === t;
                                return (
                                    <TouchableOpacity
                                        key={t}
                                        onPress={() => setForm(f => ({ ...f, redemptionType: t }))}
                                        style={[
                                            styles.toggleBtn,
                                            {
                                                backgroundColor: active ? colors.primary : colors.glassBg,
                                                borderColor: active ? colors.primary : colors.glassBorder,
                                            },
                                        ]}
                                    >
                                        <Text style={[styles.toggleBtnText, { color: active ? '#fff' : colors.textMuted }]}>
                                            {t === 'code' ? 'Promo Code' : 'Link / URL'}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>

                        {/* Redemption Value */}
                        <GlassInput
                            label={form.redemptionType === 'code' ? 'Promo Code *' : 'Redemption URL *'}
                            placeholder={form.redemptionType === 'code' ? 'e.g. SAVE20' : 'https://...'}
                            value={form.redemptionValue}
                            onChangeText={(v) => setForm(f => ({ ...f, redemptionValue: v }))}
                            autoCapitalize={form.redemptionType === 'code' ? 'characters' : 'none'}
                            keyboardType={form.redemptionType === 'link' ? 'url' : 'default'}
                            containerStyle={styles.fieldSpacing}
                        />

                        {!!error && (
                            <View style={styles.errorRow}>
                                <AlertCircle size={14} color={colors.error} />
                                <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
                            </View>
                        )}

                        <View style={styles.saveBtnWrap}>
                            <GlassButton
                                label={editing ? 'Save Changes' : 'Create Listing'}
                                onPress={handleSave}
                                variant="primary"
                                size="lg"
                                loading={saving}
                                fullWidth
                            />
                        </View>

                        <View style={{ height: 24 }} />
                    </ScrollView>
                </GlassCard>
            </KeyboardAvoidingView>
        </Modal>
    );
}

// ─── Listing Card ─────────────────────────────────────────────────────────────

function PartnerListingCard({
    item,
    colors,
    onEdit,
    onDeactivate,
}: {
    item: Listing;
    colors: ReturnType<typeof useTheme>['colors'];
    onEdit: (item: Listing) => void;
    onDeactivate: (item: Listing) => void;
}) {
    const catColor = CATEGORY_COLORS[item.category] ?? colors.primary;

    return (
        <GlassCard style={{ marginBottom: 12, opacity: item.isActive ? 1 : 0.55 }}>
            <View style={{ padding: 16 }}>
                {/* Top row: category + status */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                        <View style={{
                            backgroundColor: catColor + '22',
                            borderRadius: 8,
                            paddingHorizontal: 8,
                            paddingVertical: 3,
                        }}>
                            <Text style={{ color: catColor, fontSize: 11, fontWeight: '700' }}>{item.category}</Text>
                        </View>
                        {item.discountPercent > 0 && (
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
                        )}
                    </View>
                    {/* Active / Inactive badge */}
                    <View style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 4,
                        backgroundColor: item.isActive ? '#10B98122' : '#EF444422',
                        borderRadius: 8,
                        paddingHorizontal: 8,
                        paddingVertical: 3,
                    }}>
                        {item.isActive
                            ? <CheckCircle size={11} color="#10B981" />
                            : <Circle size={11} color="#EF4444" />
                        }
                        <Text style={{
                            fontSize: 11,
                            fontWeight: '700',
                            color: item.isActive ? '#10B981' : '#EF4444',
                        }}>
                            {item.isActive ? 'Active' : 'Inactive'}
                        </Text>
                    </View>
                </View>

                <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 4 }} numberOfLines={2}>
                    {item.title}
                </Text>
                {!!item.description && (
                    <Text style={{ fontSize: 13, color: colors.textMuted, lineHeight: 18, marginBottom: 12 }} numberOfLines={2}>
                        {item.description}
                    </Text>
                )}

                {/* Redemption info */}
                <GlassCard style={{ marginBottom: 14 }}>
                    <View style={{ paddingHorizontal: 12, paddingVertical: 8 }}>
                        <Text style={{ fontSize: 11, color: colors.textMuted, marginBottom: 2, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                            {item.redemptionType === 'code' ? 'Promo Code' : 'Link'}
                        </Text>
                        <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }} numberOfLines={1}>
                            {item.redemptionValue}
                        </Text>
                    </View>
                </GlassCard>

                {/* Action buttons */}
                <View style={{ flexDirection: 'row', gap: 10 }}>
                    <View style={{ flex: 1 }}>
                        <GlassButton
                            label="Edit"
                            onPress={() => onEdit(item)}
                            variant="primary"
                            size="sm"
                            icon={<Edit3 size={14} color="#fff" />}
                            fullWidth
                        />
                    </View>
                    <View style={{ flex: 1 }}>
                        <GlassButton
                            label={item.isActive ? 'Deactivate' : 'Reactivate'}
                            onPress={() => onDeactivate(item)}
                            variant={item.isActive ? 'danger' : 'secondary'}
                            size="sm"
                            icon={<Trash2 size={14} color={item.isActive ? undefined : colors.textMuted} />}
                            fullWidth
                        />
                    </View>
                </View>
            </View>
        </GlassCard>
    );
}

// ─── Analytics Tab ────────────────────────────────────────────────────────────

function AnalyticsTab({
    colors,
}: {
    colors: ReturnType<typeof useTheme>['colors'];
}) {
    const [summary, setSummary] = useState<MonthlySummary[]>([]);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [summaryData, txData] = await Promise.all([
                communityGet('/revshare/partner/summary').catch(() => null),
                communityGet('/revshare/partner/transactions').catch(() => null),
            ]);
            setSummary(Array.isArray(summaryData) ? summaryData : summaryData?.months ?? []);
            setTransactions(Array.isArray(txData) ? txData : txData?.transactions ?? []);
        } catch {
            // silently fail — show empty state
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    const maxEarning = useMemo(
        () => Math.max(...summary.map(m => m.total), 1),
        [summary]
    );

    const totalEarned = useMemo(
        () => summary.reduce((acc, m) => acc + m.total, 0),
        [summary]
    );

    if (loading) {
        return <ActivityIndicator color={colors.primary} style={{ marginTop: 48 }} />;
    }


    return (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
            {/* Total earnings summary stat card */}
            <GlassStatCard
                label="Total RevShare Earned"
                value={`$${totalEarned.toFixed(2)}`}
                icon={<DollarSign size={20} color="#3B82F6" />}
                accent="rgba(59,130,246,0.85)"
                style={{ marginBottom: 14 }}
            />

            {/* Monthly bar chart */}
            {summary.length > 0 && (
                <GlassCard style={{ marginBottom: 14 }}>
                    <View style={{ padding: 16 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                            <TrendingUp size={16} color={colors.primary} />
                            <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>
                                Monthly Earnings
                            </Text>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, minHeight: 100 }}>
                            {summary.slice(-6).map((m) => {
                                const barHeight = Math.max((m.total / maxEarning) * 90, 4);
                                return (
                                    <View key={m.month} style={{ flex: 1, alignItems: 'center', gap: 6 }}>
                                        <Text style={{ fontSize: 10, color: colors.textMuted, fontWeight: '600' }}>
                                            ${m.total % 1 === 0 ? m.total : m.total.toFixed(0)}
                                        </Text>
                                        <View
                                            style={{
                                                width: '100%',
                                                height: barHeight,
                                                backgroundColor: colors.primary,
                                                borderRadius: 6,
                                                opacity: 0.85,
                                            }}
                                        />
                                        <Text style={{ fontSize: 10, color: colors.textMuted }}>
                                            {m.label ?? m.month?.slice(-2)}
                                        </Text>
                                    </View>
                                );
                            })}
                        </View>
                    </View>
                </GlassCard>
            )}

            {summary.length === 0 && (
                <View style={{ alignItems: 'center', paddingVertical: 32 }}>
                    <BarChart3 size={40} color={colors.textMuted} />
                    <Text style={{ color: colors.textMuted, marginTop: 12, fontSize: 14 }}>
                        No earnings data yet
                    </Text>
                </View>
            )}

            {/* Transactions list */}
            {transactions.length > 0 && (
                <GlassCard style={{ marginBottom: 14 }}>
                    <View style={{ padding: 16 }}>
                        <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 14 }}>
                            Recent Transactions
                        </Text>
                        {transactions.slice(0, 20).map((tx, idx) => (
                            <View
                                key={tx._id ?? idx}
                                style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    paddingVertical: 12,
                                    borderBottomWidth: idx < transactions.length - 1 ? 1 : 0,
                                    borderBottomColor: colors.glassBorder,
                                }}
                            >
                                <View style={{ flex: 1 }}>
                                    <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }} numberOfLines={1}>
                                        {tx.description}
                                    </Text>
                                    <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>
                                        {tx.date ? new Date(tx.date).toLocaleDateString() : '—'}
                                    </Text>
                                </View>
                                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                                    <Text style={{ fontSize: 15, fontWeight: '800', color: colors.text }}>
                                        ${tx.amount?.toFixed(2) ?? '0.00'}
                                    </Text>
                                    <View style={{
                                        paddingHorizontal: 8,
                                        paddingVertical: 2,
                                        borderRadius: 8,
                                        backgroundColor:
                                            tx.status === 'paid' ? '#10B98122' :
                                            tx.status === 'pending' ? '#F59E0B22' : '#EF444422',
                                    }}>
                                        <Text style={{
                                            fontSize: 10,
                                            fontWeight: '700',
                                            textTransform: 'capitalize',
                                            color:
                                                tx.status === 'paid' ? '#10B981' :
                                                tx.status === 'pending' ? '#F59E0B' : '#EF4444',
                                        }}>
                                            {tx.status}
                                        </Text>
                                    </View>
                                </View>
                            </View>
                        ))}
                    </View>
                </GlassCard>
            )}
        </ScrollView>
    );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function PartnerDashboardScreen() {
    const { colors, mode } = useTheme();
    const router = useRouter();

    // Role guard — members should not be here
    useEffect(() => {
        getAuthUser().then((user) => {
            if (user && user.role !== 'stakeholder') {
                router.replace('/(main)/marketplace' as any);
            }
        });
    }, []);

    const [activeTab, setActiveTab] = useState<Tab>('listings');
    const [listings, setListings] = useState<Listing[]>([]);
    const [loadingListings, setLoadingListings] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [modalVisible, setModalVisible] = useState(false);
    const [editingListing, setEditingListing] = useState<Listing | null>(null);

    // Partnerships state
    const [communities, setCommunities] = useState<Community[]>([]);
    const [communitiesLoading, setCommunitiesLoading] = useState(false);
    const [communitySearch, setCommunitySearch] = useState('');
    const [selectedCommunity, setSelectedCommunity] = useState<Community|null>(null);
    const [applyModalVisible, setApplyModalVisible] = useState(false);
    const [applications, setApplications] = useState<PartnerApplication[]>([]);
    const [applicationsLoading, setApplicationsLoading] = useState(false);
    const [expandedAppId, setExpandedAppId] = useState<string|null>(null);
    const [partnerSubTab, setPartnerSubTab] = useState<'browse'|'applications'>('browse');

    const fetchListings = useCallback(async (isRefresh = false) => {
        isRefresh ? setRefreshing(true) : setLoadingListings(true);
        try {
            const data = await communityGet('/marketplace/partner/listings');
            setListings(Array.isArray(data) ? data : (data?.listings ?? data?.data ?? []));
        } catch (err) {
            console.error('[PartnerDashboard] fetch listings error:', err);
        } finally {
            setLoadingListings(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => { fetchListings(); }, [fetchListings]);

    const fetchCommunities = useCallback(async () => {
        setCommunitiesLoading(true);
        try {
            const data = await communityGet('/partnership-forum/communities');
            setCommunities(Array.isArray(data) ? data : (data?.communities ?? data?.data ?? []));
        } catch { setCommunities([]); } finally { setCommunitiesLoading(false); }
    }, []);

    const fetchApplications = useCallback(async () => {
        setApplicationsLoading(true);
        try {
            const data = await communityGet('/partnership-forum/my-applications');
            setApplications(Array.isArray(data) ? data : (data?.applications ?? data?.data ?? []));
        } catch { setApplications([]); } finally { setApplicationsLoading(false); }
    }, []);

    useEffect(() => { if (activeTab === 'partnerships') fetchCommunities(); }, [activeTab, fetchCommunities]);
    useEffect(() => { if (activeTab === 'partnerships' && partnerSubTab === 'applications') fetchApplications(); }, [activeTab, partnerSubTab, fetchApplications]);

    const handleOpenCreate = () => {
        setEditingListing(null);
        setModalVisible(true);
    };

    const handleOpenEdit = (item: Listing) => {
        setEditingListing(item);
        setModalVisible(true);
    };

    const handleDeactivate = (item: Listing) => {
        Alert.alert(
            item.isActive ? 'Deactivate Listing' : 'Reactivate Listing',
            item.isActive
                ? `"${item.title}" will no longer be visible in the marketplace.`
                : `"${item.title}" will become visible in the marketplace again.`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: item.isActive ? 'Deactivate' : 'Reactivate',
                    style: item.isActive ? 'destructive' : 'default',
                    onPress: async () => {
                        try {
                            await communityDelete(`/marketplace/${item._id}`);
                            fetchListings();
                        } catch (e: any) {
                            Alert.alert('Error', e?.message ?? 'Could not update listing.');
                        }
                    },
                },
            ]
        );
    };

    return (
        <GradientBackground>
            <SafeAreaView style={{ flex: 1 }} edges={['top']}>
                {/* Header */}
                <View style={[styles.header, { borderBottomColor: colors.glassBorder }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                            <LayoutList size={22} color={colors.primary} />
                            <Text style={[styles.title, { color: colors.text }]}>My Listings</Text>
                        </View>
                        <TouchableOpacity
                            onPress={() => router.canGoBack() ? router.back() : router.replace('/(main)' as any)}
                            style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: colors.glassBorder, backgroundColor: colors.glassBg }}
                        >
                            <ArrowLeft size={14} color={colors.textMuted} />
                            <Text style={{ color: colors.textMuted, fontSize: 13, fontWeight: '500' }}>Home</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Tab bar */}
                <View style={[styles.tabBar, { borderBottomColor: colors.glassBorder }]}>
                    <TouchableOpacity
                        onPress={() => setActiveTab('listings')}
                        style={[
                            styles.tabItem,
                            {
                                backgroundColor: colors.glassBg,
                                borderColor: activeTab === 'listings' ? colors.primary : colors.glassBorder,
                            },
                        ]}
                    >
                        <Tag size={14} color={activeTab === 'listings' ? colors.primary : colors.textMuted} />
                        <Text style={[styles.tabText, { color: activeTab === 'listings' ? colors.primary : colors.textMuted }]}>
                            My Listings
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => setActiveTab('analytics')}
                        style={[
                            styles.tabItem,
                            {
                                backgroundColor: colors.glassBg,
                                borderColor: activeTab === 'analytics' ? colors.primary : colors.glassBorder,
                            },
                        ]}
                    >
                        <BarChart3 size={14} color={activeTab === 'analytics' ? colors.primary : colors.textMuted} />
                        <Text style={[styles.tabText, { color: activeTab === 'analytics' ? colors.primary : colors.textMuted }]}>
                            Analytics
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => setActiveTab('partnerships')}
                        style={[styles.tabItem, {backgroundColor: colors.glassBg, borderColor: activeTab==='partnerships' ? colors.primary : colors.glassBorder}]}
                    >
                        <Handshake size={14} color={activeTab==='partnerships' ? colors.primary : colors.textMuted} />
                        <Text style={[styles.tabText, {color: activeTab==='partnerships' ? colors.primary : colors.textMuted}]}>Partnerships</Text>
                    </TouchableOpacity>
                </View>

                {/* Tab content */}
                {activeTab === 'listings' ? (
                    <>
                        {loadingListings ? (
                            <ActivityIndicator color={colors.primary} style={{ marginTop: 48 }} />
                        ) : (
                            <FlatList
                                data={listings}
                                keyExtractor={(item) => item._id}
                                contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
                                showsVerticalScrollIndicator={false}
                                refreshing={refreshing}
                                onRefresh={() => fetchListings(true)}
                                ListEmptyComponent={
                                    <View style={{ alignItems: 'center', marginTop: 60 }}>
                                        <Tag size={40} color={colors.textMuted} />
                                        <Text style={{ color: colors.textMuted, marginTop: 12, fontSize: 15 }}>
                                            No listings yet
                                        </Text>
                                        <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 6 }}>
                                            Tap the + button to add your first offer
                                        </Text>
                                    </View>
                                }
                                renderItem={({ item }) => (
                                    <PartnerListingCard
                                        item={item}
                                        colors={colors}
                                        onEdit={handleOpenEdit}
                                        onDeactivate={handleDeactivate}
                                    />
                                )}
                            />
                        )}

                        {/* Floating add button */}
                        <View style={styles.fabContainer}>
                            <GlassIconButton
                                icon={<Plus size={24} color="#fff" />}
                                onPress={handleOpenCreate}
                                variant="active"
                                size="lg"
                                shimmer
                                style={styles.fab}
                                accessibilityLabel="Add new listing"
                            />
                        </View>
                    </>
                ) : activeTab === 'analytics' ? (
                    <AnalyticsTab colors={colors} />
                ) : null}

                {activeTab === 'partnerships' && (
                    <View style={{flex:1}}>
                        {/* Sub-tab bar */}
                        <View style={{flexDirection:'row',paddingHorizontal:16,paddingTop:10,paddingBottom:4,gap:8}}>
                            <GlassButton label="Browse CUs" onPress={()=>setPartnerSubTab('browse')} variant={partnerSubTab==='browse'?'primary':'ghost'} size="sm" style={{flex:1}} />
                            <GlassButton label="My Applications" onPress={()=>setPartnerSubTab('applications')} variant={partnerSubTab==='applications'?'primary':'ghost'} size="sm" style={{flex:1}} />
                        </View>

                        {partnerSubTab === 'browse' ? (
                            <View style={{flex:1}}>
                                <GlassInput
                                    placeholder="Search communities..."
                                    value={communitySearch} onChangeText={setCommunitySearch}
                                    icon={<Search size={16} color={colors.textMuted}/>}
                                    containerStyle={{marginHorizontal:16,marginVertical:8}}
                                    returnKeyType="search" autoCapitalize="none"
                                />
                                {communitiesLoading ? (
                                    <ActivityIndicator color={colors.primary} style={{marginTop:48}} />
                                ) : (
                                    <FlatList
                                        data={communities.filter(c=>communitySearch.trim()===''||c.name?.toLowerCase().includes(communitySearch.toLowerCase())||c.location?.toLowerCase().includes(communitySearch.toLowerCase()))}
                                        keyExtractor={item=>item.id}
                                        renderItem={({item})=>(
                                            <GlassSurface mode={mode} colors={colors} style={{marginHorizontal:16,marginBottom:12}}>
                                                <View style={{padding:16,gap:12}}>
                                                    <View style={{flexDirection:'row',gap:12}}>
                                                        <View style={{width:48,height:48,borderRadius:14,backgroundColor:nameToColor(item.name),alignItems:'center',justifyContent:'center',flexShrink:0}}>
                                                            <Text style={{color:'#FFF',fontSize:16,fontWeight:'700'}}>{getInitials(item.name)}</Text>
                                                        </View>
                                                        <View style={{flex:1,gap:4}}>
                                                            <View style={{flexDirection:'row',alignItems:'center',flexWrap:'wrap',gap:8}}>
                                                                <Text style={{color:colors.text,fontSize:15,fontWeight:'700',flexShrink:1}} numberOfLines={1}>{item.name}</Text>
                                                                <GlassBadge label={item.partnershipStatus??'Unknown'} variant={psBadgeVariant(item.partnershipStatus)} dot />
                                                            </View>
                                                            <View style={{flexDirection:'row',gap:12,flexWrap:'wrap'}}>
                                                                {item.memberCount!=null&&<View style={{flexDirection:'row',alignItems:'center',gap:4}}><Users size={12} color={colors.textMuted}/><Text style={{color:colors.textMuted,fontSize:12}}>{item.memberCount.toLocaleString()} members</Text></View>}
                                                                {item.location&&<View style={{flexDirection:'row',alignItems:'center',gap:4}}><MapPin size={12} color={colors.textMuted}/><Text style={{color:colors.textMuted,fontSize:12}}>{item.location}</Text></View>}
                                                            </View>
                                                            {item.description&&<Text style={{color:colors.textMuted,fontSize:13,lineHeight:18,marginTop:2}} numberOfLines={2}>{item.description}</Text>}
                                                        </View>
                                                    </View>
                                                    <GlassButton label="Apply to Partner" onPress={()=>{if(item.partnershipStatus==='Open'){setSelectedCommunity(item);setApplyModalVisible(true);}}} variant={item.partnershipStatus==='Open'?'primary':'ghost'} size="sm" disabled={item.partnershipStatus!=='Open'} fullWidth />
                                                </View>
                                            </GlassSurface>
                                        )}
                                        ListEmptyComponent={
                                            <View style={{alignItems:'center',marginTop:60,paddingHorizontal:32,gap:12}}>
                                                <Building2 size={40} color={colors.textMuted}/>
                                                <Text style={{color:colors.text,fontSize:17,fontWeight:'700',textAlign:'center'}}>No communities available</Text>
                                                <Text style={{color:colors.textMuted,fontSize:14,textAlign:'center',lineHeight:20}}>Check back later for partnership opportunities.</Text>
                                            </View>
                                        }
                                        contentContainerStyle={{paddingBottom:40}}
                                        showsVerticalScrollIndicator={false}
                                        keyboardShouldPersistTaps="handled"
                                    />
                                )}
                            </View>
                        ) : (
                            <View style={{flex:1}}>
                                {applicationsLoading ? (
                                    <ActivityIndicator color={colors.primary} style={{marginTop:48}} />
                                ) : (
                                    <FlatList
                                        data={applications}
                                        keyExtractor={item=>item.id}
                                        renderItem={({item})=>(
                                            <TouchableOpacity activeOpacity={0.85} onPress={()=>setExpandedAppId(p=>p===item.id?null:item.id)}>
                                                <GlassSurface mode={mode} colors={colors} style={{marginHorizontal:16,marginBottom:12}}>
                                                    <View style={{padding:16,gap:6}}>
                                                        <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8}}>
                                                            <Text style={{color:colors.text,fontSize:15,fontWeight:'700',flex:1}} numberOfLines={1}>{item.communityName??'Community'}</Text>
                                                            <GlassBadge label={item.status??'Pending'} variant={asBadgeVariant(item.status)} dot />
                                                        </View>
                                                        <Text style={{color:colors.textMuted,fontSize:12}}>Submitted {formatPartnerDate(item.submittedAt)}</Text>
                                                        {expandedAppId===item.id&&(
                                                            <View style={{marginTop:12,gap:12,borderTopWidth:StyleSheet.hairlineWidth,borderTopColor:'rgba(255,255,255,0.12)',paddingTop:12}}>
                                                                {item.proposal&&<View style={{gap:4}}><Text style={{color:colors.textSubtle,fontSize:11,fontWeight:'600',letterSpacing:0.5,textTransform:'uppercase'}}>Proposal</Text><Text style={{color:colors.textMuted,fontSize:13,lineHeight:18}}>{item.proposal}</Text></View>}
                                                                {item.feedback&&<View style={{gap:4}}><Text style={{color:colors.textSubtle,fontSize:11,fontWeight:'600',letterSpacing:0.5,textTransform:'uppercase'}}>Feedback from CU</Text><Text style={{color:colors.textMuted,fontSize:13,lineHeight:18}}>{item.feedback}</Text></View>}
                                                            </View>
                                                        )}
                                                    </View>
                                                </GlassSurface>
                                            </TouchableOpacity>
                                        )}
                                        ListEmptyComponent={
                                            <View style={{alignItems:'center',marginTop:60,paddingHorizontal:32,gap:12}}>
                                                <FileText size={40} color={colors.textMuted}/>
                                                <Text style={{color:colors.text,fontSize:17,fontWeight:'700',textAlign:'center'}}>No applications yet</Text>
                                                <Text style={{color:colors.textMuted,fontSize:14,textAlign:'center',lineHeight:20}}>Browse communities and apply to partner with them.</Text>
                                                <GlassButton label="Browse Communities" onPress={()=>setPartnerSubTab('browse')} variant="primary" size="sm" style={{marginTop:8}} />
                                            </View>
                                        }
                                        contentContainerStyle={{paddingBottom:40}}
                                        showsVerticalScrollIndicator={false}
                                    />
                                )}
                            </View>
                        )}

                        <ApplicationModal visible={applyModalVisible} community={selectedCommunity} onClose={()=>{setApplyModalVisible(false);setSelectedCommunity(null);}} colors={colors} mode={mode} />
                    </View>
                )}

                {/* Create / Edit Modal */}
                <ListingFormModal
                    visible={modalVisible}
                    onClose={() => setModalVisible(false)}
                    onSaved={() => fetchListings()}
                    editing={editingListing}
                    colors={colors}
                />
            </SafeAreaView>
        </GradientBackground>
    );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    header: {
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 14,
        borderBottomWidth: 1,
    },
    title: {
        fontSize: 22,
        fontWeight: '800',
    },

    // Tabs
    tabBar: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        paddingVertical: 10,
        gap: 10,
        borderBottomWidth: 1,
    },
    tabItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1,
    },
    tabText: {
        fontSize: 13,
        fontWeight: '600',
    },

    // FAB
    fabContainer: {
        position: 'absolute',
        bottom: 28,
        right: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.30,
        shadowRadius: 10,
        elevation: 8,
    },
    fab: {
        borderRadius: 24,
    },

    // Bottom sheet
    sheet: {
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 24,
        paddingBottom: Platform.OS === 'ios' ? 40 : 24,
        maxHeight: '90%',
    },
    sheetHandle: {
        width: 40,
        height: 4,
        borderRadius: 2,
        backgroundColor: 'rgba(255,255,255,0.25)',
        alignSelf: 'center',
        marginBottom: 20,
    },
    sheetHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    sheetTitle: {
        fontSize: 18,
        fontWeight: '700',
    },

    // Form fields
    fieldLabel: {
        fontSize: 13,
        fontWeight: '600',
        marginBottom: 6,
        marginTop: 14,
    },
    fieldSpacing: {
        marginTop: 14,
    },
    chipRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    chip: {
        paddingHorizontal: 14,
        paddingVertical: 7,
        borderRadius: 20,
        borderWidth: 1,
    },
    chipText: {
        fontSize: 13,
        fontWeight: '600',
    },
    toggleRow: {
        flexDirection: 'row',
        gap: 10,
    },
    toggleBtn: {
        flex: 1,
        paddingVertical: 10,
        borderRadius: 12,
        borderWidth: 1,
        alignItems: 'center',
    },
    toggleBtnText: {
        fontSize: 14,
        fontWeight: '600',
    },
    errorRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 12,
    },
    errorText: {
        fontSize: 13,
        flex: 1,
    },
    saveBtnWrap: {
        marginTop: 20,
    },
});
