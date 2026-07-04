/**
 * app/(organizer)/event/[id].tsx — EVENTURE v3
 * Détail complet d'un événement — Indigo Light (identique dashboard.tsx)
 * Sections : Cover · Infos · Description · Rôles & staffing · Équipe (missions) ·
 *            Candidatures · Notes internes · Actions (statut / suppression)
 */
import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Alert, Image, RefreshControl, ScrollView,
  StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { getCurrentOrganizerId } from '@/services/api';
import { AURA } from '@/constants/aura-theme';
import Aura from '@/components/Aura';

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

const TYPE_COLOR: Record<string,string> = {
  Gala:WARNING, Festival:SUCCESS, Conférence:BLUE, Mariage:'#EC4899',
  Séminaire:PURPLE, Soirée:WARNING, Concert:DANGER, Sport:AURA.success,
};

const STATUS_CFG: Record<string,{label:string;color:string;bg:string}> = {
  published: { label:'Actif',     color:SUCCESS,     bg:AURA.successGhost },
  draft:     { label:'Brouillon', color:WARNING,     bg:AURA.warningGhost },
  done:      { label:'Terminé',   color:C.textMuted, bg:C.surfaceAlt },
  cancelled: { label:'Annulé',    color:DANGER,      bg:AURA.dangerGhost },
};

const MISSION_CFG: Record<string,{label:string;color:string}> = {
  assigned:    { label:'Assignée',  color:BLUE },
  confirmed:   { label:'Confirmée', color:PRIMARY },
  in_progress: { label:'En cours',  color:SUCCESS },
  completed:   { label:'Terminée',  color:C.textMuted },
  cancelled:   { label:'Annulée',   color:DANGER },
};

/* ─── Types ────────────────────────────────────────────────────────────── */
interface EventRow {
  id: string; organizer_id: string; title: string; description: string | null;
  location: string; date_start: string; date_end: string; type: string | null;
  status: string; budget: number | null; cover_url: string | null; image_url: string | null;
  venue_name: string | null; max_staff: number | null; guests_count: number | null; notes: string | null;
}
interface RoleRow { id: string; role: string; slots: number; slots_filled: number; hourly_rate: number; }
interface MissionRow {
  id: string; mission_status: string; role: string | null; role_name: string | null;
  check_in: string | null; check_out: string | null;
  staff: { id: string; display_name: string; avatar_url: string | null } | null;
}

/* ─── Helpers ──────────────────────────────────────────────────────────── */
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { weekday:'short', day:'numeric', month:'long', year:'numeric' });
const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' });

/* ─── Card ─────────────────────────────────────────────────────────────── */
const Card = memo(({ title, icon, iconColor, children }: { title?: string; icon?: React.ComponentProps<typeof Ionicons>['name']; iconColor?: string; children: React.ReactNode }) => (
  <View style={s.card}>
    {title && (
      <View style={{ flexDirection:'row', alignItems:'center', gap:8, marginBottom:2 }}>
        {icon && <Ionicons name={icon} size={16} color={iconColor ?? PRIMARY}/>}
        <Text style={s.cardTitle}>{title}</Text>
      </View>
    )}
    {children}
  </View>
));

/* ─── Screen ───────────────────────────────────────────────────────────── */
export default function EventDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [event,     setEvent]     = useState<EventRow | null>(null);
  const [roles,     setRoles]     = useState<RoleRow[]>([]);
  const [missions,  setMissions]  = useState<MissionRow[]>([]);
  const [pendingApps, setPendingApps] = useState(0);
  const [loading,   setLoading]   = useState(true);
  const [refreshing,setRefreshing]= useState(false);
  const [busy,      setBusy]      = useState(false);
  const [notFound,  setNotFound]  = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!id) return;
    if (!silent) setLoading(true);
    try {
      const { data: evt, error } = await supabase.from('events').select('*').eq('id', id).single();
      if (error || !evt) { setNotFound(true); return; }
      setEvent(evt as EventRow);

      const { data: roleRows } = await supabase
        .from('event_roles').select('id,role,slots,slots_filled,hourly_rate').eq('event_id', id);
      setRoles((roleRows ?? []) as RoleRow[]);

      const { data: missionRows } = await supabase
        .from('missions')
        .select('id,mission_status,role,role_name,check_in,check_out,staff:staff_id(id,display_name,avatar_url)')
        .eq('event_id', id);
      setMissions((missionRows ?? []) as any);

      const roleIds = (roleRows ?? []).map((r: any) => r.id);
      if (roleIds.length) {
        const { count } = await supabase
          .from('applications').select('id', { count:'exact', head:true })
          .in('event_role_id', roleIds).eq('status', 'pending');
        setPendingApps(count ?? 0);
      } else {
        setPendingApps(0);
      }
    } catch (e) { console.error('[event detail]', e); }
    finally { setLoading(false); setRefreshing(false); }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // Realtime — cet événement + ses rôles/missions/candidatures
  useEffect(() => {
    if (!id) return;
    const ch = supabase.channel(`event_detail_${id}`)
      .on('postgres_changes', { event:'*', schema:'public', table:'events', filter:`id=eq.${id}` }, () => load(true))
      .on('postgres_changes', { event:'*', schema:'public', table:'event_roles', filter:`event_id=eq.${id}` }, () => load(true))
      .on('postgres_changes', { event:'*', schema:'public', table:'missions', filter:`event_id=eq.${id}` }, () => load(true))
      .on('postgres_changes', { event:'*', schema:'public', table:'applications' }, () => load(true))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id, load]);

  const totalSlots  = useMemo(() => roles.reduce((s, r) => s + (r.slots ?? 0), 0), [roles]);
  const filledSlots = useMemo(() => roles.reduce((s, r) => s + (r.slots_filled ?? 0), 0), [roles]);
  const staffingPct = totalSlots > 0 ? filledSlots / totalSlots : 0;

  const toggleStatus = useCallback(async () => {
    if (!event) return;
    const next = event.status === 'published' ? 'draft' : 'published';
    setBusy(true);
    const { error } = await supabase.from('events').update({ status: next }).eq('id', event.id);
    setBusy(false);
    if (!error) setEvent(e => e ? { ...e, status: next } : e);
  }, [event]);

  const confirmDelete = useCallback(() => {
    if (!event) return;
    Alert.alert(
      'Supprimer cet événement ?',
      `"${event.title}" et toutes ses missions/candidatures associées seront définitivement supprimés.`,
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Supprimer', style: 'destructive', onPress: async () => {
          setBusy(true);
          const { error } = await supabase.from('events').delete().eq('id', event.id);
          setBusy(false);
          if (!error) router.back();
        }},
      ],
    );
  }, [event, router]);

  const goApplications = useCallback(() => {
    router.push({ pathname: '/(organizer)/applications', params: { eventId: id } } as any);
  }, [router, id]);

  /* ── Loading / not found ── */
  if (loading) {
    return (
      <View style={{ flex:1, backgroundColor:BG, alignItems:'center', justifyContent:'center' }}>
        <ActivityIndicator color={PRIMARY} size="large"/>
      </View>
    );
  }
  if (notFound || !event) {
    return (
      <View style={{ flex:1, backgroundColor:BG }}>
        <SafeAreaView style={{ flex:1, alignItems:'center', justifyContent:'center', gap:14, paddingHorizontal:40 }}>
          <Ionicons name="alert-circle-outline" size={44} color={C.textMuted}/>
          <Text style={{ color:C.text, fontSize:16, fontWeight:'800' }}>Événement introuvable</Text>
          <TouchableOpacity onPress={() => router.back()} style={s.backChip}>
            <Text style={{ color:PRIMARY, fontWeight:'700' }}>← Retour</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </View>
    );
  }

  const tc = TYPE_COLOR[event.type ?? ''] ?? PRIMARY;
  const sv = STATUS_CFG[event.status] ?? STATUS_CFG.draft;
  const cover = event.cover_url ?? event.image_url;

  return (
    <View style={{ flex:1, backgroundColor:BG }}>
      <SafeAreaView edges={['top']} style={{ flex:1 }}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom:60 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={PRIMARY}/>}
        >
          {/* ── COVER / HEADER ── */}
          <View style={[s.hero, { backgroundColor:`${tc}14` }]}>
            {cover && <Image source={{ uri: cover }} style={StyleSheet.absoluteFillObject} resizeMode="cover"/>}
            <View style={s.heroNav}>
              <TouchableOpacity onPress={() => router.back()} style={s.navBtn} activeOpacity={0.8}>
                <Ionicons name="arrow-back" size={18} color={cover ? '#fff' : C.text}/>
              </TouchableOpacity>
              <TouchableOpacity onPress={confirmDelete} style={s.navBtn} activeOpacity={0.8} disabled={busy}>
                <Ionicons name="trash-outline" size={18} color={cover ? '#fff' : DANGER}/>
              </TouchableOpacity>
            </View>
            {!cover && (
              <View style={s.heroIconWrap}>
                <Ionicons name="calendar-outline" size={40} color={tc}/>
              </View>
            )}
            {cover && <View style={s.heroShade}/>}
          </View>

          <View style={{ paddingHorizontal:EDGE, marginTop:-24 }}>
            <View style={s.titleCard}>
              <View style={{ flexDirection:'row', gap:8 }}>
                {event.type && (
                  <View style={[s.badge, { backgroundColor:`${tc}16`, borderColor:`${tc}30` }]}>
                    <Text style={{ color:tc, fontSize:11, fontWeight:'800' }}>{event.type}</Text>
                  </View>
                )}
                <View style={[s.badge, { backgroundColor:sv.bg, borderColor:`${sv.color}30` }]}>
                  <Text style={{ color:sv.color, fontSize:11, fontWeight:'800' }}>{sv.label}</Text>
                </View>
              </View>
              <Text style={s.title}>{event.title}</Text>
            </View>
          </View>

          <View style={{ paddingHorizontal:EDGE, gap:14, marginTop:14 }}>

            {/* ── INFOS ── */}
            <Card title="Informations" icon="information-circle-outline">
              <InfoRow icon="calendar-outline" label={`${fmtDate(event.date_start)}`} sub={`${fmtTime(event.date_start)} → ${fmtTime(event.date_end)}`}/>
              <InfoRow icon="location-outline" label={event.venue_name || event.location} sub={event.venue_name ? event.location : undefined}/>
              {event.budget != null && <InfoRow icon="cash-outline" label={`${event.budget.toLocaleString('fr-FR')} € budget`}/>}
              {event.guests_count != null && <InfoRow icon="people-outline" label={`${event.guests_count} invités attendus`}/>}
              {event.max_staff != null && <InfoRow icon="person-add-outline" label={`${event.max_staff} staff max`}/>}
            </Card>

            {/* ── DESCRIPTION ── */}
            {event.description && (
              <Card title="Description" icon="document-text-outline">
                <Text style={s.body}>{event.description}</Text>
              </Card>
            )}

            {/* ── ROLES & STAFFING ── */}
            <Card title="Rôles & staffing" icon="briefcase-outline">
              <View style={{ gap:6, marginBottom:4 }}>
                <View style={{ flexDirection:'row', justifyContent:'space-between' }}>
                  <Text style={{ color:C.textSub, fontSize:12, fontWeight:'600' }}>Postes pourvus</Text>
                  <Text style={{ color:staffingPct>=1?SUCCESS:PRIMARY, fontSize:12, fontWeight:'800' }}>
                    {filledSlots}/{totalSlots} · {Math.round(staffingPct*100)}%
                  </Text>
                </View>
                <View style={{ height:6, borderRadius:3, backgroundColor:C.surfaceAlt, overflow:'hidden' }}>
                  <View style={{ width:`${staffingPct*100}%` as any, height:'100%', borderRadius:3, backgroundColor: staffingPct>=1?SUCCESS:PRIMARY }}/>
                </View>
              </View>
              {roles.length === 0 ? (
                <Text style={s.emptyTxt}>Aucun rôle défini pour cet événement.</Text>
              ) : roles.map(r => {
                const pct = r.slots > 0 ? r.slots_filled / r.slots : 0;
                const fillC = pct >= 1 ? SUCCESS : pct > 0 ? WARNING : C.textMuted;
                return (
                  <View key={r.id} style={s.roleRow}>
                    <View style={{ flex:1 }}>
                      <Text style={{ color:C.text, fontSize:13, fontWeight:'700' }}>{r.role}</Text>
                      <Text style={{ color:C.textMuted, fontSize:11 }}>{r.slots_filled}/{r.slots} poste{r.slots>1?'s':''}</Text>
                    </View>
                    <View style={[s.roleDot, { backgroundColor: fillC }]}/>
                    <Text style={{ color:WARNING, fontSize:13, fontWeight:'900' }}>{r.hourly_rate}€/h</Text>
                  </View>
                );
              })}
            </Card>

            {/* ── CANDIDATURES ── */}
            <Aura color={pendingApps>0?AURA.warningGlow:AURA.primaryGlow} radius={18} onPress={goApplications}>
              <Card>
                <View style={{ flexDirection:'row', alignItems:'center', gap:12 }}>
                  <View style={[s.iconWrap, { backgroundColor: pendingApps>0?AURA.warningGhost:P_GHOST }]}>
                    <Ionicons name="mail-unread-outline" size={18} color={pendingApps>0?WARNING:PRIMARY}/>
                  </View>
                  <View style={{ flex:1 }}>
                    <Text style={{ color:C.text, fontSize:14, fontWeight:'800' }}>Candidatures</Text>
                    <Text style={{ color:C.textSub, fontSize:12 }}>
                      {pendingApps>0 ? `${pendingApps} en attente de réponse` : 'Aucune en attente'}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={C.textMuted}/>
                </View>
              </Card>
            </Aura>

            {/* ── ÉQUIPE (MISSIONS) ── */}
            <Card title="Équipe assignée" icon="people-circle-outline">
              {missions.length === 0 ? (
                <Text style={s.emptyTxt}>Personne n'est encore assigné à cet événement.</Text>
              ) : missions.map(m => {
                const cfg = MISSION_CFG[m.mission_status] ?? MISSION_CFG.assigned;
                const init = (m.staff?.display_name ?? '?').trim().split(' ').map(n=>n[0]).join('').toUpperCase().slice(0,2);
                return (
                  <View key={m.id} style={s.staffRow}>
                    {m.staff?.avatar_url
                      ? <Image source={{ uri:m.staff.avatar_url }} style={s.avatar}/>
                      : <View style={[s.avatar, s.avatarFb]}><Text style={{ color:PRIMARY, fontWeight:'800', fontSize:13 }}>{init}</Text></View>}
                    <View style={{ flex:1 }}>
                      <Text style={{ color:C.text, fontSize:13, fontWeight:'700' }}>{m.staff?.display_name ?? 'Non assigné'}</Text>
                      <Text style={{ color:C.textMuted, fontSize:11 }}>{m.role_name ?? m.role ?? '—'}</Text>
                    </View>
                    <View style={[s.badge, { backgroundColor:`${cfg.color}16`, borderColor:`${cfg.color}30` }]}>
                      <Text style={{ color:cfg.color, fontSize:10, fontWeight:'800' }}>{cfg.label}</Text>
                    </View>
                  </View>
                );
              })}
            </Card>

            {/* ── NOTES INTERNES ── */}
            {event.notes && (
              <Card title="Notes internes" icon="lock-closed-outline" iconColor={C.textMuted}>
                <Text style={[s.body, { fontStyle:'italic', color:C.textSub }]}>{event.notes}</Text>
              </Card>
            )}

            {/* ── ACTIONS ── */}
            <View style={{ gap:10, marginTop:4 }}>
              <Aura color={event.status==='published' ? AURA.primaryGlow : AURA.primaryGlow} radius={16} onPress={toggleStatus} disabled={busy}>
                <View style={[s.actionBtn, { backgroundColor: event.status==='published' ? C.surfaceAlt : PRIMARY, borderWidth: event.status==='published'?1:0, borderColor:C.border }]}>
                  {busy ? <ActivityIndicator color={event.status==='published'?C.text:'#fff'}/> : (
                    <>
                      <Ionicons name={event.status==='published' ? 'eye-off-outline' : 'rocket-outline'} size={18} color={event.status==='published'?C.text:'#fff'}/>
                      <Text style={{ color:event.status==='published'?C.text:'#fff', fontWeight:'800', fontSize:15 }}>
                        {event.status==='published' ? 'Repasser en brouillon' : 'Publier l\'événement'}
                      </Text>
                    </>
                  )}
                </View>
              </Aura>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

/* ─── Info Row ─────────────────────────────────────────────────────────── */
const InfoRow = memo(({ icon, label, sub }: { icon: React.ComponentProps<typeof Ionicons>['name']; label: string; sub?: string }) => (
  <View style={{ flexDirection:'row', alignItems:'flex-start', gap:10 }}>
    <Ionicons name={icon} size={16} color={C.textSub} style={{ marginTop:1 }}/>
    <View style={{ flex:1 }}>
      <Text style={{ color:C.text, fontSize:13, fontWeight:'600' }}>{label}</Text>
      {sub && <Text style={{ color:C.textMuted, fontSize:11, marginTop:1 }}>{sub}</Text>}
    </View>
  </View>
));

/* ─── Styles ───────────────────────────────────────────────────────────── */
const s = StyleSheet.create({
  hero: { height:200, overflow:'hidden' },
  heroNav: { position:'absolute', top:12, left:12, right:12, flexDirection:'row', justifyContent:'space-between', zIndex:2 },
  navBtn: { width:38, height:38, borderRadius:12, alignItems:'center', justifyContent:'center', backgroundColor:'rgba(17,24,39,0.35)' },
  heroIconWrap: { flex:1, alignItems:'center', justifyContent:'center' },
  heroShade: { position:'absolute', bottom:0, left:0, right:0, height:80, backgroundColor:'rgba(17,24,39,0.25)' },
  titleCard: { backgroundColor:C.surface, borderRadius:20, padding:18, gap:10, borderWidth:1, borderColor:C.border },
  title: { color:C.text, fontSize:20, fontWeight:'900', letterSpacing:-0.4, lineHeight:26 },
  badge: { paddingHorizontal:10, paddingVertical:4, borderRadius:8, borderWidth:1, alignSelf:'flex-start' },
  card: { backgroundColor:C.surface, borderRadius:18, padding:16, gap:12, borderWidth:1, borderColor:C.border },
  cardTitle: { color:C.text, fontSize:14, fontWeight:'900', letterSpacing:-0.2 },
  body: { color:C.textSub, fontSize:13, lineHeight:20 },
  emptyTxt: { color:C.textMuted, fontSize:12, fontStyle:'italic' },
  roleRow: { flexDirection:'row', alignItems:'center', gap:10, paddingVertical:8, borderTopWidth:1, borderTopColor:C.surfaceAlt },
  roleDot: { width:8, height:8, borderRadius:4 },
  iconWrap: { width:40, height:40, borderRadius:12, alignItems:'center', justifyContent:'center' },
  staffRow: { flexDirection:'row', alignItems:'center', gap:10, paddingVertical:8, borderTopWidth:1, borderTopColor:C.surfaceAlt },
  avatar: { width:38, height:38, borderRadius:12, backgroundColor:C.surfaceAlt },
  avatarFb: { alignItems:'center', justifyContent:'center', backgroundColor:P_LIGHT },
  actionBtn: { flexDirection:'row', alignItems:'center', justifyContent:'center', gap:10, height:54, borderRadius:16 },
  backChip: { paddingHorizontal:20, paddingVertical:12, borderRadius:14, backgroundColor:P_GHOST },
});
