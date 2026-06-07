import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { COLORS } from '@/constants/theme';
import { getEvents, getOrganizerStats, getCurrentUser } from '@/lib/api';

const T = COLORS;

export default function Dashboard() {
  const router = useRouter();
  const [events,     setEvents]     = useState<any[]>([]);
  const [stats,      setStats]      = useState({ active:0, pending:0, hired:0, revenue:0 });
  const [user,       setUser]       = useState<any>(null);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab,        setTab]        = useState<'published'|'draft'|'done'>('published');

  const load = async () => {
    const [u, evts, st] = await Promise.all([
      getCurrentUser(),
      getEvents(),
      getOrganizerStats(''),
    ]);
    setUser(u);
    setEvents(evts as any[]);
    setStats(st as any);
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = events.filter(e => e.status === tab);

  const STATUS_COLOR: Record<string,string> = {
    published: T.green, draft: T.amber, done: T.muted, closed: T.faint,
  };

  return (
    <View style={s.root}>
      <LinearGradient colors={['#0D1A35','#070C17']} style={StyleSheet.absoluteFill}/>
      <SafeAreaView edges={['top']}>
        <View style={s.nav}>
          <View>
            <Text style={s.greeting}>Bonjour 👋</Text>
            <Text style={s.name}>{user?.display_name ?? '…'}</Text>
          </View>
          <TouchableOpacity style={s.createBtn} onPress={()=>router.push('/(organizer)/create-event' as any)} activeOpacity={0.82}>
            <LinearGradient colors={['rgba(167,139,250,0.35)','rgba(167,139,250,0.18)']} style={s.createGrad}>
              <Ionicons name="add" size={18} color={T.violet}/>
              <Text style={s.createTxt}>Créer</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom:100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>{setRefreshing(true);load();}} tintColor={T.violet}/>}
      >
        {/* Stats */}
        <View style={s.statsGrid}>
          {[
            { icon:'calendar-outline',l:'Actives',    v:String(stats.active),  c:T.violet },
            { icon:'time-outline',    l:'En attente', v:String(stats.pending), c:T.amber  },
            { icon:'people-outline',  l:'Recrutés',   v:String(stats.hired),   c:T.green  },
            { icon:'cash-outline',    l:'Budget',     v:`${(stats.revenue/1000).toFixed(0)}K€`, c:T.gold },
          ].map(({ icon, l, v, c }) => (
            <View key={l} style={[s.statCard, { borderColor:`${c}28` }]}>
              <Ionicons name={icon as any} size={18} color={c}/>
              <Text style={[s.statVal, { color:c }]}>{v}</Text>
              <Text style={s.statLabel}>{l}</Text>
            </View>
          ))}
        </View>

        {/* Tabs */}
        <View style={s.tabs}>
          {(['published','draft','done'] as const).map(k => (
            <TouchableOpacity key={k} style={[s.tab, tab===k&&s.tabActive]} onPress={()=>setTab(k)} activeOpacity={0.75}>
              <Text style={[s.tabTxt, tab===k&&s.tabTxtActive]}>
                {k==='published'?'En ligne':k==='draft'?'Brouillons':'Terminées'}
                {` (${events.filter(e=>e.status===k).length})`}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Events */}
        <View style={s.list}>
          {loading ? (
            <ActivityIndicator color={T.violet} size="large" style={{marginTop:40}}/>
          ) : filtered.length === 0 ? (
            <View style={s.empty}>
              <Ionicons name="calendar-outline" size={40} color={T.faint}/>
              <Text style={s.emptyTxt}>Aucune mission {tab==='published'?'active':tab==='draft'?'en brouillon':'terminée'}</Text>
              {tab==='published'&&<TouchableOpacity style={s.emptyBtn} onPress={()=>router.push('/(organizer)/create-event' as any)}>
                <Text style={s.emptyBtnTxt}>+ Créer ma première mission</Text>
              </TouchableOpacity>}
            </View>
          ) : filtered.map((e: any) => (
            <TouchableOpacity key={e.id} style={s.eventCard} onPress={()=>router.push({ pathname:'/(organizer)/event/[id]', params:{id:e.id} } as any)} activeOpacity={0.85}>
              <View style={s.eventTop}>
                <View style={[s.eventDot, { backgroundColor: STATUS_COLOR[e.status]??T.muted }]}/>
                <Text style={s.eventTitle} numberOfLines={1}>{e.title}</Text>
                <Ionicons name="chevron-forward" size={14} color={T.faint}/>
              </View>
              <Text style={s.eventMeta}>
                {new Date(e.date_start).toLocaleDateString('fr-FR',{day:'numeric',month:'short'})}
                {'  ·  '}{e.location?.split(',')[0]}
              </Text>
              <View style={s.eventRoles}>
                {(e.roles??[]).map((r:any) => (
                  <View key={r.id} style={s.rolePill}>
                    <Text style={s.rolePillTxt}>{r.role} · {r.slots_filled}/{r.slots}</Text>
                  </View>
                ))}
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root:       { flex:1 },
  nav:        { flexDirection:'row', justifyContent:'space-between', alignItems:'center', paddingHorizontal:20, paddingVertical:14 },
  greeting:   { color:'rgba(255,255,255,0.50)', fontSize:13 },
  name:       { color:'#fff', fontSize:20, fontWeight:'900', letterSpacing:-0.3 },
  createBtn:  { borderRadius:16, overflow:'hidden', borderWidth:1, borderColor:'rgba(167,139,250,0.35)' },
  createGrad: { flexDirection:'row', alignItems:'center', gap:6, paddingHorizontal:16, paddingVertical:10 },
  createTxt:  { color:'#A78BFA', fontSize:14, fontWeight:'800' },
  statsGrid:  { flexDirection:'row', flexWrap:'wrap', gap:10, paddingHorizontal:20, paddingBottom:16 },
  statCard:   { width:'47%', backgroundColor:'rgba(255,255,255,0.05)', borderRadius:16, padding:14, gap:8, alignItems:'center', borderWidth:StyleSheet.hairlineWidth },
  statVal:    { fontSize:24, fontWeight:'900', letterSpacing:-0.5 },
  statLabel:  { color:'rgba(255,255,255,0.40)', fontSize:10, fontWeight:'600', textTransform:'uppercase', letterSpacing:0.5 },
  tabs:       { flexDirection:'row', paddingHorizontal:20, gap:8, marginBottom:16 },
  tab:        { paddingHorizontal:14, paddingVertical:8, borderRadius:20, backgroundColor:'rgba(255,255,255,0.05)', borderWidth:StyleSheet.hairlineWidth, borderColor:'rgba(255,255,255,0.08)' },
  tabActive:  { backgroundColor:'rgba(167,139,250,0.18)', borderColor:'#A78BFA' },
  tabTxt:     { color:'rgba(255,255,255,0.50)', fontSize:12, fontWeight:'600' },
  tabTxtActive:{ color:'#A78BFA' },
  list:       { paddingHorizontal:20 },
  eventCard:  { backgroundColor:'rgba(255,255,255,0.05)', borderRadius:18, padding:16, marginBottom:12, borderWidth:StyleSheet.hairlineWidth, borderColor:'rgba(167,139,250,0.18)', gap:8 },
  eventTop:   { flexDirection:'row', alignItems:'center', gap:8 },
  eventDot:   { width:8, height:8, borderRadius:4 },
  eventTitle: { flex:1, color:'#fff', fontSize:15, fontWeight:'800' },
  eventMeta:  { color:'rgba(255,255,255,0.45)', fontSize:12 },
  eventRoles: { flexDirection:'row', flexWrap:'wrap', gap:6 },
  rolePill:   { backgroundColor:'rgba(167,139,250,0.15)', borderRadius:10, paddingHorizontal:10, paddingVertical:4 },
  rolePillTxt:{ color:'#A78BFA', fontSize:11, fontWeight:'600' },
  empty:      { alignItems:'center', paddingVertical:48, gap:12 },
  emptyTxt:   { color:'rgba(255,255,255,0.40)', fontSize:15, textAlign:'center' },
  emptyBtn:   { backgroundColor:'rgba(167,139,250,0.15)', borderRadius:14, paddingHorizontal:20, paddingVertical:12, borderWidth:1, borderColor:'rgba(167,139,250,0.35)' },
  emptyBtnTxt:{ color:'#A78BFA', fontSize:13, fontWeight:'700' },
});
