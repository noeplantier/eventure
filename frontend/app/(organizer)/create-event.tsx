/**
 * app/(organizer)/create-event.tsx — EVENTURE v3 · Dark Green
 *
 * Palette  : #020A06 bg · #00D97E primary · #F5C842 gold
 * Icons    : lucide-react-native
 * Form     : 4 étapes (Infos · Rôles · Détails · Publier)
 * New feat : cover image (expo-image-picker → supabase storage)
 *
 * FLUX :
 *   Publier → [upload cover] → INSERT events → INSERT event_roles → INSERT missions
 */
import React, {
  memo, useCallback, useEffect, useRef, useState,
} from 'react';
import {
  ActivityIndicator, Animated, Dimensions, Easing,
  Image, KeyboardAvoidingView, Platform,
  ScrollView, StyleSheet, Text, TextInput,
  TouchableOpacity, View,
} from 'react-native';
import { LinearGradient }  from 'expo-linear-gradient';
import { SafeAreaView }    from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as ImagePicker    from 'expo-image-picker';
import { supabase }        from '@/lib/supabase';
import { getWorkingUid }   from '@/lib/mockUser';
import {
  ArrowLeft, X, Check, ArrowRight,
  Calendar, MapPin, Clock, Banknote, Users,
  Plus, Trash2, ChevronDown, ChevronUp,
  AlertCircle, Calculator, Image as ImageIcon,
  Save, Rocket, Camera,
} from 'lucide-react-native';
import { z } from 'zod';

/* ─── Palette — Dark Green ──────────────────────────────────────────────── */
const { width: SW, height: SH } = Dimensions.get('window');
const BG    = '#050E1B';
const BLUE = '#1A9FE3';
const GOLD  = '#F5C842';
const EDGE  = 20;

const T = {
  white   : '#FFFFFF',
  offWhite: 'rgba(255,255,255,0.88)',
  muted   : 'rgba(255,255,255,0.50)',
  faint   : 'rgba(255,255,255,0.18)',
  surf    : 'rgba(255,255,255,0.045)',
  surfHi  : 'rgba(255,255,255,0.09)',
  border  : 'rgba(26,159,227,0.12)',
  borderHi: 'rgba(26,159,227,0.30)',
  greenDim: 'rgba(26,159,227,0.12)',
  goldDim : 'rgba(245,200,66,0.12)',
  navy    : '#0C1A30',
  amber   : '#F59E0B',
  red     : '#EF4444',
  blue    : '#60A5FA',
  purple  : '#A78BFA',
} as const;

/* ─── Constants ─────────────────────────────────────────────────────────── */
const EVENT_TYPES = [
  'Gala', 'Festival', 'Conférence', 'Mariage', 'Séminaire',
  'Soirée', 'Concert', 'Sport', 'Lancement produit', 'Autre',
];
const ROLE_PRESETS = [
  'Serveur·se', 'Barman / Barmaid', 'Agent de sécurité',
  "Hôte·sse d'accueil", 'Coordinateur·rice', 'Runner',
  'Photographe', 'Vidéaste', 'Sommelier·ère', 'DJ', 'Animateur·rice',
  'Chef de rang', 'Maître d\'hôtel', 'Logisticien·ne',
];
const TYPE_COLOR: Record<string, string> = {
  'Gala': GOLD, 'Festival': BLUE, 'Conférence': T.blue,
  'Mariage': '#F472B6', 'Séminaire': T.purple, 'Soirée': T.amber,
  'Concert': T.red, 'Sport': '#34D399', 'Lancement produit': T.blue,
};

/* ─── Types ──────────────────────────────────────────────────────────────── */
interface RoleRow {
  id         : string;
  role       : string;
  slots      : string;
  hourly_rate: string;
}
interface FormData {
  title      : string;
  type       : string;
  date_start : string;
  date_end   : string;
  location   : string;
  budget     : string;
  description: string;
  roles      : RoleRow[];
}

/* ─── Zod schemas ────────────────────────────────────────────────────────── */
const step1Schema = z.object({
  title     : z.string().min(3, 'Minimum 3 caractères').max(120),
  date_start: z.string().min(1, 'Date de début requise').regex(/^\d{4}-\d{2}-\d{2}/, 'Format : YYYY-MM-DD HH:MM'),
  location  : z.string().min(3, 'Minimum 3 caractères').max(200),
});

/* ─── Helpers ────────────────────────────────────────────────────────────── */
const uid     = () => Math.random().toString(36).slice(2);
const newRole = (): RoleRow => ({ id: uid(), role: '', slots: '1', hourly_rate: '' });
const EMPTY: FormData = {
  title: '', type: '', date_start: '', date_end: '',
  location: '', budget: '', description: '', roles: [newRole()],
};

/* ─── Auth helper ──────────────────────────────────────────────────────── */
const getUid = getWorkingUid;

/* ─── Cover upload to Supabase Storage ──────────────────────────────────── */
const uploadCover = async (uri: string, eventId: string): Promise<string | null> => {
  try {
    const ext  = uri.split('.').pop()?.split('?')[0] || 'jpg';
    const path = `events/${eventId}/cover.${ext}`;
    const res  = await fetch(uri);
    const blob = await res.blob();
    const { error } = await supabase.storage
      .from('event-covers')
      .upload(path, blob, { upsert: true, contentType: `image/${ext}` });
    if (error) return null;
    const { data: { publicUrl } } = supabase.storage.from('event-covers').getPublicUrl(path);
    return publicUrl;
  } catch { return null; }
};

/* ─── Particle Background ───────────────────────────────────────────────── */
const PCOLS = ['#1A9FE3','rgba(26,159,227,0.4)','#F5C842','rgba(245,200,66,0.32)','rgba(255,255,255,0.16)'];
const PTS   = Array.from({length:18},(_,i)=>({
  id:i, x:((Math.sin(i*2.399)+1)/2)*SW, y:((Math.cos(i*1.618)+1)/2)*900,
  sz:0.8+(i%8)*0.2, col:PCOLS[i%PCOLS.length], op:0.04+(i%6)*0.03,
}));

const ParticleBg = memo(() => (
  <View style={StyleSheet.absoluteFill} pointerEvents="none">
    <LinearGradient colors={[BG,'#091628',BG]} style={StyleSheet.absoluteFill}/>
    <View style={{position:'absolute',top:'6%',left:'12%',width:SW*.7,height:SW*.7,borderRadius:SW*.35,backgroundColor:'rgba(26,159,227,0.025)'}}/>
    <View style={{position:'absolute',bottom:'8%',right:'-18%',width:SW*.6,height:SW*.6,borderRadius:SW*.3,backgroundColor:'rgba(56,189,248,0.02)'}}/>
    {PTS.map(p=><View key={p.id} style={{position:'absolute',left:p.x,top:p.y,width:p.sz,height:p.sz,borderRadius:p.sz/2,backgroundColor:p.col,opacity:p.op}}/>)}
  </View>
));

/* ─── Card ──────────────────────────────────────────────────────────────── */
const Card = memo(({ children, style, glow = BLUE }: {
  children: React.ReactNode; style?: any; glow?: string;
}) => (
  <View style={[{borderRadius:20,overflow:'hidden',padding:18,gap:14,backgroundColor:T.navy},style]}>
    <LinearGradient colors={[`${glow}0B`,`${glow}03`]} style={StyleSheet.absoluteFillObject}/>
    {children}
    <View pointerEvents="none" style={{position:'absolute',top:0,left:0,right:0,bottom:0,borderRadius:20,borderWidth:StyleSheet.hairlineWidth,borderColor:T.border}}/>
  </View>
));

/* ─── Field ─────────────────────────────────────────────────────────────── */
const Field = memo(({ label, error, hint, children }: {
  label: string; error?: string; hint?: string; children: React.ReactNode;
}) => (
  <View style={{ gap: 6 }}>
    <Text style={{ color: T.muted, fontSize: 11, fontWeight: '700', letterSpacing: 0.3 }}>{label}</Text>
    {children}
    {error && (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        <AlertCircle size={11} color={T.red} strokeWidth={2} />
        <Text style={{ color: T.red, fontSize: 11 }}>{error}</Text>
      </View>
    )}
    {hint && !error && (
      <Text style={{ color: T.muted, fontSize: 10, lineHeight: 14 }}>{hint}</Text>
    )}
  </View>
));

/* ─── Input ─────────────────────────────────────────────────────────────── */
const Input = memo(({ value, onChangeText, placeholder, keyboardType, multiline,
  numberOfLines, maxLength, hasError, prefix }: any) => {
  const [focused, setFocused] = useState(false);
  return (
    <View style={[
      inp.wrap,
      { backgroundColor: T.surf, borderColor: T.border },
      focused  && { borderColor: T.borderHi },
      hasError && { borderColor: `${T.red}60` },
    ]}>
      {prefix && <Text style={{ color: T.muted, fontSize: 14, paddingLeft: 14 }}>{prefix}</Text>}
      <TextInput
        style={[
          inp.input,
          { color: T.white },
          !prefix && { paddingHorizontal: 14 },
          multiline && { minHeight: (numberOfLines ?? 3) * 22, textAlignVertical: 'top', paddingTop: 14 },
        ]}
        value={value}
        onChangeText={onChangeText}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder}
        placeholderTextColor={T.faint}
        keyboardType={keyboardType ?? 'default'}
        multiline={multiline}
        numberOfLines={numberOfLines}
        maxLength={maxLength}
        autoCorrect={false}
      />
      {maxLength && value.length > maxLength * 0.8 && (
        <Text style={{ color: T.muted, fontSize: 9, paddingRight: 10, alignSelf: 'center' }}>
          {value.length}/{maxLength}
        </Text>
      )}
    </View>
  );
});
const inp = StyleSheet.create({
  wrap : { flexDirection: 'row', alignItems: 'center',
    borderRadius: 14, borderWidth: 1, overflow: 'hidden' },
  input: { flex: 1, fontSize: 14, paddingVertical: 14, lineHeight: 20 },
});

/* ─── StepBar ───────────────────────────────────────────────────────────── */
const STEP_LABELS = ['Infos', 'Rôles', 'Détails', 'Publier'];
const StepBar = memo(({ step, total }: { step: number; total: number }) => {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(anim, { toValue: step / total, tension: 80, friction: 14, useNativeDriver: false }).start();
  }, [step]);
  return (
    <View style={{ gap: 10, paddingHorizontal: EDGE }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ color: T.muted, fontSize: 11, fontWeight: '600' }}>Étape {step} / {total}</Text>
        <Text style={{ color: BLUE, fontSize: 11, fontWeight: '800' }}>{Math.round(step / total * 100)}%</Text>
      </View>
      {/* Progress line */}
      <View style={{ height: 3, borderRadius: 1.5, backgroundColor: T.border, overflow: 'hidden' }}>
        <Animated.View style={{
          position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 1.5,
          backgroundColor: BLUE,
          width: anim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
        }} />
      </View>
      {/* Step dots */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4 }}>
        {STEP_LABELS.map((l, i) => (
          <View key={l} style={{ alignItems: 'center', gap: 4 }}>
            <View style={[sb.dot,
              { borderColor: T.border, backgroundColor: T.surf },
              i + 1 < step  && { backgroundColor: BLUE, borderColor: BLUE },
              i + 1 === step && { backgroundColor: BLUE, borderColor: BLUE, transform: [{ scale: 1.3 }] },
            ]}>
              {i + 1 < step  && <Check size={9} color={BG} strokeWidth={3} />}
              {i + 1 === step && <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: BG }} />}
            </View>
            <Text style={{ color: i + 1 <= step ? BLUE : T.muted, fontSize: 8, fontWeight: '600' }}>{l}</Text>
          </View>
        ))}
      </View>
    </View>
  );
});
const sb = StyleSheet.create({
  dot: { width: 18, height: 18, borderRadius: 9, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center' },
});

/* ─── Budget counter live ───────────────────────────────────────────────── */
const BudgetCounter = memo(({ roles }: { roles: RoleRow[] }) => {
  const estimated = roles.reduce((s, r) => {
    const slots = Number(r.slots) || 0;
    const rate  = Number(r.hourly_rate) || 0;
    return s + slots * rate * 8;
  }, 0);
  if (!estimated) return null;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 14,
      backgroundColor: T.goldDim, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(245,200,66,0.28)' }}>
      <Calculator size={14} color={GOLD} strokeWidth={2} />
      <Text style={{ color: T.muted, fontSize: 12, flex: 1 }}>Estimation staff (8h/personne)</Text>
      <Text style={{ color: GOLD, fontSize: 14, fontWeight: '900' }}>
        {estimated.toLocaleString('fr-FR')}€
      </Text>
    </View>
  );
});

/* ─── Cover Image Picker ─────────────────────────────────────────────────── */
const CoverPicker = memo(({ uri, onPick }: { uri: string | null; onPick: () => void }) => (
  <TouchableOpacity onPress={onPick} activeOpacity={0.80}>
    <View style={[cp.wrap, { backgroundColor: T.surf, borderColor: T.border }]}>
      {uri ? (
        <>
          <Image source={{ uri }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
          <LinearGradient
            colors={['transparent', `${BG}B8`]}
            style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 60, borderRadius: 16 }}
          />
          <View style={cp.editBadge}>
            <Camera size={12} color={T.white} strokeWidth={2} />
            <Text style={{ color: T.white, fontSize: 11, fontWeight: '700' }}>Modifier</Text>
          </View>
        </>
      ) : (
        <View style={{ alignItems: 'center', gap: 10 }}>
          <View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: T.greenDim,
            alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: T.borderHi }}>
            <ImageIcon size={24} color={BLUE} strokeWidth={1.5} />
          </View>
          <Text style={{ color: BLUE, fontSize: 13, fontWeight: '700' }}>Ajouter une image de couverture</Text>
          <Text style={{ color: T.muted, fontSize: 11 }}>Format 16:9 recommandé</Text>
        </View>
      )}
    </View>
  </TouchableOpacity>
));
const cp = StyleSheet.create({
  wrap: { height: 160, borderRadius: 16, overflow: 'hidden',
    borderWidth: 1, alignItems: 'center', justifyContent: 'center',
    borderStyle: 'dashed' as const },
  editBadge: { position: 'absolute', bottom: 10, right: 10, flexDirection: 'row', alignItems: 'center',
    gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20,
    backgroundColor: `${BG}BF`, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
});

/* ─── Success overlay ───────────────────────────────────────────────────── */
const SuccessOverlay = memo(({ visible, title, sub }: {
  visible: boolean; title: string; sub: string;
}) => {
  const anim  = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.7)).current;
  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(anim,  { toValue: 1, duration: 280, useNativeDriver: true }),
        Animated.spring(scale, { toValue: 1, tension: 80, friction: 10, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);
  if (!visible) return null;
  return (
    <Animated.View style={{
      ...StyleSheet.absoluteFillObject, zIndex: 100,
      backgroundColor: `${BG}EB`,
      alignItems: 'center', justifyContent: 'center',
      opacity: anim,
    }}>
      <Animated.View style={{ alignItems: 'center', gap: 16, transform: [{ scale }] }}>
        <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: T.greenDim,
          borderWidth: 1.5, borderColor: T.borderHi, alignItems: 'center', justifyContent: 'center' }}>
          <Check size={40} color={BLUE} strokeWidth={2.5} />
        </View>
        <Text style={{ color: T.white, fontSize: 20, fontWeight: '900', letterSpacing: -0.4 }}>{title}</Text>
        <Text style={{ color: T.muted, fontSize: 13, textAlign: 'center' }}>{sub}</Text>
        <ActivityIndicator color={BLUE} style={{ marginTop: 8 }} />
      </Animated.View>
    </Animated.View>
  );
});

/* ─── Screen ─────────────────────────────────────────────────────────────── */
export default function CreateEventScreen() {
  const router = useRouter();
  useLocalSearchParams<{ inviteStaffId?: string; inviteStaffName?: string }>();

  const [step,         setStep]         = useState(1);
  const [form,         setForm]         = useState<FormData>(EMPTY);
  const [errors,       setErrors]       = useState<Record<string, string>>({});
  const [saving,       setSaving]       = useState(false);
  const [success,      setSuccess]      = useState(false);
  const [showTypes,    setShowTypes]    = useState(false);
  const [showRoleMenu, setShowRoleMenu] = useState<string | null>(null);
  const [coverUri,     setCoverUri]     = useState<string | null>(null);
  const draftRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* helpers */
  const upd     = useCallback((k: keyof FormData, v: any) => setForm(f => ({ ...f, [k]: v })), []);
  const updRole = useCallback((id: string, k: keyof RoleRow, v: string) =>
    setForm(f => ({ ...f, roles: f.roles.map(r => r.id === id ? { ...r, [k]: v } : r) })), []);
  const addRole = useCallback(() => setForm(f => ({ ...f, roles: [...f.roles, newRole()] })), []);
  const rmRole  = useCallback((id: string) =>
    setForm(f => ({ ...f, roles: f.roles.filter(r => r.id !== id) })), []);
  const clearErr = useCallback((...keys: string[]) =>
    setErrors(e => { const n = { ...e }; keys.forEach(k => delete n[k]); return n; }), []);

  /* ── Image picker ── */
  const pickCover = useCallback(async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.82,
    });
    if (!result.canceled && result.assets[0]) {
      setCoverUri(result.assets[0].uri);
    }
  }, []);

  /* ── Validation ── */
  const validateStep = useCallback((s: number, f: FormData): Record<string, string> => {
    const e: Record<string, string> = {};
    if (s === 1) {
      const r1 = step1Schema.safeParse({ title: f.title, date_start: f.date_start, location: f.location });
      if (!r1.success) {
        r1.error.issues.forEach(iss => { e[iss.path[0] as string] = iss.message; });
      }
    }
    if (s === 2) {
      f.roles.forEach((r, i) => {
        if (!r.role.trim())
          e[`role_${r.id}`]  = `Rôle ${i + 1} : intitulé requis`;
        if (!r.hourly_rate.trim() || isNaN(Number(r.hourly_rate)) || Number(r.hourly_rate) <= 0)
          e[`rate_${r.id}`]  = `Rôle ${i + 1} : tarif invalide`;
        if (!r.slots.trim() || isNaN(Number(r.slots)) || Number(r.slots) < 1)
          e[`slots_${r.id}`] = `Rôle ${i + 1} : postes invalide`;
      });
    }
    return e;
  }, []);

  const goNext = useCallback(() => {
    const e = validateStep(step, form);
    setErrors(e);
    if (Object.keys(e).length === 0) setStep(s => Math.min(s + 1, 4));
  }, [step, form, validateStep]);

  const goPrev = useCallback(() => setStep(s => Math.max(s - 1, 1)), []);

  /* ── Auto-save draft ── */
  useEffect(() => {
    if (step < 2 || !form.title.trim()) return;
    if (draftRef.current) clearTimeout(draftRef.current);
    draftRef.current = setTimeout(() => saveDraft(form, true), 30000);
    return () => { if (draftRef.current) clearTimeout(draftRef.current); };
  }, [form, step]);

  const saveDraft = useCallback(async (f: FormData, silent = false) => {
    if (!f.title.trim()) return;
    try {
      const orgId = await getUid();
      if (!orgId) return;
      await supabase.from('events').insert({
        organizer_id: orgId,
        title       : f.title.trim(),
        type        : f.type || null,
        date_start  : f.date_start || null,
        date_end    : f.date_end || null,
        location    : f.location.trim() || null,
        budget      : f.budget ? Number(f.budget) : null,
        description : f.description.trim() || null,
        status      : 'draft',
      });
    } catch (e) { if (!silent) console.error('[auto-draft]', e); }
  }, []);

  /* ── SUBMIT ── */
  const submit = useCallback(async (status: 'published' | 'draft') => {
    if (status === 'published') {
      const e1  = validateStep(1, form);
      const e2  = validateStep(2, form);
      const all = { ...e1, ...e2 };
      if (Object.keys(all).length > 0) {
        setErrors(all);
        if (Object.keys(e1).length > 0) setStep(1);
        else setStep(2);
        return;
      }
    }

    setSaving(true);
    setErrors({});

    try {
      const orgId = await getUid();
      if (!orgId) {
        setErrors({ submit: 'Session expirée — reconnectez-vous puis réessayez.' });
        setSaving(false);
        return;
      }

      /* ① INSERT event */
      const { data: evtData, error: evtErr } = await supabase
        .from('events')
        .insert({
          organizer_id: orgId,
          title       : form.title.trim(),
          type        : form.type || null,
          date_start  : form.date_start.trim() || null,
          date_end    : form.date_end.trim() || null,
          location    : form.location.trim() || null,
          budget      : form.budget ? Number(form.budget) : null,
          description : form.description.trim() || null,
          status,
        })
        .select('id')
        .single();

      if (evtErr) throw new Error(`Événement : ${evtErr.message}`);
      const eventId = (evtData as any).id as string;

      /* ② Upload cover image if selected */
      if (coverUri) {
        await uploadCover(coverUri, eventId);
      }

      /* ③ INSERT event_roles */
      const roleInserts = form.roles.map(r => ({
        event_id    : eventId,
        role        : r.role.trim(),
        slots       : Number(r.slots),
        slots_filled: 0,
        hourly_rate : Number(r.hourly_rate),
      }));
      const { error: roleErr } = await supabase.from('event_roles').insert(roleInserts);
      if (roleErr) throw new Error(`Rôles : ${roleErr.message}`);

      /* ④ INSERT missions (1 par slot) if published */
      if (status === 'published') {
        const missionInserts = form.roles.flatMap(r =>
          Array.from({ length: Number(r.slots) }, () => ({
            event_id      : eventId,
            staff_id      : null,
            application_id: null,
            payment_status: 'pending',
            amount_due    : null,
            role          : r.role.trim(),
            hourly_rate   : Number(r.hourly_rate),
          }))
        );
        if (missionInserts.length > 0) {
          const { error: mErr } = await supabase.from('missions').insert(missionInserts);
          if (mErr && mErr.message?.includes('column')) {
            const fallback = missionInserts.map(({ role: _r, hourly_rate: _h, ...rest }) => rest);
            const { error: mErr2 } = await supabase.from('missions').insert(fallback);
            if (mErr2) throw new Error(`Missions : ${mErr2.message}`);
          } else if (mErr) {
            throw new Error(`Missions : ${mErr.message}`);
          }
        }

        setSuccess(true);
        setTimeout(() => { router.replace('/(organizer)/missions' as any); }, 1600);
      } else {
        router.replace('/(organizer)/missions' as any);
      }

    } catch (e: any) {
      console.error('[create-event submit]', e);
      setErrors({ submit: e?.message ?? 'Erreur lors de la sauvegarde.' });
      setSaving(false);
    }
  }, [form, coverUri, validateStep, router]);

  /* ── Computed ── */
  const tc         = form.type ? (TYPE_COLOR[form.type] ?? BLUE) : BLUE;
  const totalSlots = form.roles.reduce((s, r) => s + Number(r.slots || 0), 0);
  const totalCost  = form.roles.reduce((s, r) => s + Number(r.slots || 0) * Number(r.hourly_rate || 0) * 8, 0);

  /* ══════════════════════════════════════════════════════════════════════
     STEPS RENDER
  ══════════════════════════════════════════════════════════════════════ */
  const renderStep = () => {
    switch (step) {

      /* ── STEP 1 : Infos ── */
      case 1: return (
        <View style={{ gap: 14 }}>

          {/* Cover image */}
          <Card>
            <Text style={ss.cardTitle}>Image de couverture</Text>
            <CoverPicker uri={coverUri} onPick={pickCover} />
          </Card>

          <Card>
            <Text style={ss.cardTitle}>Informations principales</Text>
            <Field label="TITRE DE LA MISSION *" error={errors.title}>
              <Input value={form.title} hasError={!!errors.title}
                onChangeText={(v: string) => { upd('title', v); clearErr('title'); }}
                placeholder="Ex : Gala de fin d'année · TechCorp 2025"
                maxLength={120} />
            </Field>

            {/* Type selector */}
            <Field label="TYPE D'ÉVÉNEMENT">
              <TouchableOpacity
                style={[inp.wrap, { height: 50, paddingHorizontal: 14,
                  justifyContent: 'space-between', flexDirection: 'row', alignItems: 'center',
                  backgroundColor: T.surf, borderColor: T.border }]}
                onPress={() => setShowTypes(v => !v)} activeOpacity={0.78}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                  {!!form.type && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: tc }} />}
                  <Text style={{ color: form.type ? T.white : T.faint, fontSize: 14 }}>
                    {form.type || 'Sélectionner un type…'}
                  </Text>
                </View>
                {showTypes
                  ? <ChevronUp size={14} color={T.muted} strokeWidth={2} />
                  : <ChevronDown size={14} color={T.muted} strokeWidth={2} />
                }
              </TouchableOpacity>
              {showTypes && (
                <View style={{ backgroundColor: T.navy, borderRadius: 14,
                  borderWidth: StyleSheet.hairlineWidth, borderColor: T.border,
                  overflow: 'hidden', marginTop: 4 }}>
                  {EVENT_TYPES.map((t, i) => (
                    <TouchableOpacity key={t}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 10,
                        paddingHorizontal: 16, paddingVertical: 13,
                        borderBottomWidth: i < EVENT_TYPES.length - 1 ? StyleSheet.hairlineWidth : 0,
                        borderBottomColor: T.border,
                        backgroundColor: form.type === t ? T.greenDim : 'transparent' }}
                      onPress={() => { upd('type', t); setShowTypes(false); }}>
                      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: TYPE_COLOR[t] ?? T.muted }} />
                      <Text style={{ color: form.type === t ? BLUE : T.muted, fontSize: 13,
                        fontWeight: form.type === t ? '800' : '400', flex: 1 }}>{t}</Text>
                      {form.type === t && <Check size={13} color={BLUE} strokeWidth={2.5} />}
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </Field>
          </Card>

          <Card>
            <Text style={ss.cardTitle}>Date & Lieu</Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Field label="DÉBUT *" error={errors.date_start}>
                  <Input value={form.date_start} hasError={!!errors.date_start}
                    onChangeText={(v: string) => { upd('date_start', v); clearErr('date_start'); }}
                    placeholder="2025-06-15 18:00" maxLength={16} />
                </Field>
              </View>
              <View style={{ flex: 1 }}>
                <Field label="FIN">
                  <Input value={form.date_end}
                    onChangeText={(v: string) => upd('date_end', v)}
                    placeholder="2025-06-15 23:00" maxLength={16} />
                </Field>
              </View>
            </View>
            <Field label="LIEU *" error={errors.location} hint="Adresse complète ou nom de la salle">
              <Input value={form.location} hasError={!!errors.location}
                onChangeText={(v: string) => { upd('location', v); clearErr('location'); }}
                placeholder="Hôtel Lutetia, Paris 6e" maxLength={200} />
            </Field>
          </Card>

          <Card glow={GOLD}>
            <Text style={ss.cardTitle}>Budget</Text>
            <Field label="BUDGET TOTAL (€)">
              <Input value={form.budget} onChangeText={(v: string) => upd('budget', v)}
                placeholder="12 000" keyboardType="numeric" maxLength={10} prefix="€" />
            </Field>
          </Card>
        </View>
      );

      /* ── STEP 2 : Rôles ── */
      case 2: return (
        <View style={{ gap: 14 }}>
          <Card>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View>
                <Text style={ss.cardTitle}>Rôles recherchés</Text>
                <Text style={{ color: T.muted, fontSize: 10, marginTop: 1 }}>
                  {totalSlots} poste{totalSlots > 1 ? 's' : ''} · ~{totalCost.toLocaleString('fr-FR')}€ estimés
                </Text>
              </View>
              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12,
                  paddingVertical: 8, borderRadius: 12, backgroundColor: T.greenDim,
                  borderWidth: 1, borderColor: T.borderHi }}
                onPress={addRole} activeOpacity={0.78}>
                <Plus size={14} color={BLUE} strokeWidth={2.5} />
                <Text style={{ color: BLUE, fontSize: 12, fontWeight: '800' }}>Ajouter</Text>
              </TouchableOpacity>
            </View>

            {form.roles.map((r, idx) => (
              <View key={r.id} style={{ gap: 11, padding: 14, borderRadius: 16, backgroundColor: T.surf,
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: errors[`role_${r.id}`] || errors[`rate_${r.id}`] || errors[`slots_${r.id}`]
                  ? 'rgba(239,68,68,0.30)' : T.border }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                    <View style={{ width: 20, height: 20, borderRadius: 6, backgroundColor: T.greenDim,
                      alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ color: BLUE, fontSize: 9, fontWeight: '900' }}>{idx + 1}</Text>
                    </View>
                    <Text style={{ color: BLUE, fontSize: 11, fontWeight: '700' }}>
                      {r.role || `Poste ${idx + 1}`}
                    </Text>
                  </View>
                  {form.roles.length > 1 && (
                    <TouchableOpacity onPress={() => rmRole(r.id)} hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}>
                      <Trash2 size={16} color={T.faint} strokeWidth={2} />
                    </TouchableOpacity>
                  )}
                </View>

                <Field label="RÔLE *" error={errors[`role_${r.id}`]}>
                  <TouchableOpacity
                    style={[inp.wrap, { height: 48, paddingHorizontal: 14, flexDirection: 'row',
                      alignItems: 'center', justifyContent: 'space-between',
                      backgroundColor: T.surf,
                      borderColor: errors[`role_${r.id}`] ? 'rgba(239,68,68,0.40)' : T.border }]}
                    onPress={() => setShowRoleMenu(showRoleMenu === r.id ? null : r.id)}
                    activeOpacity={0.78}>
                    <Text style={{ color: r.role ? T.white : T.faint, fontSize: 14, flex: 1 }}>
                      {r.role || 'Choisir un rôle…'}
                    </Text>
                    {showRoleMenu === r.id
                      ? <ChevronUp size={13} color={T.muted} strokeWidth={2} />
                      : <ChevronDown size={13} color={T.muted} strokeWidth={2} />
                    }
                  </TouchableOpacity>
                  {showRoleMenu === r.id && (
                    <View style={{ backgroundColor: T.navy, borderRadius: 12,
                      borderWidth: StyleSheet.hairlineWidth, borderColor: T.border,
                      overflow: 'hidden', marginTop: 4, maxHeight: 220 }}>
                      <ScrollView showsVerticalScrollIndicator={false} nestedScrollEnabled>
                        {ROLE_PRESETS.map((preset, pi) => (
                          <TouchableOpacity key={preset}
                            style={{ paddingHorizontal: 14, paddingVertical: 12,
                              borderBottomWidth: pi < ROLE_PRESETS.length - 1 ? StyleSheet.hairlineWidth : 0,
                              borderBottomColor: T.border,
                              backgroundColor: r.role === preset ? T.greenDim : 'transparent',
                              flexDirection: 'row', alignItems: 'center', gap: 8 }}
                            onPress={() => { updRole(r.id, 'role', preset); setShowRoleMenu(null); clearErr(`role_${r.id}`); }}>
                            {r.role === preset && (
                              <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: BLUE }} />
                            )}
                            <Text style={{ color: r.role === preset ? BLUE : T.muted, fontSize: 13,
                              fontWeight: r.role === preset ? '800' : '400' }}>
                              {preset}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  )}
                </Field>

                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Field label="POSTES *" error={errors[`slots_${r.id}`]}>
                      <Input value={r.slots} hasError={!!errors[`slots_${r.id}`]}
                        onChangeText={(v: string) => { updRole(r.id, 'slots', v); clearErr(`slots_${r.id}`); }}
                        placeholder="1" keyboardType="numeric" maxLength={3} />
                    </Field>
                  </View>
                  <View style={{ flex: 1.5 }}>
                    <Field label="TARIF HORAIRE *" error={errors[`rate_${r.id}`]}>
                      <Input value={r.hourly_rate} hasError={!!errors[`rate_${r.id}`]}
                        onChangeText={(v: string) => { updRole(r.id, 'hourly_rate', v); clearErr(`rate_${r.id}`); }}
                        placeholder="18.00" keyboardType="decimal-pad" maxLength={6} prefix="€" />
                    </Field>
                  </View>
                </View>

                {!!r.slots && !!r.hourly_rate && !isNaN(Number(r.slots)) && !isNaN(Number(r.hourly_rate)) && (
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between',
                    paddingTop: 2, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: T.border }}>
                    <Text style={{ color: T.muted, fontSize: 10 }}>
                      8h × {r.slots} poste{Number(r.slots) > 1 ? 's' : ''}
                    </Text>
                    <Text style={{ color: GOLD, fontSize: 11, fontWeight: '800' }}>
                      ~{(Number(r.slots) * Number(r.hourly_rate) * 8).toLocaleString('fr-FR')}€
                    </Text>
                  </View>
                )}
              </View>
            ))}
          </Card>

          {/* Récap */}
          {form.roles.some(r => r.role && r.slots) && (
            <Card>
              <Text style={ss.cardTitle}>Récapitulatif</Text>
              {form.roles.filter(r => r.role).map(r => (
                <View key={r.id} style={{ flexDirection: 'row', alignItems: 'center',
                  paddingVertical: 9, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: T.border }}>
                  <Text style={{ flex: 1, color: T.muted, fontSize: 12 }}>{r.role || '—'}</Text>
                  <Text style={{ color: T.white, fontSize: 12, fontWeight: '700', marginRight: 10 }}>
                    {r.slots} poste{Number(r.slots) > 1 ? 's' : ''}
                  </Text>
                  <Text style={{ color: GOLD, fontSize: 12, fontWeight: '800' }}>{r.hourly_rate}€/h</Text>
                </View>
              ))}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingTop: 4 }}>
                <Text style={{ color: T.muted, fontSize: 12, fontWeight: '600' }}>Total</Text>
                <Text style={{ color: BLUE, fontSize: 13, fontWeight: '900' }}>
                  {totalSlots} poste{totalSlots > 1 ? 's' : ''}
                </Text>
              </View>
              <BudgetCounter roles={form.roles} />
            </Card>
          )}
        </View>
      );

      /* ── STEP 3 : Description ── */
      case 3: return (
        <View style={{ gap: 14 }}>
          <Card>
            <Text style={ss.cardTitle}>Description de la mission</Text>
            <Field label="DESCRIPTION PUBLIQUE"
              hint="Visible par les talents lors de leur candidature">
              <Input value={form.description}
                onChangeText={(v: string) => upd('description', v)}
                placeholder="Ambiance, dress code, attentes spécifiques, informations pratiques…"
                multiline numberOfLines={8} maxLength={1000} />
            </Field>
          </Card>
        </View>
      );

      /* ── STEP 4 : Récap + Publier ── */
      case 4: return (
        <View style={{ gap: 14 }}>

          {/* Cover preview */}
          {coverUri && (
            <Card>
              <Text style={ss.cardTitle}>Couverture</Text>
              <View style={{ borderRadius: 14, overflow: 'hidden', height: 120 }}>
                <Image source={{ uri: coverUri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                <LinearGradient colors={['transparent', `${BG}CC`]}
                  style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 50 }} />
                <TouchableOpacity
                  onPress={pickCover}
                  style={{ position: 'absolute', top: 8, right: 8, flexDirection: 'row', alignItems: 'center',
                    gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 18,
                    backgroundColor: `${BG}BF`, borderWidth: 1,
                    borderColor: 'rgba(255,255,255,0.15)' }}>
                  <Camera size={11} color={T.white} strokeWidth={2} />
                  <Text style={{ color: T.white, fontSize: 11, fontWeight: '700' }}>Changer</Text>
                </TouchableOpacity>
              </View>
            </Card>
          )}

          {/* Event card */}
          <Card>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ width: 48, height: 48, borderRadius: 14,
                backgroundColor: `${tc}18`, borderWidth: 1, borderColor: `${tc}28`,
                alignItems: 'center', justifyContent: 'center' }}>
                <Calendar size={22} color={tc} strokeWidth={1.5} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: T.white, fontSize: 16, fontWeight: '900', letterSpacing: -0.3 }}>
                  {form.title || 'Sans titre'}
                </Text>
                {!!form.type && (
                  <Text style={{ color: tc, fontSize: 11, fontWeight: '700', marginTop: 2 }}>{form.type}</Text>
                )}
              </View>
            </View>
            <View style={{ gap: 9 }}>
              {[
                { Icon: MapPin,   v: form.location || '—' },
                { Icon: Clock,    v: form.date_start ? `${form.date_start}${form.date_end ? ` → ${form.date_end}` : ''}` : '—' },
                { Icon: Banknote, v: form.budget ? `${Number(form.budget).toLocaleString('fr-FR')}€ budget` : 'Pas de budget renseigné' },
              ].map(({ Icon, v }, idx) => (
                <View key={idx} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 9 }}>
                  <Icon size={13} color={T.muted} strokeWidth={2} style={{ marginTop: 1 }} />
                  <Text style={{ color: T.muted, fontSize: 12, flex: 1 }} numberOfLines={2}>{v}</Text>
                </View>
              ))}
            </View>
          </Card>

          {/* Roles card */}
          <Card>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={ss.cardTitle}>
                {form.roles.length} rôle{form.roles.length > 1 ? 's' : ''}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6,
                paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10,
                backgroundColor: T.greenDim, borderWidth: 1, borderColor: T.borderHi }}>
                <Users size={11} color={BLUE} strokeWidth={2} />
                <Text style={{ color: BLUE, fontSize: 11, fontWeight: '800' }}>
                  {totalSlots} poste{totalSlots > 1 ? 's' : ''}
                </Text>
              </View>
            </View>
            {form.roles.map(r => (
              <View key={r.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10,
                padding: 12, borderRadius: 13, backgroundColor: T.surf,
                borderWidth: StyleSheet.hairlineWidth, borderColor: T.border }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: T.white, fontSize: 13, fontWeight: '800' }}>{r.role || '—'}</Text>
                  <Text style={{ color: T.muted, fontSize: 11, marginTop: 2 }}>
                    {r.slots} poste{Number(r.slots) > 1 ? 's' : ''}
                    {r.hourly_rate ? `  ·  ~${(Number(r.slots) * Number(r.hourly_rate) * 8).toLocaleString('fr-FR')}€/8h` : ''}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 2 }}>
                  <Text style={{ color: GOLD, fontSize: 16, fontWeight: '900' }}>{r.hourly_rate}€</Text>
                  <Text style={{ color: T.muted, fontSize: 9 }}>/ heure</Text>
                </View>
              </View>
            ))}
            <BudgetCounter roles={form.roles} />
          </Card>

          {form.description ? (
            <Card>
              <Text style={ss.cardTitle}>Description</Text>
              <Text style={{ color: T.muted, fontSize: 13, lineHeight: 20 }}>{form.description}</Text>
            </Card>
          ) : null}

          {/* Error */}
          {errors.submit ? (
            <View style={{ padding: 14, borderRadius: 14, backgroundColor: 'rgba(239,68,68,0.08)',
              borderWidth: 1, borderColor: 'rgba(239,68,68,0.28)',
              flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
              <AlertCircle size={16} color={T.red} strokeWidth={2} style={{ marginTop: 1 }} />
              <Text style={{ color: T.red, fontSize: 12, flex: 1, lineHeight: 18 }}>{errors.submit}</Text>
            </View>
          ) : null}

          {/* CTAs */}
          <View style={{ gap: 10 }}>
            {/* Publier — CTA principal */}
            <TouchableOpacity
              style={{ borderRadius: 16, overflow: 'hidden', opacity: saving ? 0.7 : 1 }}
              onPress={() => submit('published')} disabled={saving} activeOpacity={0.88}>
              <LinearGradient colors={[BLUE, '#1270C8']}
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                  gap: 10, height: 58 }}>
                {saving
                  ? <ActivityIndicator color={BG} size="small" />
                  : <>
                      <Rocket size={19} color={BG} strokeWidth={2} />
                      <Text style={{ color: BG, fontWeight: '900', fontSize: 16, letterSpacing: -0.2 }}>
                        Publier la mission
                      </Text>
                      <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
                        backgroundColor: 'rgba(2,10,6,0.20)' }}>
                        <Text style={{ color: BG, fontSize: 10, fontWeight: '800' }}>
                          {totalSlots} poste{totalSlots > 1 ? 's' : ''}
                        </Text>
                      </View>
                    </>
                }
              </LinearGradient>
            </TouchableOpacity>

            {/* Brouillon */}
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9,
                height: 50, borderRadius: 14, backgroundColor: T.surf,
                borderWidth: StyleSheet.hairlineWidth, borderColor: T.border,
                opacity: saving ? 0.5 : 1 }}
              onPress={() => submit('draft')} disabled={saving} activeOpacity={0.78}>
              <Save size={15} color={T.muted} strokeWidth={2} />
              <Text style={{ color: T.muted, fontWeight: '600', fontSize: 14 }}>
                Sauvegarder en brouillon
              </Text>
            </TouchableOpacity>
          </View>

        </View>
      );
    }
    return null;
  };

  /* ══════════════════════════════════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════════════════════════════════ */
  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <ParticleBg />
      <SuccessOverlay
        visible={success}
        title="Mission publiée !"
        sub={`${totalSlots} poste${totalSlots > 1 ? 's' : ''} créés · Redirection en cours…`}
      />

      <SafeAreaView edges={['top']} style={{ flex: 1 }}>

        {/* ── HEADER ── */}
        <View style={[ss.nav, { borderBottomColor: T.border }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <TouchableOpacity onPress={() => router.back()}
              style={[ss.navBtn, { backgroundColor: T.surf, borderColor: T.border }]}
              activeOpacity={0.78}>
              <ArrowLeft size={18} color={T.muted} strokeWidth={2} />
            </TouchableOpacity>
            <View>
              <Text style={[ss.greet, { color: T.muted }]}>Création</Text>
              <Text style={[ss.title, { color: T.white }]}>Nouvelle mission</Text>
            </View>
          </View>
          <TouchableOpacity onPress={() => router.back()}
            style={[ss.navBtn, { backgroundColor: T.surf, borderColor: T.border }]}
            activeOpacity={0.78}>
            <X size={18} color={T.muted} strokeWidth={2} />
          </TouchableOpacity>
        </View>

        {/* ── STEP BAR ── */}
        <View style={{ marginBottom: 14 }}>
          <StepBar step={step} total={4} />
        </View>

        {/* ── CONTENT ── */}
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{
              paddingHorizontal: EDGE,
              paddingBottom: Platform.OS === 'ios' ? 160 : 140,
              gap: 0,
            }}
            keyboardShouldPersistTaps="handled"
          >
            {renderStep()}
          </ScrollView>
        </KeyboardAvoidingView>

        {/* ── BOTTOM NAV (steps 1–3) ── */}
        {step < 4 && (
          <View style={[ss.bottomNav, { backgroundColor: BG, borderTopColor: T.border }]}>
            {step > 1 ? (
              <TouchableOpacity
                style={[ss.prevBtn, { backgroundColor: T.surf, borderColor: T.border }]}
                onPress={goPrev} activeOpacity={0.78}>
                <ArrowLeft size={16} color={T.muted} strokeWidth={2} />
                <Text style={{ color: T.muted, fontWeight: '600', fontSize: 14 }}>Retour</Text>
              </TouchableOpacity>
            ) : <View style={{ flex: 1 }} />}
            <TouchableOpacity style={ss.nextBtn} onPress={goNext} activeOpacity={0.88}>
              <LinearGradient colors={['rgba(26,159,227,0.28)', 'rgba(26,159,227,0.12)']} style={ss.nextGrad}>
                <Text style={{ color: BLUE, fontWeight: '900', fontSize: 15 }}>
                  {step === 3 ? 'Récapitulatif' : 'Suivant'}
                </Text>
                <ArrowRight size={16} color={BLUE} strokeWidth={2.5} />
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}

      </SafeAreaView>
    </View>
  );
}

/* ─── Styles ─────────────────────────────────────────────────────────────── */
const ss = StyleSheet.create({
  nav      : { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: EDGE, paddingVertical: 12, paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth },
  greet    : { fontSize: 11, fontWeight: '600', letterSpacing: 0.2 },
  title    : { fontSize: 18, fontWeight: '900', letterSpacing: -0.3 },
  navBtn   : { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth },
  cardTitle: { fontSize: 14, fontWeight: '900', letterSpacing: -0.2, color: T.white },
  bottomNav: { position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', gap: 12, paddingHorizontal: EDGE,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20, paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth },
  prevBtn  : { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 7, height: 52, borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth },
  nextBtn  : { flex: 2, borderRadius: 14, overflow: 'hidden', marginBottom: 80 },
  nextGrad : { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 52 },
});
