/**
 * app/(organizer)/create-event.tsx — EVENTURE v4
 * Réaligné sur le design system Indigo Light (identique dashboard.tsx) —
 * remplace l'ancien thème sombre vert/or hérité d'avant la refonte v3.
 *
 * Formulaire 4 étapes :
 *   1. Image de couverture HD + Infos événement (titre, type, date, lieu, budget, jauge)
 *   2. Rôles & postes (ajout dynamique de lignes role/slots/tarif)
 *   3. Description & notes
 *   4. Récap + Publier
 *
 * On "Publier la mission" :
 *   → upload cover (Storage: event-images) si choisie
 *   → INSERT events (status='published')
 *   → INSERT event_roles (pour chaque rôle)
 *   → INSERT missions (une par poste, payment_status='pending')
 *   → navigate missions.tsx
 *
 * On "Sauvegarder brouillon" :
 *   → INSERT events (status='draft') + INSERT event_roles
 *   (pas de missions tant que non publié)
 */
import React, {
  memo, useCallback, useEffect, useRef, useState,
} from 'react';
import {
  ActivityIndicator, Animated, Image, KeyboardAvoidingView, Platform,
  ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { BlurView }       from 'expo-blur';
import { Ionicons }       from '@expo/vector-icons';
import { SafeAreaView }   from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as ImagePicker   from 'expo-image-picker';
import { supabase }       from '@/lib/supabase';
import { getCurrentOrganizerId } from '@/services/api';
import DateTimeField, { fmtDateTime } from '@/components/DateTimeField';
import { AURA }           from '@/constants/aura-theme';
import Aura               from '@/components/Aura';

/* ─── Design tokens (Aura — dark, futuristic, professionnel) ─────────────── */
const BG      = AURA.bg;
const PRIMARY = AURA.primary;
const P_LIGHT = AURA.primaryGhost;
const P_GHOST = AURA.primaryGhost;
const PURPLE  = AURA.secondary;
const SUCCESS = AURA.success;
const WARNING = AURA.warning;
const DANGER  = AURA.danger;
const BLUE    = AURA.cyan;
const EDGE    = 16;

const C = {
  text:      AURA.text,
  textSub:   AURA.textSub,
  textMuted: AURA.textMuted,
  border:    AURA.border,
  surface:   AURA.surface,
  surfaceAlt:AURA.surfaceAlt,
} as const;

/* ─── Constants ────────────────────────────────────────────────────────── */
const EVENT_TYPES = ['Gala','Festival','Conférence','Mariage','Séminaire','Soirée','Concert','Sport','Autre'];
const ROLE_PRESETS = [
  'Serveur·se','Barman / Barmaid','Agent de sécurité',
  "Hôte·sse d'accueil",'Coordinateur·rice','Runner',
  'Photographe','Vidéaste','Sommelier·ère','DJ','Animateur·rice',
];
const TYPE_COLOR: Record<string,string> = {
  'Gala':WARNING,'Festival':SUCCESS,'Conférence':BLUE,'Mariage':'#EC4899',
  'Séminaire':PURPLE,'Soirée':WARNING,'Concert':DANGER,'Sport':AURA.success,
};

/* ─── Types ────────────────────────────────────────────────────────────── */
interface RoleRow { id: string; role: string; slots: string; hourly_rate: string }
interface FormData {
  title       : string;
  type        : string;
  date_start  : string;
  date_end    : string;
  location    : string;
  budget      : string;
  guests_count: string;
  description : string;
  notes       : string;
  roles       : RoleRow[];
}

const newRole = (): RoleRow => ({
  id: Math.random().toString(36).slice(2),
  role: '', slots: '1', hourly_rate: '',
});

const EMPTY_FORM: FormData = {
  title:'', type:'', date_start:'', date_end:'',
  location:'', budget:'', guests_count:'',
  description:'', notes:'',
  roles:[newRole()],
};

/* ─── Card ─────────────────────────────────────────────────────────────── */
const Card = memo(({ children, style }: { children: React.ReactNode; style?: any }) => (
  <View style={[cs.card, style]}>{children}</View>
));
const cs = StyleSheet.create({
  card: {
    backgroundColor: C.surface, borderRadius: 18, padding: 18, gap: 13,
    borderWidth: 1, borderColor: C.border,
  },
});

/* ─── Field wrapper ────────────────────────────────────────────────────── */
const Field = memo(({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) => (
  <View style={{ gap: 6 }}>
    <Text style={{ color: C.textSub, fontSize: 12, fontWeight: '700' }}>{label}</Text>
    {children}
    {error && <Text style={{ color: DANGER, fontSize: 11 }}>{error}</Text>}
  </View>
));

/* ─── TextInput styled ─────────────────────────────────────────────────── */
const Input = memo(({ value, onChangeText, placeholder, keyboardType, multiline, numberOfLines, maxLength, style }: any) => (
  <View style={[inp.wrap, style]}>
    <TextInput
      style={[inp.input, multiline && { minHeight: (numberOfLines ?? 3) * 20, textAlignVertical: 'top' }]}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={C.textMuted}
      keyboardType={keyboardType ?? 'default'}
      multiline={multiline}
      numberOfLines={numberOfLines}
      maxLength={maxLength}
    />
  </View>
));
const inp = StyleSheet.create({
  wrap : { backgroundColor: C.surfaceAlt, borderRadius: 14, paddingHorizontal: 14, borderWidth: 1, borderColor: C.border },
  input: { color: C.text, fontSize: 14, paddingVertical: 14, lineHeight: 20 },
});


/* ─── Step indicator ───────────────────────────────────────────────────── */
const StepBar = memo(({ step, total }: { step: number; total: number }) => {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(anim, { toValue: step / total, tension: 80, friction: 14, useNativeDriver: false }).start();
  }, [step]);
  return (
    <View style={{ gap: 8, paddingHorizontal: EDGE }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ color: C.textSub, fontSize: 11, fontWeight: '600' }}>Étape {step} sur {total}</Text>
        <Text style={{ color: PRIMARY, fontSize: 11, fontWeight: '700' }}>{Math.round(step / total * 100)}%</Text>
      </View>
      <View style={{ height: 3, borderRadius: 1.5, backgroundColor: C.border, overflow: 'hidden' }}>
        <Animated.View style={{
          position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 1.5,
          backgroundColor: PRIMARY,
          width: anim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
        }}/>
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 2 }}>
        {Array.from({ length: total }, (_, i) => (
          <View key={i} style={{ alignItems: 'center', gap: 3 }}>
            <View style={[sp.dot,
              i + 1 < step && { backgroundColor: PRIMARY, borderColor: PRIMARY },
              i + 1 === step && { backgroundColor: PRIMARY, borderColor: PRIMARY, transform: [{ scale: 1.25 }] },
              i + 1 > step && { backgroundColor: 'transparent' },
            ]}>
              {i + 1 < step && <Ionicons name="checkmark" size={9} color="#fff"/>}
              {i + 1 === step && <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#fff' }}/>}
            </View>
            <Text style={{ color: i + 1 <= step ? PRIMARY : C.textMuted, fontSize: 8, fontWeight: '600', textAlign: 'center' }}>
              {['Infos', 'Rôles', 'Détails', 'Publier'][i]}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
});
const sp = StyleSheet.create({
  dot: {
    width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, borderColor: C.border,
    alignItems: 'center', justifyContent: 'center', backgroundColor: C.surface,
  },
});

/* ─── Screen ───────────────────────────────────────────────────────────── */
export default function CreateEventScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ inviteStaffId?: string; inviteStaffName?: string }>();

  const [step,      setStep]      = useState(1);
  const [form,      setForm]      = useState<FormData>(EMPTY_FORM);
  const [errors,    setErrors]    = useState<Record<string, string>>({});
  const [saving,    setSaving]    = useState(false);
  const [showTypes, setShowTypes] = useState(false);
  const [showRoleMenu, setShowRoleMenu] = useState<string | null>(null); // role row id
  const [coverImageUri, setCoverImageUri] = useState<string | null>(null);

  const upd = (k: keyof FormData, v: any) => setForm(f => ({ ...f, [k]: v }));
  const updRole = (id: string, k: keyof RoleRow, v: string) =>
    setForm(f => ({ ...f, roles: f.roles.map(r => r.id === id ? { ...r, [k]: v } : r) }));
  const addRole = () => setForm(f => ({ ...f, roles: [...f.roles, newRole()] }));
  const removeRole = (id: string) => setForm(f => ({ ...f, roles: f.roles.filter(r => r.id !== id) }));

  /* ── Cover image (HD) ── */
  const pickCoverImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1,
      allowsEditing: true,
      aspect: [16, 9],
    });
    if (!result.canceled && result.assets?.[0]?.uri) {
      setCoverImageUri(result.assets[0].uri);
    }
  };

  const uploadCoverImage = async (uri: string): Promise<string | null> => {
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      // L'URI peut être un data:/blob: URI sans extension exploitable (ex: data:image/png;base64,...) —
      // on dérive l'extension du MIME type réel plutôt que de parser la chaîne de l'URI.
      const mime = blob.type || 'image/jpeg';
      const ext = mime.split('/').pop()?.split('+')[0] || 'jpg';
      const path = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from('event-images').upload(path, blob, {
        contentType: mime,
        upsert: false,
      });
      if (error) throw error;
      const { data } = supabase.storage.from('event-images').getPublicUrl(path);
      return data.publicUrl;
    } catch (e) {
      console.error('[create-event] cover upload error', e);
      return null;
    }
  };

  /* ── Validation per step ── */
  const validate = (s: number): boolean => {
    const e: Record<string, string> = {};
    if (s === 1) {
      if (!form.title.trim())      e.title = 'Titre requis';
      if (!form.date_start.trim()) e.date_start = 'Date de début requise';
      if (!form.date_end.trim())   e.date_end = 'Date de fin requise';
      if (!form.location.trim())   e.location = 'Lieu requis';
    }
    if (s === 2) {
      form.roles.forEach((r, i) => {
        if (!r.role.trim())       e[`role_${r.id}`] = `Rôle ${i + 1} : intitulé requis`;
        if (!r.hourly_rate.trim() || isNaN(Number(r.hourly_rate)))
          e[`rate_${r.id}`] = `Rôle ${i + 1} : tarif invalide`;
        if (!r.slots.trim() || isNaN(Number(r.slots)) || Number(r.slots) < 1)
          e[`slots_${r.id}`] = `Rôle ${i + 1} : nombre de postes invalide`;
      });
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const goNext = () => { if (validate(step)) setStep(s => Math.min(s + 1, 4)); };
  const goPrev = () => setStep(s => Math.max(s - 1, 1));

  /* ── Submit ── */
  const submit = useCallback(async (status: 'published' | 'draft') => {
    if (status === 'published' && !validate(step)) return;
    setSaving(true);
    try {
      const organizerId = await getCurrentOrganizerId();
      if (!organizerId) throw new Error('Aucun profil organisateur lié à cet appareil');

      // 1) Upload cover image si choisie
      let coverUrl: string | null = null;
      if (coverImageUri) {
        coverUrl = await uploadCoverImage(coverImageUri);
      }

      // 2) Insert event
      const { data: evtData, error: evtErr } = await supabase.from('events').insert({
        organizer_id : organizerId,
        title        : form.title.trim(),
        type         : form.type || null,
        date_start   : form.date_start || null,
        date_end     : form.date_end || null,
        location     : form.location.trim() || null,
        budget       : form.budget ? Number(form.budget) : null,
        guests_count : form.guests_count ? Number(form.guests_count) : null,
        description  : form.description.trim() || null,
        notes        : form.notes.trim() || null,
        cover_url    : coverUrl,
        status,
      }).select('id').single();
      if (evtErr) throw evtErr;
      const eventId = (evtData as any).id;

      // 3) Insert event_roles
      const roleInserts = form.roles.map(r => ({
        event_id    : eventId,
        role        : r.role.trim(),
        slots       : Number(r.slots),
        slots_filled: 0,
        hourly_rate : Number(r.hourly_rate),
      }));
      const { error: roleErr } = await supabase.from('event_roles').insert(roleInserts);
      if (roleErr) throw roleErr;

      // 4) Si publication → créer les missions (1 par poste)
      if (status === 'published') {
        const missionInserts = form.roles.flatMap(r =>
          Array.from({ length: Number(r.slots) }, () => ({
            event_id      : eventId,
            staff_id      : null,      // à assigner lors de l'acceptation
            application_id: null,
            payment_status: 'pending' as const,
            amount_due    : null,      // calculé après check_in/out
          })),
        );
        if (missionInserts.length) {
          const { error: mErr } = await supabase.from('missions').insert(missionInserts);
          if (mErr) throw mErr;
        }
        router.replace('/(organizer)/missions' as any);
      } else {
        router.replace('/(organizer)/missions' as any);
      }
    } catch (e: any) {
      console.error('[create-event]', e);
      setErrors({ submit: e?.message ?? 'Erreur lors de la sauvegarde. Vérifiez votre connexion.' });
    } finally {
      setSaving(false);
    }
  }, [form, step, coverImageUri]);

  const tc = form.type ? TYPE_COLOR[form.type] ?? PRIMARY : PRIMARY;

  /* ── RENDER STEP CONTENT ── */
  const renderStep = () => {
    switch (step) {

      /* ───── STEP 1 : Cover + Infos événement ───── */
      case 1: return (
        <View style={{ gap: 14 }}>
          {/* Cover image HD */}
          <TouchableOpacity style={ce.coverUpload} onPress={pickCoverImage} activeOpacity={0.85}>
            {coverImageUri ? (
              <Image source={{ uri: coverImageUri }} style={ce.coverImg} resizeMode="cover"/>
            ) : (
              <View style={ce.coverPlaceholder}>
                <View style={ce.coverIconWrap}>
                  <Ionicons name="camera-outline" size={26} color={PRIMARY}/>
                </View>
                <Text style={ce.coverPlaceholderTitle}>Ajouter une image de couverture</Text>
                <Text style={ce.coverPlaceholderSub}>Format HD recommandé, 16:9</Text>
              </View>
            )}
            {coverImageUri && (
              <View style={ce.coverEditBadge}>
                <Ionicons name="pencil" size={13} color="#fff"/>
                <Text style={ce.coverEditTxt}>Changer</Text>
              </View>
            )}
          </TouchableOpacity>

          <Card>
            <Text style={ds.cardTitle}>Informations principales</Text>
            <Field label="Titre de la mission *" error={errors.title}>
              <Input value={form.title} onChangeText={(v: string) => upd('title', v)}
                placeholder="Ex : Gala de fin d'année TechCorp" maxLength={120}/>
            </Field>

            <Field label="Type d'événement">
              <TouchableOpacity
                style={[inp.wrap, { paddingVertical: 14, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}
                onPress={() => setShowTypes(v => !v)} activeOpacity={0.78}>
                <Text style={{ color: form.type ? C.text : C.textMuted, fontSize: 14 }}>
                  {form.type || 'Sélectionner…'}
                </Text>
                {form.type && (
                  <View style={{ width: 9, height: 9, borderRadius: 4.5, backgroundColor: tc, marginRight: 8 }}/>
                )}
                <Ionicons name={showTypes ? 'chevron-up' : 'chevron-down'} size={14} color={C.textSub}/>
              </TouchableOpacity>
              {showTypes && (
                <View style={{ backgroundColor: C.surface, borderRadius: 14, borderWidth: 1, borderColor: C.border, overflow: 'hidden' }}>
                  {EVENT_TYPES.map((t, i) => (
                    <TouchableOpacity key={t}
                      style={{
                        flexDirection: 'row', alignItems: 'center', gap: 10,
                        paddingHorizontal: 16, paddingVertical: 13,
                        borderBottomWidth: i < EVENT_TYPES.length - 1 ? 1 : 0,
                        borderBottomColor: C.border,
                        backgroundColor: form.type === t ? P_GHOST : 'transparent',
                      }}
                      onPress={() => { upd('type', t); setShowTypes(false); }}>
                      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: TYPE_COLOR[t] ?? C.textMuted }}/>
                      <Text style={{ color: form.type === t ? PRIMARY : C.textSub, fontSize: 13, fontWeight: form.type === t ? '800' : '500', flex: 1 }}>{t}</Text>
                      {form.type === t && <Ionicons name="checkmark" size={13} color={PRIMARY}/>}
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </Field>
          </Card>

          <Card>
            <Text style={ds.cardTitle}>Date & Lieu</Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Field label="Début *" error={errors.date_start}>
                  <DateTimeField value={form.date_start} onChange={(v: string) => upd('date_start', v)}
                    placeholder="Sélectionner…"/>
                </Field>
              </View>
              <View style={{ flex: 1 }}>
                <Field label="Fin *" error={errors.date_end}>
                  <DateTimeField value={form.date_end} onChange={(v: string) => upd('date_end', v)}
                    placeholder="Sélectionner…"/>
                </Field>
              </View>
            </View>
            <Field label="Lieu *" error={errors.location}>
              <Input value={form.location} onChangeText={(v: string) => upd('location', v)}
                placeholder="Adresse, salle, ville" maxLength={200}/>
            </Field>
          </Card>

          <Card>
            <Text style={ds.cardTitle}>Budget & Jauge</Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Field label="Budget total (€)">
                  <Input value={form.budget} onChangeText={(v: string) => upd('budget', v)}
                    placeholder="Ex : 12000" keyboardType="numeric" maxLength={10}/>
                </Field>
              </View>
              <View style={{ flex: 1 }}>
                <Field label="Nb. invités">
                  <Input value={form.guests_count} onChangeText={(v: string) => upd('guests_count', v)}
                    placeholder="Ex : 300" keyboardType="numeric" maxLength={6}/>
                </Field>
              </View>
            </View>
          </Card>
        </View>
      );

      /* ───── STEP 2 : Rôles & postes ───── */
      case 2: return (
        <View style={{ gap: 14 }}>
          <Card>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={ds.cardTitle}>Rôles recherchés</Text>
              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 11, paddingVertical: 6,
                  borderRadius: 10, backgroundColor: P_GHOST, borderWidth: 1, borderColor: AURA.primaryBorder }}
                onPress={addRole} activeOpacity={0.78}>
                <Ionicons name="add" size={14} color={PRIMARY}/>
                <Text style={{ color: PRIMARY, fontSize: 12, fontWeight: '700' }}>Ajouter</Text>
              </TouchableOpacity>
            </View>

            {form.roles.map((r, idx) => (
              <View key={r.id} style={{
                gap: 10, padding: 14, borderRadius: 16,
                backgroundColor: C.surfaceAlt, borderWidth: 1, borderColor: C.border,
              }}>
                {/* Role header */}
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={{ color: PRIMARY, fontSize: 11, fontWeight: '700' }}>Poste {idx + 1}</Text>
                  {form.roles.length > 1 && (
                    <TouchableOpacity onPress={() => removeRole(r.id)} hitSlop={10}>
                      <Ionicons name="close-circle" size={18} color={C.textMuted}/>
                    </TouchableOpacity>
                  )}
                </View>

                {/* Role selector */}
                <Field label="Rôle" error={errors[`role_${r.id}`]}>
                  <TouchableOpacity
                    style={[inp.wrap, { paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}
                    onPress={() => setShowRoleMenu(showRoleMenu === r.id ? null : r.id)} activeOpacity={0.78}>
                    <Text style={{ color: r.role ? C.text : C.textMuted, fontSize: 14, flex: 1 }}>
                      {r.role || 'Sélectionner un rôle…'}
                    </Text>
                    <Ionicons name={showRoleMenu === r.id ? 'chevron-up' : 'chevron-down'} size={13} color={C.textSub}/>
                  </TouchableOpacity>
                  {showRoleMenu === r.id && (
                    <View style={{ backgroundColor: C.surface, borderRadius: 12, borderWidth: 1, borderColor: C.border, overflow: 'hidden', marginTop: 4 }}>
                      {ROLE_PRESETS.map((preset, i) => (
                        <TouchableOpacity key={preset}
                          style={{
                            paddingHorizontal: 14, paddingVertical: 11,
                            borderBottomWidth: i < ROLE_PRESETS.length - 1 ? 1 : 0,
                            borderBottomColor: C.border,
                            backgroundColor: r.role === preset ? P_GHOST : 'transparent',
                          }}
                          onPress={() => { updRole(r.id, 'role', preset); setShowRoleMenu(null); }}>
                          <Text style={{ color: r.role === preset ? PRIMARY : C.textSub, fontSize: 13, fontWeight: r.role === preset ? '800' : '400' }}>
                            {preset}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </Field>

                {/* Slots + Tarif */}
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Field label="Nb. postes" error={errors[`slots_${r.id}`]}>
                      <Input value={r.slots} onChangeText={(v: string) => updRole(r.id, 'slots', v)}
                        placeholder="1" keyboardType="numeric" maxLength={3}/>
                    </Field>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Field label="Tarif horaire (€)" error={errors[`rate_${r.id}`]}>
                      <Input value={r.hourly_rate} onChangeText={(v: string) => updRole(r.id, 'hourly_rate', v)}
                        placeholder="15.00" keyboardType="decimal-pad" maxLength={6}/>
                    </Field>
                  </View>
                </View>

                {/* Budget estimé pour ce rôle */}
                {r.slots && r.hourly_rate && !isNaN(Number(r.slots)) && !isNaN(Number(r.hourly_rate)) && (
                  <Text style={{ color: C.textSub, fontSize: 10 }}>
                    Estimation 8h : <Text style={{ color: WARNING, fontWeight: '700' }}>
                      {(Number(r.slots) * Number(r.hourly_rate) * 8).toLocaleString('fr-FR')}€
                    </Text>
                  </Text>
                )}
              </View>
            ))}
          </Card>

          {/* Récap postes */}
          {form.roles.some(r => r.role && r.slots) && (
            <Card>
              <Text style={ds.cardTitle}>Récapitulatif des postes</Text>
              <View style={{ gap: 8 }}>
                {form.roles.filter(r => r.role && r.slots).map(r => (
                  <View key={r.id} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ color: C.textSub, fontSize: 12 }}>{r.role}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <Text style={{ color: C.text, fontSize: 12, fontWeight: '700' }}>{r.slots} poste{Number(r.slots) > 1 ? 's' : ''}</Text>
                      {r.hourly_rate && <Text style={{ color: WARNING, fontSize: 12, fontWeight: '700' }}>{r.hourly_rate}€/h</Text>}
                    </View>
                  </View>
                ))}
                <View style={{ height: 1, backgroundColor: C.border, marginVertical: 4 }}/>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ color: C.textSub, fontSize: 12, fontWeight: '600' }}>Total postes</Text>
                  <Text style={{ color: PRIMARY, fontSize: 12, fontWeight: '800' }}>
                    {form.roles.reduce((s, r) => s + Number(r.slots || 0), 0)} poste{form.roles.reduce((s, r) => s + Number(r.slots || 0), 0) > 1 ? 's' : ''}
                  </Text>
                </View>
              </View>
            </Card>
          )}
        </View>
      );

      /* ───── STEP 3 : Description ───── */
      case 3: return (
        <View style={{ gap: 14 }}>
          <Card>
            <Text style={ds.cardTitle}>Description de la mission</Text>
            <Field label="Description publique">
              <Input value={form.description} onChangeText={(v: string) => upd('description', v)}
                placeholder="Décrivez l'ambiance, les attentes, le dress code…"
                multiline numberOfLines={5} maxLength={1000}/>
              <Text style={{ color: C.textMuted, fontSize: 10, alignSelf: 'flex-end', marginTop: 4 }}>
                {form.description.length}/1000
              </Text>
            </Field>
            <Field label="Notes internes (non visibles par le staff)">
              <Input value={form.notes} onChangeText={(v: string) => upd('notes', v)}
                placeholder="Notes privées, budget interne, contacts…"
                multiline numberOfLines={3} maxLength={500}/>
            </Field>
          </Card>
        </View>
      );

      /* ───── STEP 4 : Récap + Publier ───── */
      case 4: return (
        <View style={{ gap: 14 }}>
          {/* Recap event */}
          <Card>
            {coverImageUri && (
              <Image source={{ uri: coverImageUri }} style={ce.recapCover} resizeMode="cover"/>
            )}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{
                width: 46, height: 46, borderRadius: 14,
                backgroundColor: `${tc}18`, borderWidth: 1, borderColor: `${tc}30`,
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Ionicons name="calendar-outline" size={20} color={tc}/>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.text, fontSize: 16, fontWeight: '900', letterSpacing: -0.3 }}>
                  {form.title || 'Sans titre'}
                </Text>
                {form.type && <Text style={{ color: tc, fontSize: 11, fontWeight: '600', marginTop: 2 }}>{form.type}</Text>}
              </View>
            </View>
            <View style={{ gap: 8 }}>
              {[
                { icon: 'location-outline' as const, l: form.location || '—' },
                { icon: 'calendar-outline' as const, l: form.date_start ? `${fmtDateTime(form.date_start)} → ${fmtDateTime(form.date_end)}` : '—' },
                { icon: 'cash-outline' as const, l: form.budget ? `${Number(form.budget).toLocaleString('fr-FR')}€ budget` : 'Pas de budget' },
                { icon: 'people-outline' as const, l: form.guests_count ? `${form.guests_count} invités` : '—' },
              ].map(({ icon, l }) => (
                <View key={icon} style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
                  <Ionicons name={icon} size={13} color={C.textSub}/>
                  <Text style={{ color: C.textSub, fontSize: 12 }} numberOfLines={1}>{l}</Text>
                </View>
              ))}
            </View>
          </Card>

          {/* Recap rôles */}
          <Card>
            <Text style={ds.cardTitle}>
              {form.roles.length} rôle{form.roles.length > 1 ? 's' : ''} ·{' '}
              {form.roles.reduce((s, r) => s + Number(r.slots || 0), 0)} poste{form.roles.reduce((s, r) => s + Number(r.slots || 0), 0) > 1 ? 's' : ''}
            </Text>
            {form.roles.map(r => (
              <View key={r.id} style={{
                flexDirection: 'row', alignItems: 'center', gap: 10,
                padding: 12, borderRadius: 13, backgroundColor: C.surfaceAlt,
                borderWidth: 1, borderColor: C.border,
              }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: C.text, fontSize: 13, fontWeight: '700' }}>{r.role || '—'}</Text>
                  <Text style={{ color: C.textSub, fontSize: 11, marginTop: 1 }}>
                    {r.slots} poste{Number(r.slots) > 1 ? 's' : ''}
                  </Text>
                </View>
                <Text style={{ color: WARNING, fontSize: 14, fontWeight: '900' }}>{r.hourly_rate}€/h</Text>
              </View>
            ))}
          </Card>

          {/* Description preview */}
          {form.description && (
            <Card>
              <Text style={ds.cardTitle}>Description</Text>
              <Text style={{ color: C.textSub, fontSize: 13, lineHeight: 20 }}>{form.description}</Text>
            </Card>
          )}

          {errors.submit && (
            <View style={{
              padding: 12, borderRadius: 12, backgroundColor: AURA.dangerGhost,
              borderWidth: 1, borderColor: 'rgba(248,113,113,0.30)',
            }}>
              <Text style={{ color: DANGER, fontSize: 12 }}>{errors.submit}</Text>
            </View>
          )}

          {/* CTA buttons */}
          <View style={{ gap: 10, marginBottom: 80 }}>
            {/* Publier — CTA principal */}
            <Aura color={AURA.primaryGlow} radius={16} onPress={() => submit('published')} disabled={saving} style={{ opacity: saving ? 0.7 : 1 }}>
              <View style={ce.publishBtn}>
                {saving
                  ? <ActivityIndicator color="#fff" size="small"/>
                  : <><Ionicons name="rocket-outline" size={18} color="#fff"/>
                     <Text style={{ color: '#fff', fontWeight: '900', fontSize: 16 }}>Publier la mission</Text></>
                }
              </View>
            </Aura>

            {/* Brouillon */}
            <TouchableOpacity
              style={[ce.draftBtn, { opacity: saving ? 0.6 : 1 }]}
              onPress={() => submit('draft')} disabled={saving} activeOpacity={0.78}>
              <Ionicons name="save-outline" size={15} color={C.textSub}/>
              <Text style={{ color: C.textSub, fontWeight: '600', fontSize: 14 }}>Sauvegarder en brouillon</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }
    return null;
  };

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>

        {/* ── NAV (glass) ── */}
        <BlurView intensity={Platform.OS === 'ios' ? 50 : 25} tint="dark" style={ds.navBlur}>
          <View style={ds.nav}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <TouchableOpacity onPress={() => router.back()} style={ds.navBtn} activeOpacity={0.78}>
                <Ionicons name="arrow-back" size={18} color={C.textSub}/>
              </TouchableOpacity>
              <View style={{ gap: 1 }}>
                <Text style={ds.greet}>Création</Text>
                <Text style={ds.title}>Nouvelle mission</Text>
              </View>
            </View>
            <TouchableOpacity onPress={() => router.back()} style={ds.navBtn} activeOpacity={0.78}>
              <Ionicons name="close" size={18} color={C.textSub}/>
            </TouchableOpacity>
          </View>
        </BlurView>

        {/* Step bar */}
        <View style={{ marginBottom: 16, marginTop: 4 }}>
          <StepBar step={step} total={4}/>
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: EDGE, paddingBottom: 140, gap: 0 }}
            keyboardShouldPersistTaps="handled">
            {renderStep()}
          </ScrollView>
        </KeyboardAvoidingView>

        {/* ── BOTTOM NAV BUTTONS (glass) ── */}
        {step < 4 && (
          <BlurView intensity={Platform.OS === 'ios' ? 60 : 30} tint="dark" style={ce.bottomNavBlur}>
            <View style={ce.bottomNav}>
              {step > 1 ? (
                <TouchableOpacity style={ce.prevBtn} onPress={goPrev} activeOpacity={0.78}>
                  <Ionicons name="arrow-back" size={16} color={C.textSub}/>
                  <Text style={{ color: C.textSub, fontWeight: '600', fontSize: 14 }}>Retour</Text>
                </TouchableOpacity>
              ) : <View style={{ flex: 1 }}/>}
              <Aura color={AURA.primaryGlow} radius={14} onPress={goNext} style={{ flex: 2 }}>
                <View style={ce.nextGrad}>
                  <Text style={{ color: '#fff', fontWeight: '900', fontSize: 15 }}>
                    {step === 3 ? 'Récapitulatif' : 'Suivant'}
                  </Text>
                  <Ionicons name="arrow-forward" size={16} color="#fff"/>
                </View>
              </Aura>
            </View>
          </BlurView>
        )}

      </SafeAreaView>
    </View>
  );
}

/* ─── Styles ───────────────────────────────────────────────────────────── */
const ds = StyleSheet.create({
  navBlur  : { borderBottomWidth: 1, borderBottomColor: C.border, backgroundColor: 'rgba(10,12,16,0.80)' },
  nav      : { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: EDGE, paddingVertical: 12, paddingBottom: 8 },
  greet    : { color: C.textSub, fontSize: 11, fontWeight: '600' },
  title    : { color: C.text, fontSize: 18, fontWeight: '900', letterSpacing: -0.3 },
  navBtn   : { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: C.surfaceAlt, borderWidth: 1, borderColor: C.border },
  cardTitle: { color: C.text, fontSize: 14, fontWeight: '900', letterSpacing: -0.2 },
});
const ce = StyleSheet.create({
  coverUpload: { borderRadius: 18, overflow: 'hidden', height: 160, backgroundColor: C.surfaceAlt, borderWidth: 1, borderColor: C.border },
  coverImg: { width: '100%', height: '100%' },
  coverPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6 },
  coverIconWrap: { width: 52, height: 52, borderRadius: 26, backgroundColor: P_LIGHT, alignItems: 'center', justifyContent: 'center' },
  coverPlaceholderTitle: { color: C.text, fontSize: 13, fontWeight: '700' },
  coverPlaceholderSub: { color: C.textMuted, fontSize: 11 },
  coverEditBadge: {
    position: 'absolute', bottom: 10, right: 10, flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(17,24,39,0.65)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20,
  },
  coverEditTxt: { color: '#fff', fontSize: 11, fontWeight: '700' },
  recapCover: { width: '100%', height: 120, borderRadius: 14, marginBottom: 4 },
  publishBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    height: 56, borderRadius: 16, backgroundColor: PRIMARY,
  },
  draftBtn  : { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 50, borderRadius: 14, backgroundColor: C.surfaceAlt, borderWidth: 1, borderColor: C.border },
  bottomNavBlur: { position: 'absolute', bottom: 0, left: 0, right: 0, borderTopWidth: 1, borderTopColor: C.border },
  bottomNav :{
    flexDirection: 'row', gap: 12, paddingHorizontal: EDGE,
    paddingBottom: Platform.OS === 'ios' ? 32 : 20, paddingTop: 14,
    backgroundColor: 'rgba(10,12,16,0.75)',
  },
  prevBtn   : {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    height: 52, borderRadius: 14, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
  },
  nextBtn   : { flex: 2, borderRadius: 14, overflow: 'hidden' },
  nextGrad  : { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 52, backgroundColor: PRIMARY },
});
