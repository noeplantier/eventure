/**
 * app/(organizer)/create-event.tsx — EVENTURE v3
 *
 * Pure event creation — 3 steps (Infos · Détails · Publier)
 * INSERT into `events` table ONLY — no roles, no missions.
 *
 * Design : #0F172A bg · #6366F1 primary · Apple Liquid Glass (BlurView + LinearGradient)
 * Icons  : Ionicons from @expo/vector-icons (NO lucide, NO emojis)
 */
import React, { useState, useCallback } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
// react-native-maps is native-only — lazy require prevents web bundle crash
const RNMaps = Platform.OS !== 'web' ? require('react-native-maps') : null;
const MapView: any = RNMaps?.default ?? View;
const Marker: any  = RNMaps?.Marker  ?? (() => null);
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { Calendar } from 'react-native-calendars';
import * as Location from 'expo-location';
import { supabase } from '@/lib/supabase';
import { getWorkingOrganizerId } from '@/lib/mockUser';
import { useInteractiveBg } from '@/components/InteractiveBg';

/* ─── Palette — navy + white ONLY ───────────────────────────────────────── */
const BG   = '#020818';
const BLUE = '#FFFFFF';
const DIM  = 'rgba(255,255,255,0.06)';
const EDGE = 20;

const T = {
  white   : '#FFFFFF',
  offWhite: 'rgba(255,255,255,0.88)',
  muted   : 'rgba(255,255,255,0.50)',
  faint   : 'rgba(255,255,255,0.22)',
  surf    : 'rgba(255,255,255,0.05)',
  border  : 'rgba(255,255,255,0.08)',
  borderHi: 'rgba(255,255,255,0.35)',
  navy    : 'rgba(255,255,255,0.04)',
  red     : 'rgba(255,255,255,0.55)',
  redDim  : 'rgba(255,255,255,0.08)',
  redBdr  : 'rgba(255,255,255,0.20)',
} as const;

/* ─── Calendar theme — navy + white ─────────────────────────────────────── */
const CAL_THEME = {
  backgroundColor: 'transparent',
  calendarBackground: 'transparent',
  textSectionTitleColor: 'rgba(255,255,255,0.55)',
  selectedDayBackgroundColor: '#FFFFFF',
  selectedDayTextColor: '#020818',
  todayTextColor: '#FFFFFF',
  todayBackgroundColor: 'rgba(255,255,255,0.12)',
  dayTextColor: '#FFFFFF',
  textDisabledColor: 'rgba(255,255,255,0.20)',
  dotColor: '#FFFFFF',
  arrowColor: '#FFFFFF',
  monthTextColor: '#FFFFFF',
  textDayFontWeight: '500' as const,
  textMonthFontWeight: '700' as const,
  textDayHeaderFontWeight: '600' as const,
};

/* ─── Dark map style ─────────────────────────────────────────────────────── */
const DARK_MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#0a1628' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8ec3b9' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1a3646' }] },
  { featureType: 'administrative.country', elementType: 'geometry.stroke', stylers: [{ color: '#4b6878' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#304a7d' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#2c6675' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0e1626' }] },
  { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#647474' }] },
];

/* ─── Event types ────────────────────────────────────────────────────────── */
const EVENT_TYPES = [
  'Gala', 'Festival', 'Conférence', 'Mariage',
  'Soirée', 'Concert', 'Sport', 'Autre',
] as const;
type EventType = typeof EVENT_TYPES[number];

/* ─── Form state ─────────────────────────────────────────────────────────── */
interface EventForm {
  title      : string;
  type       : EventType | '';
  date_start : string;
  date_end   : string;
  location   : string;
  venue_name : string;
  latitude   : number | null;
  longitude  : number | null;
  budget     : string;
  description: string;
  cover_url  : string;
  status     : 'draft' | 'published';
}

const EMPTY_FORM: EventForm = {
  title      : '',
  type       : '',
  date_start : '',
  date_end   : '',
  location   : '',
  venue_name : '',
  latitude   : null,
  longitude  : null,
  budget     : '',
  description: '',
  cover_url  : '',
  status     : 'draft',
};

/* ─── Glass card ─────────────────────────────────────────────────────────── */
function GlassCard({ children, style }: { children: React.ReactNode; style?: any }) {
  return (
    <View style={[gc.outer, style]}>
      <BlurView intensity={60} tint="dark" style={StyleSheet.absoluteFill} />
      <LinearGradient
        colors={['rgba(255,255,255,0.07)', 'rgba(255,255,255,0.02)']}
        style={StyleSheet.absoluteFill}
      />
      {/* Top hairline */}
      <View pointerEvents="none" style={gc.topLine} />
      {/* Border */}
      <View pointerEvents="none" style={gc.border} />
      <View style={gc.content}>{children}</View>
    </View>
  );
}
const gc = StyleSheet.create({
  outer  : { borderRadius: 20, overflow: 'hidden', marginBottom: 14 },
  topLine: {
    position: 'absolute', top: 0, left: 0, right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  border : {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth, borderColor: T.border,
  },
  content: { padding: 20, gap: 16 },
});

/* ─── Section label ──────────────────────────────────────────────────────── */
function Label({ text }: { text: string }) {
  return (
    <Text style={{ color: T.white, fontSize: 11, fontWeight: '700', letterSpacing: 0.8 }}>
      {text}
    </Text>
  );
}

/* ─── Styled text input ──────────────────────────────────────────────────── */
function Field({
  label, value, onChangeText, placeholder, keyboardType,
  multiline, numberOfLines, hasError, errorMsg, hint,
}: {
  label       : string;
  value       : string;
  onChangeText: (v: string) => void;
  placeholder ?: string;
  keyboardType?: any;
  multiline   ?: boolean;
  numberOfLines?: number;
  hasError    ?: boolean;
  errorMsg    ?: string;
  hint        ?: string;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ gap: 6 }}>
      <Label text={label} />
      <View style={[
        fi.wrap,
        focused  && { borderColor: T.borderHi },
        hasError && { borderColor: T.redBdr },
      ]}>
        <TextInput
          style={[
            fi.input,
            multiline && {
              minHeight: (numberOfLines ?? 4) * 22,
              textAlignVertical: 'top',
              paddingTop: 14,
            },
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
          autoCorrect={false}
        />
      </View>
      {hasError && errorMsg ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <Ionicons name="alert-circle-outline" size={12} color={T.red} />
          <Text style={{ color: T.white, fontSize: 11 }}>{errorMsg}</Text>
        </View>
      ) : hint ? (
        <Text style={{ color: T.white, fontSize: 11 }}>{hint}</Text>
      ) : null}
    </View>
  );
}
const fi = StyleSheet.create({
  wrap : {
    borderRadius: 14, borderWidth: 1, borderColor: T.border,
    backgroundColor: 'rgba(255,255,255,0.04)', overflow: 'hidden',
  },
  input: {
    color: T.white, fontSize: 14, paddingHorizontal: 14,
    paddingVertical: 14, lineHeight: 20,
  },
});

/* ─── Type chip ──────────────────────────────────────────────────────────── */
function TypeChip({
  label, selected, onPress,
}: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={[
        tyc.chip,
        selected
          ? { backgroundColor: DIM, borderColor: BLUE }
          : { backgroundColor: 'rgba(255,255,255,0.04)', borderColor: T.border },
      ]}
    >
      <Text style={[tyc.label, { color: selected ? BLUE : T.muted }]}>{label}</Text>
    </TouchableOpacity>
  );
}
const tyc = StyleSheet.create({
  chip : {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 20, borderWidth: 1,
  },
  label: { fontSize: 13, fontWeight: '600' },
});

/* ─── Status chip ────────────────────────────────────────────────────────── */
function StatusChip({
  label, value, current, onPress, icon,
}: {
  label  : string;
  value  : 'draft' | 'published';
  current: 'draft' | 'published';
  onPress: () => void;
  icon   : string;
}) {
  const selected = current === value;
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={[
        stc.chip,
        selected
          ? { backgroundColor: DIM, borderColor: BLUE }
          : { backgroundColor: 'rgba(255,255,255,0.04)', borderColor: T.border },
      ]}
    >
      <Ionicons name={icon as any} size={16} color={selected ? BLUE : T.muted} />
      <Text style={{ color: selected ? BLUE : T.muted, fontSize: 14, fontWeight: '700' }}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}
const stc = StyleSheet.create({
  chip: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 14, borderRadius: 14, borderWidth: 1,
  },
});

/* ─── Progress dots ──────────────────────────────────────────────────────── */
function ProgressBar({ step, total }: { step: number; total: number }) {
  return (
    <View style={pb.row}>
      {Array.from({ length: total }, (_, i) => {
        const done    = i + 1 < step;
        const current = i + 1 === step;
        return (
          <React.Fragment key={i}>
            <View style={[
              pb.dot,
              (done || current)
                ? { backgroundColor: BLUE, borderColor: BLUE }
                : { backgroundColor: 'transparent', borderColor: T.faint },
            ]}>
              {done    && <Ionicons name="checkmark" size={9} color={BG} />}
              {current && <View style={pb.inner} />}
            </View>
            {i < total - 1 && (
              <View style={[pb.line, done ? { backgroundColor: BLUE } : { backgroundColor: T.faint }]} />
            )}
          </React.Fragment>
        );
      })}
    </View>
  );
}
const pb = StyleSheet.create({
  row  : { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 0 },
  dot  : {
    width: 22, height: 22, borderRadius: 11, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center',
  },
  inner: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: BG },
  line : { flex: 1, height: 1.5, maxWidth: 48 },
});

/* ─── Summary row ────────────────────────────────────────────────────────── */
function SummaryRow({ icon, value }: { icon: string; value: string }) {
  if (!value) return null;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
      <Ionicons name={icon as any} size={14} color={T.muted} style={{ marginTop: 1 }} />
      <Text style={{ color: T.white, fontSize: 13, flex: 1, lineHeight: 19 }}>{value}</Text>
    </View>
  );
}

/* ─── Step label map ─────────────────────────────────────────────────────── */
const STEP_LABELS = ['Infos', 'Détails', 'Publier'];

/* ══════════════════════════════════════════════════════════════════════════
   SCREEN
══════════════════════════════════════════════════════════════════════════ */
export default function CreateEventScreen() {
  const router  = useRouter();
  const insets  = useSafeAreaInsets();
  const { bgProps, BgLayer } = useInteractiveBg();

  const [step,   setStep]   = useState(1);
  const [form,   setForm]   = useState<EventForm>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof EventForm | 'submit', string>>>({});
  const [saving, setSaving] = useState(false);

  const [showCalStart, setShowCalStart] = useState(false);
  const [showCalEnd,   setShowCalEnd]   = useState(false);
  const [geoLoading,   setGeoLoading]   = useState(false);

  const [mapRegion,   setMapRegion]   = useState({
    latitude     : -8.71674,
    longitude    : 115.26249,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  });
  const [markerCoord, setMarkerCoord] = useState<{ latitude: number; longitude: number } | null>(null);

  /* helpers */
  const upd = useCallback(<K extends keyof EventForm>(key: K, val: EventForm[K]) => {
    setForm(f => ({ ...f, [key]: val }));
    setErrors(e => { const n = { ...e }; delete n[key]; return n; });
  }, []);

  /* ── Geolocation ── */
  const fillCurrentLocation = async () => {
    try {
      setGeoLoading(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { setGeoLoading(false); return; }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const [addr] = await Location.reverseGeocodeAsync(loc.coords);
      const label = [addr.street, addr.streetNumber, addr.city, addr.country].filter(Boolean).join(', ');
      upd('location', label || `${loc.coords.latitude.toFixed(4)}, ${loc.coords.longitude.toFixed(4)}`);
    } catch { /* silent */ }
    finally { setGeoLoading(false); }
  };

  /* ── Validation per step ── */
  const validate = useCallback((s: number): boolean => {
    const e: typeof errors = {};
    if (s === 1) {
      if (!form.title.trim() || form.title.length < 3) {
        e.title = 'Le titre est requis (min. 3 caractères)';
      }
      if (!form.date_start.trim()) {
        e.date_start = 'La date de début est requise';
      }
      if (!form.location.trim()) {
        e.location = 'Le lieu est requis';
      }
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }, [form]);

  const goNext = useCallback(() => {
    if (!validate(step)) return;
    setStep(s => Math.min(s + 1, 3));
  }, [step, validate]);

  const goPrev = useCallback(() => {
    setErrors({});
    setStep(s => Math.max(s - 1, 1));
  }, []);

  /* ── INSERT into events ONLY ── */
  const submit = useCallback(async () => {
    setSaving(true);
    setErrors({});
    try {
      const orgId = await getWorkingOrganizerId();
      if (!orgId) {
        setErrors({ submit: 'Session expirée. Veuillez vous reconnecter.' });
        setSaving(false);
        return;
      }

      const { error } = await supabase.from('events').insert({
        organizer_id: orgId,
        title       : form.title.trim(),
        type        : form.type        || null,
        date_start  : form.date_start.trim()  || null,
        date_end    : form.date_end.trim()     || null,
        location    : form.location.trim()     || null,
        venue_name  : form.venue_name || 'Put.in Coffee',
        latitude    : form.latitude   ?? null,
        longitude   : form.longitude  ?? null,
        budget      : form.budget ? Number(form.budget) : null,
        description : form.description.trim()  || null,
        cover_url   : form.cover_url.trim()    || null,
        status      : form.status,
      });

      if (error) throw new Error(error.message);

      router.replace('/(organizer)/events' as any);
    } catch (e: any) {
      setErrors({ submit: e?.message ?? 'Une erreur est survenue lors de la création.' });
      setSaving(false);
    }
  }, [form, router]);

  /* ════════════════════════════════════════════════════════════
     STEP RENDERS
  ════════════════════════════════════════════════════════════ */

  /* STEP 1 — Infos */
  const renderStep1 = () => (
    <View>
      <GlassCard>
        <Text style={ss.cardTitle}>Informations principales</Text>

        <Field
          label="TITRE *"
          value={form.title}
          onChangeText={v => upd('title', v)}
          placeholder="Ex : Gala de fin d'annee — TechCorp 2026"
          hasError={!!errors.title}
          errorMsg={errors.title}
        />

        <View>
          <Label text="TYPE D'EVENEMENT" />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
            {EVENT_TYPES.map(t => (
              <TypeChip
                key={t}
                label={t}
                selected={form.type === t}
                onPress={() => upd('type', form.type === t ? '' : t)}
              />
            ))}
          </View>
        </View>
      </GlassCard>

      <GlassCard>
        <Text style={ss.cardTitle}>Date et lieu</Text>

        <View style={{ flexDirection: 'row', gap: 10 }}>
          {/* Date de début */}
          <View style={{ flex: 1, marginBottom: 16 }}>
            <Text style={{ color: '#FFFFFF', fontSize: 10.5, fontWeight: '700', letterSpacing: 1.2, marginBottom: 8 }}>
              DATE DE DÉBUT *
            </Text>
            <TouchableOpacity
              onPress={() => setShowCalStart(true)}
              style={{
                flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 14,
                borderWidth: 1, borderColor: errors.date_start ? 'rgba(255,80,80,0.5)' : 'rgba(255,255,255,0.06)',
                paddingHorizontal: 14, paddingVertical: 14,
              }}
            >
              <Text style={{ color: form.date_start ? '#FFFFFF' : 'rgba(255,255,255,0.30)', fontSize: 15 }}>
                {form.date_start || 'Sélectionner'}
              </Text>
              <Ionicons name="calendar-outline" size={18} color="#FFFFFF" />
            </TouchableOpacity>
            {errors.date_start && (
              <Text style={{ color: 'rgba(255,80,80,0.8)', fontSize: 11, marginTop: 4 }}>{errors.date_start}</Text>
            )}
          </View>

          {/* Date de fin */}
          <View style={{ flex: 1, marginBottom: 16 }}>
            <Text style={{ color: '#FFFFFF', fontSize: 10.5, fontWeight: '700', letterSpacing: 1.2, marginBottom: 8 }}>
              DATE DE FIN
            </Text>
            <TouchableOpacity
              onPress={() => setShowCalEnd(true)}
              style={{
                flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 14,
                borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
                paddingHorizontal: 14, paddingVertical: 14,
              }}
            >
              <Text style={{ color: form.date_end ? '#FFFFFF' : 'rgba(255,255,255,0.30)', fontSize: 15 }}>
                {form.date_end || 'Sélectionner'}
              </Text>
              <Ionicons name="calendar-outline" size={18} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Part A — Nom du lieu */}
        <Field
          label="NOM DU LIEU *"
          value={form.location}
          onChangeText={v => upd('location', v)}
          placeholder="Put.in Coffee · Sanur, Bali"
          hasError={!!errors.location}
          errorMsg={errors.location}
          hint="Adresse complete ou nom de la salle"
        />
        <TouchableOpacity
          onPress={fillCurrentLocation}
          disabled={geoLoading}
          style={{
            flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4,
            alignSelf: 'flex-start',
            backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 20,
            paddingHorizontal: 14, paddingVertical: 7,
            borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
          }}
        >
          {geoLoading
            ? <ActivityIndicator size="small" color="#FFFFFF" />
            : <Ionicons name="navigate-outline" size={14} color="#FFFFFF" />
          }
          <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '600' }}>Ma position actuelle</Text>
        </TouchableOpacity>

        {/* Part B — Carte interactive */}
        <View style={{ marginTop: 16, marginBottom: 4 }}>
          <Text style={{ color: '#FFFFFF', fontSize: 10.5, fontWeight: '700', letterSpacing: 1.2, marginBottom: 6 }}>
            LOCALISATION SUR LA CARTE
          </Text>
          <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12, marginBottom: 10 }}>
            Appuyez sur la carte pour placer votre événement
          </Text>

          {/* Map container — Apple glass card */}
          <BlurView intensity={18} tint="systemUltraThinMaterialDark" style={{ borderRadius: 20, overflow: 'hidden', height: 220 }}>
            <View style={{ flex: 1, borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.14)' }}>
              {Platform.OS !== 'web' ? (
                <MapView
                  style={{ flex: 1 }}
                  region={mapRegion}
                  onRegionChangeComplete={setMapRegion}
                  onPress={(e: any) => {
                    const { latitude, longitude } = e.nativeEvent.coordinate;
                    setMarkerCoord({ latitude, longitude });
                    upd('latitude', latitude);
                    upd('longitude', longitude);
                  }}
                  mapType="standard"
                  showsUserLocation={false}
                  customMapStyle={DARK_MAP_STYLE}
                >
                  {markerCoord && (
                    <Marker
                      coordinate={markerCoord}
                      draggable
                      onDragEnd={(e: any) => {
                        const { latitude, longitude } = e.nativeEvent.coordinate;
                        setMarkerCoord({ latitude, longitude });
                        upd('latitude', latitude);
                        upd('longitude', longitude);
                      }}
                    >
                      <View style={{
                        alignItems: 'center',
                      }}>
                        <View style={{
                          width: 44, height: 44, borderRadius: 22,
                          backgroundColor: '#FFFFFF',
                          alignItems: 'center', justifyContent: 'center',
                          borderWidth: 3, borderColor: 'rgba(2,8,24,0.90)',
                          shadowColor: '#FFFFFF', shadowOpacity: 0.5, shadowRadius: 10,
                          shadowOffset: { width: 0, height: 0 },
                        }}>
                          <Ionicons name="location-sharp" size={22} color="#020818"/>
                        </View>
                        <View style={{
                          width: 0, height: 0,
                          borderLeftWidth: 8, borderRightWidth: 8, borderTopWidth: 12,
                          borderLeftColor: 'transparent', borderRightColor: 'transparent',
                          borderTopColor: '#FFFFFF',
                          alignSelf: 'center', marginTop: -2,
                        }}/>
                      </View>
                    </Marker>
                  )}
                </MapView>
              ) : (
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13 }}>
                    Carte disponible sur iOS / Android
                  </Text>
                </View>
              )}
            </View>
          </BlurView>

          {/* Coordinates display */}
          {markerCoord && (
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
              <View style={{
                flex: 1, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 10,
                padding: 10, alignItems: 'center',
                borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.10)',
              }}>
                <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 10, fontWeight: '600' }}>LAT</Text>
                <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '700' }}>
                  {markerCoord.latitude.toFixed(5)}
                </Text>
              </View>
              <View style={{
                flex: 1, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 10,
                padding: 10, alignItems: 'center',
                borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.10)',
              }}>
                <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 10, fontWeight: '600' }}>LNG</Text>
                <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '700' }}>
                  {markerCoord.longitude.toFixed(5)}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => {
                  setMarkerCoord(null);
                  upd('latitude', null);
                  upd('longitude', null);
                }}
                style={{
                  backgroundColor: 'rgba(239,68,68,0.15)', borderRadius: 10,
                  padding: 10, alignItems: 'center', justifyContent: 'center',
                  borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(239,68,68,0.30)',
                  width: 44,
                }}
              >
                <Ionicons name="trash-outline" size={18} color="#EF4444"/>
              </TouchableOpacity>
            </View>
          )}

          {/* Quick-set button for Put.in Coffee */}
          <TouchableOpacity
            onPress={() => {
              const coord = { latitude: -8.71674, longitude: 115.26249 };
              setMarkerCoord(coord);
              setMapRegion({ ...coord, latitudeDelta: 0.01, longitudeDelta: 0.01 });
              upd('latitude', coord.latitude);
              upd('longitude', coord.longitude);
              upd('location', 'Put.in Coffee · Sanur, Bali');
              upd('venue_name', 'Put.in Coffee');
            }}
            style={{
              flexDirection: 'row', gap: 8,
              backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12,
              padding: 12, alignItems: 'center',
              borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.12)',
              marginTop: 10,
            }}
          >
            <Ionicons name="cafe-outline" size={16} color="#FFFFFF"/>
            <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '600' }}>
              Placer sur Put.in Coffee · Sanur
            </Text>
          </TouchableOpacity>
        </View>
      </GlassCard>
    </View>
  );

  /* STEP 2 — Details */
  const renderStep2 = () => (
    <View>
      <GlassCard>
        <Text style={ss.cardTitle}>Budget</Text>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 10 }}>
          <View style={{
            width: 36, height: 36, borderRadius: 10, backgroundColor: DIM,
            alignItems: 'center', justifyContent: 'center', marginBottom: 2,
          }}>
            <Text style={{ color: BLUE, fontSize: 16, fontWeight: '800' }}>€</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Field
              label="BUDGET TOTAL"
              value={form.budget}
              onChangeText={v => upd('budget', v)}
              placeholder="12000"
              keyboardType="numeric"
            />
          </View>
        </View>
      </GlassCard>

      <GlassCard>
        <Text style={ss.cardTitle}>Description</Text>
        <Field
          label="DESCRIPTION PUBLIQUE"
          value={form.description}
          onChangeText={v => upd('description', v)}
          placeholder="Ambiance, dress code, attentes specifiques, informations pratiques..."
          multiline
          numberOfLines={4}
          hint="Visible par les candidats lors de leur postulation"
        />
      </GlassCard>

      <GlassCard>
        <Text style={ss.cardTitle}>Image de couverture</Text>
        <Field
          label="URL DE L'IMAGE (optionnel)"
          value={form.cover_url}
          onChangeText={v => upd('cover_url', v)}
          placeholder="https://exemple.com/image.jpg"
          keyboardType="url"
          hint="Lien vers une image 16:9 recommandee"
        />
      </GlassCard>
    </View>
  );

  /* STEP 3 — Publier */
  const renderStep3 = () => (
    <View>
      {/* Summary card */}
      <GlassCard>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{
            width: 46, height: 46, borderRadius: 13,
            backgroundColor: DIM, borderWidth: 1, borderColor: T.borderHi,
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Ionicons name="calendar-outline" size={22} color={BLUE} />
          </View>
          <View style={{ flex: 1 }}>
            <Text
              style={{ color: T.white, fontSize: 16, fontWeight: '900', letterSpacing: -0.3 }}
              numberOfLines={2}
            >
              {form.title || 'Sans titre'}
            </Text>
            {!!form.type && (
              <Text style={{ color: BLUE, fontSize: 11, fontWeight: '700', marginTop: 2 }}>
                {form.type}
              </Text>
            )}
          </View>
        </View>

        <View style={{
          gap: 10,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: T.border,
          paddingTop: 14,
        }}>
          <SummaryRow icon="location-outline" value={form.location || '—'} />
          <SummaryRow
            icon="time-outline"
            value={
              form.date_start
                ? `${form.date_start}${form.date_end ? ` → ${form.date_end}` : ''}`
                : '—'
            }
          />
          {!!form.budget && (
            <SummaryRow
              icon="cash-outline"
              value={`${Number(form.budget).toLocaleString('fr-FR')} € budget`}
            />
          )}
          {!!form.description && (
            <SummaryRow
              icon="document-text-outline"
              value={
                form.description.length > 80
                  ? form.description.slice(0, 80) + '…'
                  : form.description
              }
            />
          )}
        </View>
      </GlassCard>

      {/* Status picker */}
      <GlassCard>
        <Text style={ss.cardTitle}>Statut de publication</Text>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <StatusChip
            label="Brouillon"
            value="draft"
            current={form.status}
            icon="save-outline"
            onPress={() => upd('status', 'draft')}
          />
          <StatusChip
            label="Publier"
            value="published"
            current={form.status}
            icon="rocket-outline"
            onPress={() => upd('status', 'published')}
          />
        </View>
        <Text style={{ color: T.white, fontSize: 11, lineHeight: 16 }}>
          {form.status === 'draft'
            ? "L'evenement sera sauvegarde comme brouillon. Vous pourrez le publier plus tard."
            : "L'evenement sera immediatement visible et accessible aux staffs."}
        </Text>
      </GlassCard>

      {/* Error */}
      {!!errors.submit && (
        <View style={[ss.errCard, { marginBottom: 14 }]}>
          <Ionicons name="alert-circle-outline" size={16} color={T.red} />
          <Text style={{ color: T.white, fontSize: 13, flex: 1, lineHeight: 18 }}>
            {errors.submit}
          </Text>
        </View>
      )}

      {/* Create button */}
      <TouchableOpacity
        onPress={submit}
        disabled={saving}
        activeOpacity={0.85}
        style={{ borderRadius: 16, overflow: 'hidden', opacity: saving ? 0.65 : 1 }}
      >
        <LinearGradient colors={[BLUE, '#1270C8']} style={ss.ctaGrad}>
          {saving ? (
            <ActivityIndicator color={BG} size="small" />
          ) : (
            <>
              <Ionicons
                name={form.status === 'published' ? 'rocket-outline' : 'save-outline'}
                size={18}
                color={BG}
              />
              <Text style={ss.ctaText}>
                {form.status === 'published'
                  ? "Créer l'évènement"
                  : "Sauvegarder le brouillon"}
              </Text>
            </>
          )}
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );

  /* ════════════════════════════════════════════════════════════
     RENDER
  ════════════════════════════════════════════════════════════ */
  return (
    <View style={{ flex: 1, backgroundColor: BG }} {...bgProps}>
      <StatusBar style="light" />
      <BgLayer />

      {/* HEADER */}
      <View style={[ss.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          activeOpacity={0.75}
          style={ss.iconBtn}
        >
          <Ionicons name="arrow-back" size={20} color={T.muted} />
        </TouchableOpacity>

        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={{ color: T.white, fontSize: 11, fontWeight: '600', letterSpacing: 0.4 }}>
            ETAPE {step} SUR {STEP_LABELS.length}
          </Text>
          <Text style={{ color: T.white, fontSize: 16, fontWeight: '900', marginTop: 1 }}>
            {STEP_LABELS[step - 1]}
          </Text>
        </View>

        <TouchableOpacity
          onPress={() => router.back()}
          activeOpacity={0.75}
          style={ss.iconBtn}
        >
          <Ionicons name="close" size={20} color={T.muted} />
        </TouchableOpacity>
      </View>

      {/* PROGRESS */}
      <View style={{ paddingHorizontal: EDGE, paddingVertical: 16 }}>
        <ProgressBar step={step} total={STEP_LABELS.length} />
      </View>

      {/* CONTENT */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          style={{ flex: 1, backgroundColor: '#030B1E' }}
          contentContainerStyle={{
            paddingHorizontal: EDGE,
            paddingBottom: 160 + insets.bottom,
          }}
        >
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {step === 3 && renderStep3()}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* BOTTOM NAV (steps 1–2 only) */}
      {step < 3 && (
        <View style={[ss.bottomNav, { paddingBottom: insets.bottom + 16 }]}>
          {step > 1 ? (
            <TouchableOpacity
              onPress={goPrev}
              activeOpacity={0.78}
              style={ss.prevBtn}
            >
              <Ionicons name="arrow-back" size={16} color={T.muted} />
              <Text style={{ color: T.white, fontSize: 14, fontWeight: '600' }}>Retour</Text>
            </TouchableOpacity>
          ) : (
            <View style={{ flex: 1 }} />
          )}

          <TouchableOpacity
            onPress={goNext}
            activeOpacity={0.85}
            style={{ flex: 2, borderRadius: 14, overflow: 'hidden' }}
          >
            <LinearGradient
              colors={['rgba(255,255,255,0.18)', 'rgba(255,255,255,0.08)']}
              style={ss.nextGrad}
            >
              <Text style={{ color: BLUE, fontSize: 15, fontWeight: '900' }}>
                {step === 2 ? 'Récapitulatif' : 'Suivant'}
              </Text>
              <Ionicons name="arrow-forward" size={16} color={BLUE} />
            </LinearGradient>
          </TouchableOpacity>
        </View>
      )}

      {/* Calendar Modal — start date */}
      <Modal visible={showCalStart} transparent animationType="slide" onRequestClose={() => setShowCalStart(false)}>
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(5,14,27,0.85)' }}>
          <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={{
            backgroundColor: '#0A1628', borderTopLeftRadius: 28, borderTopRightRadius: 28,
            paddingTop: 20, paddingHorizontal: 16, paddingBottom: 40,
            borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
          }}>
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.2)', alignSelf: 'center', marginBottom: 16 }} />
            <Text style={{ color: '#FFFFFF', fontSize: 17, fontWeight: '700', textAlign: 'center', marginBottom: 16 }}>
              Date de début
            </Text>
            <Calendar
              theme={CAL_THEME}
              onDayPress={day => { upd('date_start', day.dateString + ' 20:00'); setShowCalStart(false); }}
              markedDates={form.date_start ? { [form.date_start.split(' ')[0]]: { selected: true, selectedColor: '#FFFFFF' } } : {}}
              minDate={new Date().toISOString().split('T')[0]}
            />
            <TouchableOpacity
              onPress={() => setShowCalStart(false)}
              style={{ marginTop: 12, alignItems: 'center', padding: 14, backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 14 }}
            >
              <Text style={{ color: '#FFFFFF', fontWeight: '600' }}>Annuler</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Calendar Modal — end date */}
      <Modal visible={showCalEnd} transparent animationType="slide" onRequestClose={() => setShowCalEnd(false)}>
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(5,14,27,0.85)' }}>
          <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={{
            backgroundColor: '#0A1628', borderTopLeftRadius: 28, borderTopRightRadius: 28,
            paddingTop: 20, paddingHorizontal: 16, paddingBottom: 40,
            borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
          }}>
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.2)', alignSelf: 'center', marginBottom: 16 }} />
            <Text style={{ color: '#FFFFFF', fontSize: 17, fontWeight: '700', textAlign: 'center', marginBottom: 16 }}>
              Date de fin
            </Text>
            <Calendar
              theme={CAL_THEME}
              onDayPress={day => { upd('date_end', day.dateString + ' 23:59'); setShowCalEnd(false); }}
              markedDates={form.date_end ? { [form.date_end.split(' ')[0]]: { selected: true, selectedColor: '#FFFFFF' } } : {}}
              minDate={form.date_start?.split(' ')[0] || new Date().toISOString().split('T')[0]}
            />
            <TouchableOpacity
              onPress={() => setShowCalEnd(false)}
              style={{ marginTop: 12, alignItems: 'center', padding: 14, backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 14 }}
            >
              <Text style={{ color: '#FFFFFF', fontWeight: '600' }}>Annuler</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

/* ─── Styles ─────────────────────────────────────────────────────────────── */
const ss = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: EDGE, paddingBottom: 4, gap: 12,
  },
  iconBtn: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: StyleSheet.hairlineWidth, borderColor: T.border,
    alignItems: 'center', justifyContent: 'center',
  },
  cardTitle: {
    color: T.white, fontSize: 15, fontWeight: '900', letterSpacing: -0.2,
  },
  errCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    padding: 14, borderRadius: 14,
    backgroundColor: T.redDim,
    borderWidth: 1, borderColor: T.redBdr,
  },
  ctaGrad: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, height: 58,
  },
  ctaText: {
    color: BG, fontSize: 16, fontWeight: '900', letterSpacing: -0.2,
  },
  bottomNav: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', gap: 12,
    paddingHorizontal: EDGE, paddingTop: 14,
    backgroundColor: BG,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.10)',
  },
  prevBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 7, height: 52, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: StyleSheet.hairlineWidth, borderColor: T.border,
  },
  nextGrad: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, height: 52,
  },
});
