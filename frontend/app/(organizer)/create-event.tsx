/**
 * app/(organizer)/create-event.tsx — EVENTURE v3 ULTIMATE
 *
 * ✦ Formulaire 4 étapes avec animations spring
 * ✦ Budget calculé en temps réel par poste et global
 * ✦ Suggestions staff dynamiques (fn_get_staff_suggestions)
 * ✦ Auto-save brouillon toutes les 30s + à chaque étape
 * ✦ Publication → trigger Supabase notifie le staff compatible
 * ✦ Création automatique des missions confirmées
 * ✦ Invite staff depuis le catalogue (param route)
 * ✦ Validation intelligente par étape
 * ✦ UX futuriste : particules, glow, gradients dynamiques
 */
import React, {
  memo, useCallback, useEffect, useRef, useState,
} from 'react';
import {
  ActivityIndicator, Alert, Animated, Dimensions, Easing,
  Image, KeyboardAvoidingView, Platform, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { LinearGradient }  from 'expo-linear-gradient';
import { Ionicons }        from '@expo/vector-icons';
import { SafeAreaView }    from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase }        from '@/lib/supabase';

const { width: SW } = Dimensions.get('window');

// ─────────────────────────────────────────────────────────────────────────────
// PALETTE
// ─────────────────────────────────────────────────────────────────────────────
const BG    = '#020A06';
const GREEN = '#00D97E';
const GOLD  = '#F5C842';
const T = {
  white:    '#FFFFFF',
  muted:    'rgba(255,255,255,0.50)',
  faint:    'rgba(255,255,255,0.20)',
  surf:     'rgba(255,255,255,0.05)',
  surfHi:   'rgba(255,255,255,0.09)',
  border:   'rgba(0,217,126,0.12)',
  borderHi: 'rgba(0,217,126,0.30)',
  greenDim: 'rgba(0,217,126,0.12)',
  goldDim:  'rgba(245,200,66,0.12)',
  goldBd:   'rgba(245,200,66,0.28)',
  navy:     '#0A2218',
  amber:    '#F59E0B',
  red:      '#EF4444',
} as const;
const EDGE = 20;

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────
interface RoleForm {
  tempId:       string;
  role:         string;
  slots:        string;
  hourly_rate:  string;
  dress_code:   string;
  requirements: string;
}
interface EventForm {
  title:       string;
  description: string;
  type:        string;
  location:    string;
  date_start:  string;
  date_end:    string;
  roles:       RoleForm[];
}
interface StaffSuggestion {
  staff_id:      string;
  display_name:  string;
  avatar_url:    string | null;
  role:          string[];
  hourly_rate:   number;
  rating:        number;
  missions_count:number;
  location:      string;
  is_available:  boolean;
  match_score:   number;
  distance_km:   number | null;
}

const newRole = (): RoleForm => ({
  tempId:      `${Date.now()}_${Math.random().toString(36).slice(2)}`,
  role:        '',
  slots:       '2',
  hourly_rate: '15',
  dress_code:  '',
  requirements:'',
});
const EMPTY: EventForm = {
  title:'', description:'', type:'', location:'', date_start:'', date_end:'',
  roles: [newRole()],
};

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTES
// ─────────────────────────────────────────────────────────────────────────────
const EVENT_TYPES = [
  { k:'wedding',   l:'Mariage',   icon:'heart-outline'         as const, color:'#F472B6' },
  { k:'corporate', l:'Corporate', icon:'business-outline'      as const, color:'#38BDF8' },
  { k:'concert',   l:'Concert',   icon:'musical-notes-outline' as const, color:'#A78BFA' },
  { k:'sport',     l:'Sport',     icon:'trophy-outline'        as const, color:'#FB923C' },
  { k:'gala',      l:'Gala',      icon:'sparkles-outline'      as const, color: GOLD     },
  { k:'festival',  l:'Festival',  icon:'color-palette-outline' as const, color:'#4ADE80' },
  { k:'private',   l:'Privé',     icon:'home-outline'          as const, color:'#94A3B8' },
  { k:'other',     l:'Autre',     icon:'calendar-outline'      as const, color: T.muted  },
] as const;

const ROLES_CAT = [
  'Serveur·se', 'Barman / Barmaid', 'Chef de rang',
  "Hôte·sse d'accueil", 'Agent de sécurité', 'Coordinateur·rice',
  'Runner', 'Sommelier·ère', 'Valet parking',
  'Technicien·ne son/lumière', 'Photographe', 'Vidéaste',
] as const;

const ROLE_COLORS: Record<string, string> = {
  'Serveur·se':              '#60A5FA',
  'Barman / Barmaid':        '#A78BFA',
  'Chef de rang':             '#34D399',
  "Hôte·sse d'accueil":      '#F472B6',
  'Agent de sécurité':        '#FB923C',
  'Coordinateur·rice':        GREEN,
  'Runner':                  '#FDE68A',
  'Sommelier·ère':           GOLD,
  'Valet parking':           '#94A3B8',
  'Technicien·ne son/lumière':'#67E8F9',
  'Photographe':             '#C084FC',
  'Vidéaste':                '#F87171',
};

const STEPS = ['Infos', 'Lieu & Date', 'Rôles', 'Récap'];

// ─────────────────────────────────────────────────────────────────────────────
// PARTICLE BACKGROUND
// ─────────────────────────────────────────────────────────────────────────────
const ParticleBg = memo(function ParticleBg() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient colors={[BG, '#051A0E', '#061408', BG]} style={StyleSheet.absoluteFill}/>
      <View style={{ position:'absolute', top:'4%', left:'8%', width:SW*.85, height:SW*.85, borderRadius:SW*.42, backgroundColor:'rgba(0,217,126,0.03)' }}/>
      <View style={{ position:'absolute', bottom:'8%', right:'-18%', width:SW*.65, height:SW*.65, borderRadius:SW*.32, backgroundColor:'rgba(245,200,66,0.025)' }}/>
    </View>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// STEP BAR ANIMÉE
// ─────────────────────────────────────────────────────────────────────────────
const StepBar = memo(function StepBar({ current }: { current: number }) {
  const anims = useRef(STEPS.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    STEPS.forEach((_, i) => {
      Animated.spring(anims[i], {
        toValue:  i <= current ? 1 : 0,
        tension:  120,
        friction: 8,
        useNativeDriver: false,
      }).start();
    });
  }, [current]);

  return (
    <View style={sb.container}>
      {STEPS.map((label, i) => {
        const done   = i < current;
        const active = i === current;
        const scl    = anims[i].interpolate({ inputRange:[0,1], outputRange:[0.84,1] });
        const bgCol  = done ? GREEN : active ? 'rgba(0,217,126,0.18)' : T.surf;
        const bdCol  = done || active ? GREEN : T.border;

        return (
          <React.Fragment key={label}>
            <View style={sb.stepWrap}>
              <Animated.View style={[sb.circle, { backgroundColor:bgCol, borderColor:bdCol, transform:[{scale:scl}] }]}>
                {done
                  ? <Ionicons name="checkmark" size={13} color="#fff"/>
                  : <Text style={[sb.num, active && { color:GREEN, fontWeight:'900' }]}>{i + 1}</Text>
                }
              </Animated.View>
              <Text style={[sb.label, active && { color:GREEN }, done && { color:T.muted }]}>
                {label}
              </Text>
            </View>
            {i < STEPS.length - 1 && (
              <Animated.View style={[
                sb.line,
                { backgroundColor: anims[i].interpolate({ inputRange:[0,1], outputRange:[T.border, GREEN] }) }
              ]}/>
            )}
          </React.Fragment>
        );
      })}
    </View>
  );
});
const sb = StyleSheet.create({
  container: { flexDirection:'row', alignItems:'flex-start', paddingHorizontal:EDGE, paddingBottom:22, gap:0 },
  stepWrap:  { alignItems:'center', gap:5 },
  circle:    { width:32, height:32, borderRadius:16, borderWidth:1.5, alignItems:'center', justifyContent:'center' },
  num:       { color:T.faint, fontSize:12, fontWeight:'700' },
  label:     { color:T.faint, fontSize:9, fontWeight:'600', textAlign:'center', maxWidth:58, letterSpacing:0.2 },
  line:      { flex:1, height:1.5, marginTop:16, marginHorizontal:3, borderRadius:1 },
});

// ─────────────────────────────────────────────────────────────────────────────
// FIELD COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
const Field = memo(function Field({
  label, value, onChange, placeholder, multiline,
  keyboardType, hint, required, icon,
}: {
  label:string; value:string; onChange:(v:string)=>void;
  placeholder?:string; multiline?:boolean; keyboardType?:any;
  hint?:string; required?:boolean; icon?:keyof typeof Ionicons.glyphMap;
}) {
  const [focused, setFocused] = useState(false);
  const borderAnim = useRef(new Animated.Value(0)).current;

  const onFocus = () => {
    setFocused(true);
    Animated.spring(borderAnim, { toValue:1, tension:200, friction:10, useNativeDriver:false }).start();
  };
  const onBlur = () => {
    setFocused(false);
    Animated.spring(borderAnim, { toValue:0, tension:200, friction:10, useNativeDriver:false }).start();
  };

  const borderColor = borderAnim.interpolate({ inputRange:[0,1], outputRange:[T.border, GREEN] });
  const bgColor     = borderAnim.interpolate({ inputRange:[0,1], outputRange:[T.surf, 'rgba(0,217,126,0.06)'] });

  return (
    <View style={{ gap:7 }}>
      <View style={{ flexDirection:'row', alignItems:'center', gap:5 }}>
        {icon && <Ionicons name={icon} size={11} color={T.muted}/>}
        <Text style={{ color:T.muted, fontSize:10, fontWeight:'700', letterSpacing:0.9, textTransform:'uppercase' }}>
          {label}
        </Text>
        {required && <Text style={{ color:GREEN, fontSize:12, fontWeight:'900' }}>*</Text>}
      </View>
      <Animated.View style={[fd.wrap, { borderColor, backgroundColor:bgColor }]}>
        <TextInput
          style={[fd.input, multiline && fd.multi]}
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={T.faint}
          multiline={multiline}
          keyboardType={keyboardType ?? 'default'}
          textAlignVertical={multiline ? 'top' : 'center'}
          onFocus={onFocus}
          onBlur={onBlur}
        />
      </Animated.View>
      {hint && <Text style={{ color:T.faint, fontSize:10, lineHeight:14 }}>{hint}</Text>}
    </View>
  );
});
const fd = StyleSheet.create({
  wrap:  { borderRadius:14, borderWidth:1.5, overflow:'hidden' },
  input: { paddingHorizontal:14, paddingVertical:13, color:T.white, fontSize:14 },
  multi: { minHeight:90, lineHeight:20 },
});

// ─────────────────────────────────────────────────────────────────────────────
// ANIMATED BUDGET COUNTER
// ─────────────────────────────────────────────────────────────────────────────
function useBudgetAnim(target: number) {
  const [display, setDisplay] = useState(0);
  const ref = useRef(0);

  useEffect(() => {
    const diff = target - ref.current;
    if (Math.abs(diff) < 1) { setDisplay(target); return; }
    const steps = 20;
    const delta = diff / steps;
    let count = 0;
    const id = setInterval(() => {
      ref.current += delta;
      count++;
      setDisplay(Math.round(ref.current));
      if (count >= steps) { ref.current = target; setDisplay(target); clearInterval(id); }
    }, 16);
    return () => clearInterval(id);
  }, [target]);

  return display;
}

// ─────────────────────────────────────────────────────────────────────────────
// STAFF SUGGESTION CARD
// ─────────────────────────────────────────────────────────────────────────────
const SuggestionCard = memo(function SuggestionCard({
  s, onInvite,
}: { s: StaffSuggestion; onInvite: () => void }) {
  const [imgErr, setImgErr] = useState(false);
  const stars = Math.round(s.rating);
  const anim  = useRef(new Animated.Value(1)).current;
  const press = () => {
    Animated.sequence([
      Animated.spring(anim, { toValue:.95, tension:300, friction:8, useNativeDriver:true }),
      Animated.spring(anim, { toValue:1,   tension:200, friction:8, useNativeDriver:true }),
    ]).start(onInvite);
  };
  return (
    <Animated.View style={{ transform:[{scale:anim}], width:160 }}>
      <TouchableOpacity style={sg.card} onPress={press} activeOpacity={1}>
        <LinearGradient colors={['rgba(0,217,126,0.08)','rgba(0,217,126,0.02)']} style={StyleSheet.absoluteFillObject}/>
        {/* Available badge */}
        <View style={[sg.availDot, { backgroundColor: s.is_available ? GREEN : T.amber }]}/>
        {/* Score badge */}
        <View style={sg.scoreBadge}>
          <Text style={sg.scoreTxt}>{Math.round(s.match_score)}%</Text>
        </View>
        {/* Avatar */}
        <View style={{ alignItems:'center', marginBottom:8, marginTop:4 }}>
          {s.avatar_url && !imgErr
            ? <Image source={{ uri:s.avatar_url }} style={sg.avatar} resizeMode="cover" onError={()=>setImgErr(true)}/>
            : <View style={[sg.avatar, sg.avatarFb]}><Ionicons name="person-outline" size={20} color={GREEN}/></View>
          }
        </View>
        {/* Info */}
        <Text style={sg.name} numberOfLines={1}>{s.display_name}</Text>
        <Text style={sg.role} numberOfLines={1}>{Array.isArray(s.role) ? s.role[0] : s.role}</Text>
        <View style={{ flexDirection:'row', gap:1, justifyContent:'center', marginVertical:4 }}>
          {[1,2,3,4,5].map(i=><Ionicons key={i} name={i<=stars?'star':'star-outline'} size={9} color={i<=stars?GOLD:T.faint}/>)}
        </View>
        <Text style={sg.rate}>{s.hourly_rate}€/h</Text>
        {s.distance_km != null && (
          <View style={{ flexDirection:'row', alignItems:'center', justifyContent:'center', gap:3, marginTop:3 }}>
            <Ionicons name="location-outline" size={9} color={T.faint}/>
            <Text style={{ color:T.faint, fontSize:9 }}>{s.distance_km < 1 ? '<1' : s.distance_km}km</Text>
          </View>
        )}
        {/* Invite CTA */}
        <TouchableOpacity style={sg.inviteBtn} onPress={press} activeOpacity={0.82}>
          <Text style={sg.inviteTxt}>Inviter</Text>
        </TouchableOpacity>
        <View style={{ position:'absolute', top:0, left:0, right:0, bottom:0, borderRadius:16, borderWidth:StyleSheet.hairlineWidth, borderColor:T.border }} pointerEvents="none"/>
      </TouchableOpacity>
    </Animated.View>
  );
});
const sg = StyleSheet.create({
  card:      { borderRadius:16, overflow:'hidden', backgroundColor:T.navy, padding:12, alignItems:'center' },
  availDot:  { position:'absolute', top:10, left:10, width:8, height:8, borderRadius:4 },
  scoreBadge:{ position:'absolute', top:8, right:8, paddingHorizontal:5, paddingVertical:2, borderRadius:8, backgroundColor:T.greenDim, borderWidth:StyleSheet.hairlineWidth, borderColor:T.borderHi },
  scoreTxt:  { color:GREEN, fontSize:9, fontWeight:'800' },
  avatar:    { width:52, height:52, borderRadius:26 },
  avatarFb:  { backgroundColor:'rgba(0,217,126,0.10)', alignItems:'center', justifyContent:'center', borderWidth:1, borderColor:T.border },
  name:      { color:T.white, fontSize:12, fontWeight:'800', textAlign:'center', marginBottom:2 },
  role:      { color:T.muted, fontSize:9, textAlign:'center', fontStyle:'italic' },
  rate:      { color:GOLD, fontSize:13, fontWeight:'900', textAlign:'center' },
  inviteBtn: { marginTop:8, paddingHorizontal:14, paddingVertical:6, borderRadius:12, backgroundColor:T.greenDim, borderWidth:1, borderColor:T.borderHi },
  inviteTxt: { color:GREEN, fontSize:11, fontWeight:'800' },
});

// ─────────────────────────────────────────────────────────────────────────────
// STEP 1 — Titre + Type
// ─────────────────────────────────────────────────────────────────────────────
const Step1 = memo(function Step1({ form, onChange }: {
  form: EventForm; onChange: <K extends keyof EventForm>(k: K, v: EventForm[K]) => void;
}) {
  return (
    <View style={{ gap:22, padding:EDGE }}>
      <Field
        label="Titre de la mission" icon="pencil-outline" required
        value={form.title}
        onChange={v => onChange('title', v)}
        placeholder="Ex : Gala de fin d'année Entreprise X"
      />

      {/* Type selector */}
      <View style={{ gap:12 }}>
        <View style={{ flexDirection:'row', alignItems:'center', gap:6 }}>
          <Ionicons name="layers-outline" size={11} color={T.muted}/>
          <Text style={{ color:T.muted, fontSize:10, fontWeight:'700', letterSpacing:0.9, textTransform:'uppercase' }}>
            Type d'événement <Text style={{ color:GREEN }}>*</Text>
          </Text>
        </View>
        <View style={{ flexDirection:'row', flexWrap:'wrap', gap:10 }}>
          {EVENT_TYPES.map(t => {
            const active = form.type === t.k;
            return (
              <TouchableOpacity
                key={t.k}
                style={[
                  s1.typeCard,
                  active && { backgroundColor:`${t.color}1A`, borderColor:t.color, borderWidth:1.5 },
                ]}
                onPress={() => onChange('type', t.k)}
                activeOpacity={0.75}
              >
                <Ionicons name={t.icon} size={24} color={active ? t.color : T.muted}/>
                <Text style={[s1.typeLbl, active && { color:t.color, fontWeight:'700' }]}>{t.l}</Text>
                {active && <View style={{ position:'absolute', top:6, right:6, width:7, height:7, borderRadius:3.5, backgroundColor:t.color }}/>}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <Field
        label="Description" icon="document-text-outline"
        value={form.description}
        onChange={v => onChange('description', v)}
        placeholder="Contexte, ambiance, attentes pour le personnel…"
        multiline
        hint="Une description détaillée attire des candidatures de meilleure qualité"
      />
    </View>
  );
});
const s1 = StyleSheet.create({
  typeCard: { width:'22%', alignItems:'center', gap:6, paddingVertical:14, borderRadius:16, backgroundColor:T.surf, borderWidth:1, borderColor:T.border, position:'relative' },
  typeLbl:  { color:T.muted, fontSize:9, fontWeight:'600', textAlign:'center', lineHeight:12 },
});

// ─────────────────────────────────────────────────────────────────────────────
// STEP 2 — Lieu + Dates
// ─────────────────────────────────────────────────────────────────────────────
const Step2 = memo(function Step2({ form, onChange }: {
  form: EventForm; onChange: <K extends keyof EventForm>(k: K, v: EventForm[K]) => void;
}) {
  const dur = React.useMemo(() => {
    try {
      const h = Math.abs(new Date(form.date_end).getTime() - new Date(form.date_start).getTime()) / 3_600_000;
      return isNaN(h) || h <= 0 ? null : h;
    } catch { return null; }
  }, [form.date_start, form.date_end]);

  const durAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(durAnim, { toValue: dur ? 1 : 0, tension:120, friction:10, useNativeDriver:true }).start();
  }, [!!dur]);

  return (
    <View style={{ gap:22, padding:EDGE }}>
      <Field
        label="Adresse complète" icon="location-outline" required
        value={form.location}
        onChange={v => onChange('location', v)}
        placeholder="15 Rue de la Paix, 75001 Paris"
      />

      {/* Dates côte à côte */}
      <View style={{ flexDirection:'row', gap:14 }}>
        <View style={{ flex:1 }}>
          <Field
            label="Début" icon="play-outline" required
            value={form.date_start}
            onChange={v => onChange('date_start', v)}
            placeholder="2025-07-15T19:00"
            hint="AAAA-MM-JJTHH:mm"
          />
        </View>
        <View style={{ flex:1 }}>
          <Field
            label="Fin" icon="stop-outline" required
            value={form.date_end}
            onChange={v => onChange('date_end', v)}
            placeholder="2025-07-15T23:30"
            hint="AAAA-MM-JJTHH:mm"
          />
        </View>
      </View>

      {/* Durée calculée — apparaît en fondu */}
      <Animated.View style={{ opacity:durAnim, transform:[{scale:durAnim.interpolate({inputRange:[0,1],outputRange:[0.95,1]})}] }}>
        {dur && (
          <View style={s2.durBox}>
            <View style={s2.durIcon}>
              <Ionicons name="time-outline" size={20} color={GREEN}/>
            </View>
            <View style={{ flex:1 }}>
              <Text style={s2.durVal}>{dur.toFixed(1)} heures de mission</Text>
              <Text style={s2.durSub}>
                {new Date(form.date_start).toLocaleString('fr-FR', { weekday:'long', day:'numeric', month:'long' })}
              </Text>
            </View>
            <View style={s2.durBadge}>
              <Text style={s2.durBadgeTxt}>{Math.round(dur * 60)} min</Text>
            </View>
          </View>
        )}
      </Animated.View>

      {/* Conseils */}
      <View style={s2.tips}>
        <Ionicons name="bulb-outline" size={14} color={T.amber}/>
        <Text style={s2.tipsTxt}>
          Les missions entre 4h et 8h reçoivent 3× plus de candidatures. Prévoyez 30min d'arrivée avant l'événement.
        </Text>
      </View>
    </View>
  );
});
const s2 = StyleSheet.create({
  durBox:      { flexDirection:'row', alignItems:'center', gap:12, backgroundColor:'rgba(0,217,126,0.10)', borderRadius:16, padding:14, borderWidth:1, borderColor:T.borderHi },
  durIcon:     { width:40, height:40, borderRadius:20, backgroundColor:'rgba(0,217,126,0.20)', alignItems:'center', justifyContent:'center' },
  durVal:      { color:GREEN, fontSize:16, fontWeight:'900', letterSpacing:-0.3 },
  durSub:      { color:'rgba(0,217,126,0.60)', fontSize:10, marginTop:2 },
  durBadge:    { paddingHorizontal:8, paddingVertical:3, borderRadius:10, backgroundColor:'rgba(0,217,126,0.15)' },
  durBadgeTxt: { color:GREEN, fontSize:11, fontWeight:'700' },
  tips:        { flexDirection:'row', gap:10, backgroundColor:'rgba(245,158,11,0.08)', borderRadius:12, padding:12, borderWidth:StyleSheet.hairlineWidth, borderColor:'rgba(245,158,11,0.22)', alignItems:'flex-start' },
  tipsTxt:     { color:T.amber, fontSize:11, lineHeight:16, flex:1 },
});

// ─────────────────────────────────────────────────────────────────────────────
// STEP 3 — Rôles + Suggestions staff dynamiques
// ─────────────────────────────────────────────────────────────────────────────
const Step3 = memo(function Step3({
  form, onAdd, onUpdate, onRemove, draftId, onInviteStaff,
}: {
  form:          EventForm;
  onAdd:         () => void;
  onUpdate:      (id:string, k:keyof RoleForm, v:string) => void;
  onRemove:      (id:string) => void;
  draftId:       string | null;
  onInviteStaff: (staffId:string, role:string) => void;
}) {
  const [suggestions, setSuggestions] = useState<StaffSuggestion[]>([]);
  const [loadingSugg, setLoadingSugg] = useState(false);
  const [selectedRole, setSelectedRole] = useState<string|null>(null);

  const dur = React.useMemo(() => {
    try {
      const h = Math.abs(new Date(form.date_end).getTime() - new Date(form.date_start).getTime()) / 3_600_000;
      return isNaN(h) || h <= 0 ? 0 : h;
    } catch { return 0; }
  }, [form.date_start, form.date_end]);

  const totalBudget = form.roles.reduce((a, r) => a + (parseInt(r.slots) || 0) * (parseFloat(r.hourly_rate) || 0) * dur, 0);
  const displayBudget = useBudgetAnim(Math.round(totalBudget));

  // Charger suggestions quand un rôle est sélectionné + draftId disponible
  const loadSuggestions = useCallback(async (role: string) => {
    if (!draftId && !role) return;
    setLoadingSugg(true);
    setSelectedRole(role);
    try {
      const { data, error } = await supabase.rpc('fn_get_staff_suggestions', {
        p_event_id:    draftId ?? '00000000-0000-0000-0000-000000000000',
        p_role:        role || null,
        p_max_results: 6,
      });
      if (!error && data) setSuggestions(data as StaffSuggestion[]);
      else {
        // Fallback : requête directe sur la table staff
        const { data: staffData } = await supabase
          .from('staff')
          .select('id,display_name,avatar_url,role,hourly_rate,rating,missions_count,location,is_available')
          .contains('role', [role])
          .eq('is_available', true)
          .order('rating', { ascending:false })
          .limit(6);
        setSuggestions((staffData ?? []).map((s: any) => ({
          staff_id:s.id, display_name:s.display_name, avatar_url:s.avatar_url,
          role:s.role, hourly_rate:s.hourly_rate, rating:s.rating,
          missions_count:s.missions_count, location:s.location,
          is_available:s.is_available, match_score:s.rating*20, distance_km:null,
        })));
      }
    } catch { setSuggestions([]); }
    finally { setLoadingSugg(false); }
  }, [draftId]);

  return (
    <View style={{ gap:16, padding:EDGE }}>

      {/* Budget global live */}
      <View style={s3.budgetBox}>
        <View style={{ flex:1 }}>
          <Text style={s3.budgetLabel}>Budget total estimé</Text>
          <Text style={s3.budgetVal}>{displayBudget.toLocaleString('fr-FR')} €</Text>
          <Text style={s3.budgetSub}>Mis à jour en temps réel · {dur.toFixed(1)}h</Text>
        </View>
        <View style={s3.budgetIcon}>
          <Ionicons name="cash-outline" size={28} color={GOLD}/>
        </View>
      </View>

      <Text style={{ color:T.muted, fontSize:13, lineHeight:19 }}>
        Définissez vos postes. Le budget et les suggestions de staff se mettent à jour automatiquement.
      </Text>

      {/* Rôles */}
      {form.roles.map((r, idx) => {
        const roleColor = ROLE_COLORS[r.role] ?? GREEN;
        const costRole  = (parseInt(r.slots)||0) * (parseFloat(r.hourly_rate)||0) * dur;

        return (
          <View key={r.tempId} style={s3.roleCard}>
            {/* Header rôle */}
            <View style={{ flexDirection:'row', alignItems:'center', gap:10, marginBottom:12 }}>
              <View style={[s3.roleNum, r.role && { backgroundColor:`${roleColor}22`, borderColor:`${roleColor}44` }]}>
                <Text style={[s3.roleNumTxt, r.role && { color:roleColor }]}>{idx + 1}</Text>
              </View>
              <Text style={{ flex:1, color:T.white, fontSize:14, fontWeight:'800' }}>
                {r.role || `Poste ${idx + 1}`}
              </Text>
              {costRole > 0 && (
                <View style={s3.costBadge}>
                  <Text style={s3.costBadgeTxt}>{Math.round(costRole).toLocaleString('fr-FR')}€</Text>
                </View>
              )}
              {form.roles.length > 1 && (
                <TouchableOpacity
                  onPress={() => onRemove(r.tempId)}
                  hitSlop={10}
                  style={s3.removeBtn}
                >
                  <Ionicons name="close" size={14} color={T.red}/>
                </TouchableOpacity>
              )}
            </View>

            {/* Sélecteur de rôle */}
            <Text style={s3.fieldLbl}>INTITULÉ DU POSTE *</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom:14 }}>
              <View style={{ flexDirection:'row', gap:8, paddingBottom:2 }}>
                {ROLES_CAT.map(rc => {
                  const rcColor = ROLE_COLORS[rc] ?? GREEN;
                  const active  = r.role === rc;
                  return (
                    <TouchableOpacity
                      key={rc}
                      style={[
                        s3.rPill,
                        active && { backgroundColor:`${rcColor}1A`, borderColor:rcColor, borderWidth:1.5 },
                      ]}
                      onPress={() => {
                        onUpdate(r.tempId, 'role', rc);
                        loadSuggestions(rc);
                      }}
                      activeOpacity={0.75}
                    >
                      <Text style={[s3.rPillTxt, active && { color:rcColor, fontWeight:'800' }]}>{rc}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>

            {/* Slots + Tarif */}
            <View style={{ flexDirection:'row', gap:12, marginBottom:10 }}>
              <View style={{ flex:1 }}>
                <Text style={s3.fieldLbl}>POSTES *</Text>
                <TextInput
                  style={s3.numInput}
                  value={r.slots}
                  onChangeText={v => onUpdate(r.tempId, 'slots', v)}
                  keyboardType="number-pad"
                  placeholder="2"
                  placeholderTextColor={T.faint}
                />
              </View>
              <View style={{ flex:1 }}>
                <Text style={s3.fieldLbl}>TARIF €/H *</Text>
                <TextInput
                  style={s3.numInput}
                  value={r.hourly_rate}
                  onChangeText={v => onUpdate(r.tempId, 'hourly_rate', v)}
                  keyboardType="decimal-pad"
                  placeholder="15"
                  placeholderTextColor={T.faint}
                />
              </View>
            </View>

            {/* Calcul détaillé */}
            {dur > 0 && r.slots && r.hourly_rate && (
              <View style={s3.calcRow}>
                <Ionicons name="calculator-outline" size={12} color={GOLD}/>
                <Text style={s3.calcTxt}>
                  {r.slots} × {r.hourly_rate}€/h × {dur.toFixed(1)}h
                  <Text style={{ color:GOLD, fontWeight:'900' }}> = {Math.round(costRole).toLocaleString('fr-FR')}€</Text>
                </Text>
              </View>
            )}

            {/* Dress code + requirements */}
            <View style={{ gap:8, marginTop:4 }}>
              <TextInput
                style={s3.textField}
                value={r.dress_code}
                onChangeText={v => onUpdate(r.tempId, 'dress_code', v)}
                placeholder="Dress code (ex : Costume noir, Tablier fourni…)"
                placeholderTextColor={T.faint}
              />
              <TextInput
                style={s3.textField}
                value={r.requirements}
                onChangeText={v => onUpdate(r.tempId, 'requirements', v)}
                placeholder="Exigences : expérience, certifications, langues…"
                placeholderTextColor={T.faint}
              />
            </View>

            {/* ── Suggestions staff pour ce rôle ── */}
            {r.role && (
              <View style={{ marginTop:14 }}>
                <View style={{ flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
                  <View style={{ flexDirection:'row', alignItems:'center', gap:7 }}>
                    <Ionicons name="people-outline" size={13} color={GREEN}/>
                    <Text style={{ color:GREEN, fontSize:12, fontWeight:'700' }}>
                      Staff suggéré — {r.role}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => loadSuggestions(r.role)} hitSlop={8}>
                    <Ionicons name="refresh-outline" size={13} color={T.muted}/>
                  </TouchableOpacity>
                </View>

                {loadingSugg && selectedRole === r.role ? (
                  <View style={{ paddingVertical:16, alignItems:'center' }}>
                    <ActivityIndicator color={GREEN} size="small"/>
                    <Text style={{ color:T.muted, fontSize:11, marginTop:6 }}>Recherche des meilleurs profils…</Text>
                  </View>
                ) : suggestions.length > 0 && selectedRole === r.role ? (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap:10 }}>
                    {suggestions.map(sg => (
                      <SuggestionCard
                        key={sg.staff_id}
                        s={sg}
                        onInvite={() => onInviteStaff(sg.staff_id, r.role)}
                      />
                    ))}
                  </ScrollView>
                ) : (
                  <TouchableOpacity
                    style={s3.loadSuggBtn}
                    onPress={() => loadSuggestions(r.role)}
                    activeOpacity={0.80}
                  >
                    <Ionicons name="search-outline" size={13} color={T.muted}/>
                    <Text style={{ color:T.muted, fontSize:12, fontWeight:'600' }}>
                      Voir les suggestions pour ce poste
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        );
      })}

      {/* Ajouter un poste */}
      <TouchableOpacity style={s3.addBtn} onPress={onAdd} activeOpacity={0.78}>
        <View style={s3.addIcon}>
          <Ionicons name="add" size={20} color={GREEN}/>
        </View>
        <Text style={{ color:GREEN, fontSize:14, fontWeight:'800' }}>Ajouter un poste</Text>
      </TouchableOpacity>
    </View>
  );
});
const s3 = StyleSheet.create({
  budgetBox:   { flexDirection:'row', alignItems:'center', gap:14, backgroundColor:T.goldDim, borderRadius:18, padding:16, borderWidth:1.5, borderColor:T.goldBd },
  budgetLabel: { color:'rgba(245,200,66,0.65)', fontSize:10, fontWeight:'700', textTransform:'uppercase', letterSpacing:0.9 },
  budgetVal:   { color:GOLD, fontSize:26, fontWeight:'900', letterSpacing:-0.5, marginVertical:2 },
  budgetSub:   { color:'rgba(245,200,66,0.50)', fontSize:10 },
  budgetIcon:  { width:52, height:52, borderRadius:26, backgroundColor:'rgba(245,200,66,0.15)', alignItems:'center', justifyContent:'center' },
  roleCard:    { backgroundColor:T.surf, borderRadius:20, padding:16, borderWidth:1, borderColor:T.border },
  roleNum:     { width:28, height:28, borderRadius:14, backgroundColor:T.greenDim, alignItems:'center', justifyContent:'center', borderWidth:1, borderColor:T.borderHi },
  roleNumTxt:  { color:GREEN, fontSize:12, fontWeight:'900' },
  costBadge:   { paddingHorizontal:8, paddingVertical:3, borderRadius:10, backgroundColor:T.goldDim, borderWidth:StyleSheet.hairlineWidth, borderColor:T.goldBd },
  costBadgeTxt:{ color:GOLD, fontSize:10, fontWeight:'800' },
  removeBtn:   { width:28, height:28, borderRadius:14, backgroundColor:'rgba(239,68,68,0.10)', alignItems:'center', justifyContent:'center' },
  fieldLbl:    { color:T.muted, fontSize:9, fontWeight:'700', letterSpacing:0.9, marginBottom:7, textTransform:'uppercase' },
  rPill:       { paddingHorizontal:12, paddingVertical:7, borderRadius:20, backgroundColor:T.surfHi, borderWidth:1, borderColor:T.border },
  rPillTxt:    { color:T.muted, fontSize:11 },
  numInput:    { backgroundColor:T.surf, borderRadius:12, borderWidth:1, borderColor:T.border, paddingHorizontal:14, paddingVertical:12, color:T.white, fontSize:18, fontWeight:'900', textAlign:'center' },
  calcRow:     { flexDirection:'row', alignItems:'center', gap:6, marginBottom:8 },
  calcTxt:     { color:T.muted, fontSize:11 },
  textField:   { backgroundColor:T.surf, borderRadius:12, borderWidth:1, borderColor:T.border, paddingHorizontal:14, paddingVertical:11, color:T.white, fontSize:13 },
  loadSuggBtn: { flexDirection:'row', alignItems:'center', gap:8, paddingHorizontal:14, paddingVertical:10, borderRadius:12, backgroundColor:T.surf, borderWidth:StyleSheet.hairlineWidth, borderColor:T.border },
  addBtn:      { flexDirection:'row', alignItems:'center', justifyContent:'center', gap:12, paddingVertical:18, borderRadius:18, borderWidth:1.5, borderColor:T.borderHi, borderStyle:'dashed' as any },
  addIcon:     { width:36, height:36, borderRadius:18, backgroundColor:T.greenDim, alignItems:'center', justifyContent:'center', borderWidth:1, borderColor:T.borderHi },
});

// ─────────────────────────────────────────────────────────────────────────────
// STEP 4 — Récapitulatif + Estimation finale
// ─────────────────────────────────────────────────────────────────────────────
const Step4 = memo(function Step4({ form }: { form: EventForm }) {
  const dur = React.useMemo(() => {
    try {
      const h = Math.abs(new Date(form.date_end).getTime() - new Date(form.date_start).getTime()) / 3_600_000;
      return isNaN(h) || h <= 0 ? 0 : h;
    } catch { return 0; }
  }, [form.date_start, form.date_end]);

  const budget  = form.roles.reduce((a,r) => a + (parseInt(r.slots)||0) * (parseFloat(r.hourly_rate)||0) * dur, 0);
  const total   = form.roles.reduce((a,r) => a + (parseInt(r.slots)||0), 0);
  const type    = EVENT_TYPES.find(t => t.k === form.type);
  const displayBudget = useBudgetAnim(Math.round(budget));

  const fmtDt = (iso: string) => {
    try { return new Date(iso).toLocaleString('fr-FR', { weekday:'long', day:'numeric', month:'long', hour:'2-digit', minute:'2-digit' }); }
    catch { return iso; }
  };

  return (
    <View style={{ gap:18, padding:EDGE }}>
      <Text style={{ color:T.white, fontSize:15, fontWeight:'800', letterSpacing:-0.2 }}>
        Vérifiez votre mission avant publication
      </Text>

      {/* Budget grand format */}
      <View style={s4.budgetHero}>
        <Text style={s4.budgetHeroLabel}>Budget total estimé</Text>
        <Text style={s4.budgetHeroVal}>{displayBudget.toLocaleString('fr-FR')} €</Text>
        <View style={s4.budgetHeroPills}>
          <View style={s4.pill}><Text style={s4.pillTxt}>{total} poste{total>1?'s':''}</Text></View>
          <View style={s4.pill}><Text style={s4.pillTxt}>{dur.toFixed(1)}h</Text></View>
          <View style={s4.pill}><Text style={s4.pillTxt}>{form.roles.length} rôle{form.roles.length>1?'s':''}</Text></View>
        </View>
      </View>

      {/* Détails mission */}
      <View style={s4.detailCard}>
        {[
          { icon:'pencil-outline'   as const, k:'Titre',     v:form.title||'—' },
          { icon:'layers-outline'   as const, k:'Type',      v:type?.l??'—' },
          { icon:'location-outline' as const, k:'Lieu',      v:form.location||'—' },
          { icon:'play-outline'     as const, k:'Début',     v:form.date_start ? fmtDt(form.date_start):'—' },
          { icon:'stop-outline'     as const, k:'Fin',       v:form.date_end   ? fmtDt(form.date_end)  :'—' },
          { icon:'time-outline'     as const, k:'Durée',     v:dur>0?`${dur.toFixed(1)} heures`:'—' },
        ].map(({ icon,k,v }, i, arr) => (
          <View key={k} style={[s4.detailRow, i < arr.length-1 && { borderBottomWidth:StyleSheet.hairlineWidth, borderBottomColor:T.border }]}>
            <Ionicons name={icon} size={14} color={GREEN} style={{ marginTop:1 }}/>
            <Text style={s4.detailKey}>{k}</Text>
            <Text style={s4.detailVal} numberOfLines={2}>{v}</Text>
          </View>
        ))}
      </View>

      {/* Postes détaillés */}
      <Text style={{ color:T.white, fontSize:13, fontWeight:'800' }}>Postes ({total} au total)</Text>
      {form.roles.map((r, i) => {
        const roleColor = ROLE_COLORS[r.role] ?? GREEN;
        const cost = (parseInt(r.slots)||0) * (parseFloat(r.hourly_rate)||0) * dur;
        return (
          <View key={r.tempId} style={[s4.roleRow, { borderLeftColor:roleColor||GREEN, borderLeftWidth:3 }]}>
            <View style={{ flex:1, gap:2 }}>
              <Text style={{ color:T.white, fontSize:13, fontWeight:'800' }}>{r.role||`Poste ${i+1}`}</Text>
              {r.dress_code && <Text style={{ color:T.faint, fontSize:10 }}>{r.dress_code}</Text>}
            </View>
            <View style={{ alignItems:'flex-end', gap:2 }}>
              <Text style={{ color:T.muted, fontSize:11 }}>{r.slots} × {r.hourly_rate}€/h</Text>
              <Text style={{ color:GOLD, fontSize:13, fontWeight:'900' }}>
                {Math.round(cost).toLocaleString('fr-FR')}€
              </Text>
            </View>
          </View>
        );
      })}

      {/* Info publication */}
      <View style={s4.infoBox}>
        <Ionicons name="flash-outline" size={14} color={GREEN}/>
        <Text style={s4.infoTxt}>
          Après publication, votre mission sera <Text style={{ color:GREEN, fontWeight:'700' }}>immédiatement notifiée</Text> aux {total} profils correspondants disponibles dans votre zone. Vous pourrez la modifier depuis votre tableau de bord.
        </Text>
      </View>
    </View>
  );
});
const s4 = StyleSheet.create({
  budgetHero:       { backgroundColor:'rgba(0,217,126,0.10)', borderRadius:20, padding:20, alignItems:'center', gap:6, borderWidth:1.5, borderColor:T.borderHi },
  budgetHeroLabel:  { color:'rgba(0,217,126,0.60)', fontSize:10, fontWeight:'700', textTransform:'uppercase', letterSpacing:1.5 },
  budgetHeroVal:    { color:GREEN, fontSize:36, fontWeight:'900', letterSpacing:-1 },
  budgetHeroPills:  { flexDirection:'row', gap:8 },
  pill:             { paddingHorizontal:10, paddingVertical:4, borderRadius:12, backgroundColor:'rgba(0,217,126,0.15)' },
  pillTxt:          { color:GREEN, fontSize:10, fontWeight:'700' },
  detailCard:       { backgroundColor:T.surf, borderRadius:18, borderWidth:StyleSheet.hairlineWidth, borderColor:T.border, overflow:'hidden' },
  detailRow:        { flexDirection:'row', alignItems:'flex-start', paddingHorizontal:16, paddingVertical:12, gap:10 },
  detailKey:        { color:T.muted, fontSize:12, width:58 },
  detailVal:        { color:T.white, fontSize:12, fontWeight:'600', flex:1 },
  roleRow:          { flexDirection:'row', alignItems:'center', gap:12, padding:14, borderRadius:14, backgroundColor:T.surf, borderWidth:StyleSheet.hairlineWidth, borderColor:T.border, paddingLeft:12 },
  infoBox:          { flexDirection:'row', gap:10, backgroundColor:'rgba(0,217,126,0.06)', borderRadius:14, padding:14, borderWidth:1, borderColor:T.border, alignItems:'flex-start' },
  infoTxt:          { color:T.muted, fontSize:11, lineHeight:17, flex:1 },
});

// ─────────────────────────────────────────────────────────────────────────────
// VALIDATION
// ─────────────────────────────────────────────────────────────────────────────
function validate(form: EventForm, step: number): string | null {
  if (step === 0) {
    if (!form.title.trim())   return 'Le titre de la mission est obligatoire.';
    if (form.title.length < 3) return 'Titre trop court (minimum 3 caractères).';
    if (!form.type)            return "Sélectionnez un type d'événement.";
  }
  if (step === 1) {
    if (!form.location.trim()) return 'L\'adresse du lieu est obligatoire.';
    if (!form.date_start.trim()) return 'La date et heure de début sont obligatoires.';
    if (!form.date_end.trim())   return 'La date et heure de fin sont obligatoires.';
    try {
      if (new Date(form.date_end) <= new Date(form.date_start))
        return 'L\'heure de fin doit être après l\'heure de début.';
      const dur = (new Date(form.date_end).getTime() - new Date(form.date_start).getTime()) / 3_600_000;
      if (dur < 0.5) return 'La mission doit durer au moins 30 minutes.';
    } catch { return 'Format de date invalide. Utilisez : AAAA-MM-JJTHH:mm'; }
  }
  if (step === 2) {
    for (const r of form.roles) {
      if (!r.role)                         return 'Sélectionnez un intitulé pour chaque poste.';
      if (!r.slots || parseInt(r.slots) < 1)      return 'Minimum 1 poste requis par rôle.';
      if (!r.hourly_rate || parseFloat(r.hourly_rate) < 1) return 'Le tarif horaire minimum est de 1€/h.';
    }
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// SCREEN PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────
export default function CreateEventScreen() {
  const router  = useRouter();
  const params  = useLocalSearchParams<{ inviteStaffId?: string; inviteStaffName?: string }>();

  const [step,       setStep]       = useState(0);
  const [form,       setForm]       = useState<EventForm>(EMPTY);
  const [saving,     setSaving]     = useState(false);
  const [draftId,    setDraftId]    = useState<string | null>(null);
  const [autoSaved,  setAutoSaved]  = useState(false);
  const [publishOk,  setPublishOk]  = useState(false);

  const scrollRef    = useRef<ScrollView>(null);
  const stepAnim     = useRef(new Animated.Value(1)).current;
  const successAnim  = useRef(new Animated.Value(0)).current;
  const autoSaveRef  = useRef<ReturnType<typeof setInterval> | null>(null);

  // Auto-save toutes les 30s
  useEffect(() => {
    autoSaveRef.current = setInterval(() => {
      if (form.title || form.type || form.location) saveDraft().catch(() => {});
    }, 30_000);
    return () => { if (autoSaveRef.current) clearInterval(autoSaveRef.current); };
  }, [form]);

  // Si staff invité depuis le catalogue
  useEffect(() => {
    if (params.inviteStaffName) {
      setForm(f => ({ ...f, description: f.description + (f.description ? '\n' : '') + `Staff suggéré : ${params.inviteStaffName}` }));
    }
  }, [params.inviteStaffName]);

  // ── Helpers ─────────────────────────────────────────────────────────────────
  const onChange = useCallback(<K extends keyof EventForm>(k: K, v: EventForm[K]) => {
    setForm(f => ({ ...f, [k]: v }));
  }, []);

  const onAddRole    = useCallback(() => setForm(f => ({ ...f, roles:[...f.roles, newRole()] })), []);
  const onRemoveRole = useCallback((id: string) => setForm(f => ({ ...f, roles:f.roles.filter(r => r.tempId !== id) })), []);
  const onUpdateRole = useCallback((id: string, k: keyof RoleForm, v: string) => {
    setForm(f => ({ ...f, roles:f.roles.map(r => r.tempId === id ? {...r,[k]:v} : r) }));
  }, []);

  const onInviteStaff = useCallback((staffId: string, role: string) => {
    Alert.alert(
      '📤 Inviter ce talent',
      `Voulez-vous contacter ce profil directement pour le poste de ${role} ?`,
      [
        { text: 'Annuler', style:'cancel' },
        { text: 'Contacter', onPress: () => router.push({ pathname:'/(shared)/chat/[id]', params:{ id:staffId } } as any) },
        { text: 'Ajouter à ma liste', onPress: () => {
          setForm(f => ({
            ...f,
            description: (f.description ? f.description + '\n' : '') + `Staff pressenti (${role}): user_${staffId.slice(0,8)}`,
          }));
          Alert.alert('✅ Noté !', 'Ce profil a été ajouté à vos notes de mission.');
        }},
      ]
    );
  }, [router]);

  // ── Save draft ───────────────────────────────────────────────────────────────
  const saveDraft = useCallback(async () => {
    const { data:{ session } } = await supabase.auth.getSession();
    if (!session) return;
    const uid = session.user.id;
    const payload = {
      organizer_id: uid,
      title:        form.title   || 'Brouillon',
      description:  form.description || null,
      type:         form.type    || 'other',
      location:     form.location || 'À définir',
      date_start:   form.date_start || new Date().toISOString(),
      date_end:     form.date_end   || new Date(Date.now() + 3_600_000).toISOString(),
      status:       'draft',
    };
    if (draftId) {
      await supabase.from('events').update(payload).eq('id', draftId);
    } else {
      const { data } = await supabase.from('events').insert(payload).select('id').single();
      if (data?.id) setDraftId(data.id);
    }
    setAutoSaved(true);
    setTimeout(() => setAutoSaved(false), 2500);
  }, [form, draftId]);

  // ── Navigation étapes ────────────────────────────────────────────────────────
  const animateTransition = useCallback(() => {
    stepAnim.setValue(0.93);
    Animated.spring(stepAnim, { toValue:1, tension:200, friction:10, useNativeDriver:true }).start();
  }, [stepAnim]);

  const goNext = useCallback(async () => {
    const err = validate(form, step);
    if (err) { Alert.alert('Champ manquant', err); return; }
    saveDraft().catch(() => {});
    setStep(s => s + 1);
    animateTransition();
    scrollRef.current?.scrollTo({ y:0, animated:true });
  }, [form, step, saveDraft, animateTransition]);

  const goBack = useCallback(() => {
    if (step === 0) { router.back(); return; }
    setStep(s => s - 1);
    animateTransition();
    scrollRef.current?.scrollTo({ y:0, animated:true });
  }, [step, router, animateTransition]);

  // ── Publication ──────────────────────────────────────────────────────────────
  const publish = useCallback(async () => {
    setSaving(true);
    try {
      const { data:{ session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Vous devez être connecté pour publier une mission.');
      const uid = session.user.id;

      // 1. Upsert événement
      const eventPayload = {
        organizer_id: uid,
        title:        form.title,
        description:  form.description || null,
        type:         form.type,
        location:     form.location,
        date_start:   form.date_start,
        date_end:     form.date_end,
        status:       'published',
      };

      let eventId = draftId;
      if (eventId) {
        const { error:uErr } = await supabase.from('events').update(eventPayload).eq('id', eventId);
        if (uErr) throw uErr;
      } else {
        const { data, error } = await supabase.from('events').insert(eventPayload).select('id').single();
        if (error) throw error;
        eventId = data.id;
      }

      // 2. Supprimer anciens rôles si re-publication
      if (draftId) await supabase.from('event_roles').delete().eq('event_id', eventId);

      // 3. Insérer tous les rôles
      const rolesPayload = form.roles.map(r => ({
        event_id:     eventId,
        role:         r.role,
        slots:        parseInt(r.slots),
        slots_filled: 0,
        hourly_rate:  parseFloat(r.hourly_rate),
        dress_code:   r.dress_code   || null,
        requirements: r.requirements || null,
      }));
      const { error:rErr } = await supabase.from('event_roles').insert(rolesPayload);
      if (rErr) throw rErr;

      // 4. Animation succès
      setPublishOk(true);
      Animated.spring(successAnim, { toValue:1, tension:80, friction:8, useNativeDriver:true }).start();

      // 5. Redirect après 2s
      setTimeout(() => {
        router.replace('/(organizer)/dashboard' as any);
      }, 2200);

    } catch (e: any) {
      Alert.alert(
        'Erreur de publication',
        e?.message ?? 'Une erreur inattendue est survenue. Vérifiez votre connexion et réessayez.',
        [{ text:'Réessayer', onPress:() => setSaving(false) }]
      );
    } finally {
      if (!publishOk) setSaving(false);
    }
  }, [form, draftId, router, publishOk, successAnim]);

  // ── Success screen ────────────────────────────────────────────────────────────
  if (publishOk) {
    const totalStaff = form.roles.reduce((a,r) => a + (parseInt(r.slots)||0), 0);
    return (
      <View style={{ flex:1, backgroundColor:BG, alignItems:'center', justifyContent:'center', padding:EDGE }}>
        <ParticleBg/>
        <Animated.View style={{ alignItems:'center', gap:20, transform:[{scale:successAnim.interpolate({inputRange:[0,1],outputRange:[0.8,1]})}], opacity:successAnim }}>
          <View style={{ width:100, height:100, borderRadius:50, backgroundColor:'rgba(0,217,126,0.15)', alignItems:'center', justifyContent:'center', borderWidth:2, borderColor:GREEN }}>
            <Ionicons name="checkmark-circle" size={56} color={GREEN}/>
          </View>
          <Text style={{ color:T.white, fontSize:26, fontWeight:'900', textAlign:'center', letterSpacing:-0.5 }}>
            Mission publiée !
          </Text>
          <Text style={{ color:T.muted, fontSize:14, textAlign:'center', lineHeight:21 }}>
            "{form.title}" est maintenant visible.{'\n'}
            <Text style={{ color:GREEN, fontWeight:'700' }}>{totalStaff} profils</Text> vont être notifiés.
          </Text>
          <View style={{ backgroundColor:T.greenDim, borderRadius:14, padding:14, borderWidth:1, borderColor:T.borderHi }}>
            <Text style={{ color:GREEN, fontSize:12, textAlign:'center' }}>
              Redirection vers votre tableau de bord…
            </Text>
          </View>
        </Animated.View>
      </View>
    );
  }

  // ── Render principal ─────────────────────────────────────────────────────────
  return (
    <View style={{ flex:1, backgroundColor:BG }}>
      <ParticleBg/>

      <SafeAreaView edges={['top']}>
        {/* Top nav */}
        <View style={s.topNav}>
          <TouchableOpacity style={s.backBtn} onPress={goBack} activeOpacity={0.72}>
            <Ionicons name={step === 0 ? 'close' : 'chevron-back'} size={18} color={T.muted}/>
          </TouchableOpacity>

          <View style={{ alignItems:'center' }}>
            <Text style={s.navTitle}>Nouvelle mission</Text>
            {autoSaved && (
              <Animated.Text style={s.savedTxt}>✓ Brouillon sauvegardé</Animated.Text>
            )}
          </View>

          <View style={{ width:42, alignItems:'flex-end' }}>
            {step < 3 && (
              <TouchableOpacity onPress={() => saveDraft().catch(()=>{})} hitSlop={10}>
                <Ionicons name="cloud-upload-outline" size={18} color={autoSaved ? GREEN : T.faint}/>
              </TouchableOpacity>
            )}
          </View>
        </View>

        <StepBar current={step}/>
      </SafeAreaView>

      {/* Contenu animé */}
      <KeyboardAvoidingView
        style={{ flex:1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={130}
      >
        <Animated.ScrollView
          ref={scrollRef as any}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom:160 }}
          keyboardShouldPersistTaps="handled"
          style={{ transform:[{scale:stepAnim}] }}
        >
          {step === 0 && <Step1 form={form} onChange={onChange}/>}
          {step === 1 && <Step2 form={form} onChange={onChange}/>}
          {step === 2 && (
            <Step3
              form={form}
              onAdd={onAddRole}
              onUpdate={onUpdateRole}
              onRemove={onRemoveRole}
              draftId={draftId}
              onInviteStaff={onInviteStaff}
            />
          )}
          {step === 3 && <Step4 form={form}/>}
        </Animated.ScrollView>
      </KeyboardAvoidingView>

      {/* CTA bas */}
      <SafeAreaView
        edges={['bottom']}
        style={{ backgroundColor:BG, borderTopWidth:StyleSheet.hairlineWidth, borderTopColor:T.border }}
      >
        <View style={s.ctaRow}>
          {step < 3 && (
            <TouchableOpacity style={s.draftBtn} onPress={() => saveDraft().catch(()=>{})} activeOpacity={0.72}>
              <Ionicons name="cloud-upload-outline" size={14} color={T.muted}/>
              <Text style={s.draftTxt}>Brouillon</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[s.nextBtn, saving && { opacity:0.55 }]}
            onPress={step < 3 ? goNext : publish}
            activeOpacity={0.85}
            disabled={saving}
          >
            <LinearGradient
              colors={['rgba(0,217,126,0.34)', 'rgba(0,217,126,0.18)']}
              style={s.nextGrad}
            >
              {saving ? (
                <>
                  <ActivityIndicator color={GREEN} size="small"/>
                  <Text style={s.nextTxt}>Publication…</Text>
                </>
              ) : (
                <>
                  <Text style={s.nextTxt}>
                    {step < 3 ? 'Continuer' : '🚀 Publier la mission'}
                  </Text>
                  {step < 3 && <Ionicons name="arrow-forward" size={16} color={GREEN}/>}
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  topNav:   { flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingHorizontal:EDGE, paddingVertical:12 },
  backBtn:  { width:42, height:42, borderRadius:21, alignItems:'center', justifyContent:'center', backgroundColor:T.surf, borderWidth:1, borderColor:T.border },
  navTitle: { color:T.white, fontSize:16, fontWeight:'900', letterSpacing:-0.2 },
  savedTxt: { color:'rgba(0,217,126,0.70)', fontSize:10, marginTop:2 },
  ctaRow:   { flexDirection:'row', gap:10, paddingHorizontal:EDGE, paddingVertical:14, alignItems:'center' },
  draftBtn: { flexDirection:'row', alignItems:'center', gap:5, paddingHorizontal:15, paddingVertical:13, borderRadius:14, backgroundColor:T.surf, borderWidth:StyleSheet.hairlineWidth, borderColor:T.border },
  draftTxt: { color:T.muted, fontSize:12, fontWeight:'600' },
  nextBtn:  { flex:1, borderRadius:18, overflow:'hidden', borderWidth:1.5, borderColor:T.borderHi },
  nextGrad: { flexDirection:'row', alignItems:'center', justifyContent:'center', gap:8, paddingVertical:17 },
  nextTxt:  { color:GREEN, fontSize:15, fontWeight:'900', letterSpacing:0.2 },
});