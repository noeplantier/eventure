import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { COLORS } from '@/constants/theme';
import { getEvents } from '@/lib/api';
import { authAPI } from '@/services/api';

const T = COLORS;

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR',{weekday:'short',day:'numeric',month:'short'});
}

export default function StaffFeed() {
  const router = useRouter();
  const [events, setEvents]   = useState<any[]>([]);
  const [user,   setUser]     = useState<any>(null);
  const [loading,setLoading]  = useState(true);
  const [refresh,setRefresh]  = useState(false);
  const [filter, setFilter]   = useState('all');

  const load = async () => {
    const [u, evts] = await Promise.all([authAPI.me(), getEvents()]);
    setUser(u); setEvents(evts as any[]); setLoading(false); setRefresh(false);
  };

  useEffect(() => { load(); }, []);

  const filters = [
    { key:'all',       label:'Toutes'   },
    { key:'gala',      label:'Gala'     },
    { key:'wedding',   label:'Mariage'  },
    { key:'corporate', label:'Corporate'},
    { key:'concert',   label:'Concert'  },
  ];

  const filtered = filter==='all' ? events : events.filter(e=>e.type===filter);

  return (
    <View style={s.root}>
      <LinearGradient colors={['#0D1A35','#070C17']} style={StyleSheet.absoluteFill}/>
      <SafeAreaView edges={['top']}>
        <View style={s.header}>
          <View>
            <Text style={s.hello}>Missions disponibles</Text>
            <Text style={s.sub}>{filtered.length} mission{filtered.length>1?'s':''} près de toi</Text>
          </View>
          <TouchableOpacity style={s.profileBtn} onPress={()=>router.push('/(staff)/profile' as any)}>
            <Image source={{ uri:user?.avatar_url ?? 'https://i.pravatar.cc/40' }} style={s.avatar} contentFit="cover"/>
          </TouchableOpacity>
        </View>

        {/* Filtres */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filters}>
          {filters.map(f => (
            <TouchableOpacity key={f.key} style={[s.filterPill, filter===f.key&&s.filterActive]} onPress={()=>setFilter(f.key)} activeOpacity={0.75}>
              <Text style={[s.filterTxt, filter===f.key&&s.filterTxtActive]}>{f.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </SafeAreaView>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding:20, paddingBottom:100, gap:16 }}
        refreshControl={<RefreshControl refreshing={refresh} onRefresh={()=>{setRefresh(true);load();}} tintColor={T.violet}/>}
      >
        {filtered.map((e:any) => {
          const open = (e.roles??[]).reduce((a:number,r:any)=>a+(r.slots-r.slots_filled),0);
          const rate = Math.max(...((e.roles??[]).map((r:any)=>r.hourly_rate) as number[]));
          return (
            <TouchableOpacity key={e.id} style={s.card} onPress={()=>router.push({ pathname:'/(staff)/mission/[id]', params:{id:e.id} } as any)} activeOpacity={0.88}>
              {e.cover_url && <Image source={{ uri:e.cover_url }} style={s.cardImg} contentFit="cover"/>}
              {!e.cover_url && <LinearGradient colors={['#0D1A35','#070C17']} style={s.cardImg}/>}
              <LinearGradient colors={['transparent','rgba(7,12,23,0.95)']} style={StyleSheet.absoluteFillObject}/>

              <View style={s.cardBadge}>
                <Text style={s.cardBadgeTxt}>{open} poste{open>1?'s':''} dispo</Text>
              </View>

              {e.distance_km && (
                <View style={s.distBadge}>
                  <Ionicons name="location-outline" size={10} color={T.muted}/>
                  <Text style={s.distTxt}>{e.distance_km < 1 ? '<1' : Math.round(e.distance_km)} km</Text>
                </View>
              )}

              <View style={s.cardBody}>
                <Text style={s.cardTitle} numberOfLines={2}>{e.title}</Text>
                <View style={s.cardRow}>
                  <Ionicons name="calendar-outline" size={12} color={T.violet}/>
                  <Text style={s.cardMeta}>{fmtDate(e.date_start)}</Text>
                  <Ionicons name="location-outline" size={12} color={T.violet}/>
                  <Text style={s.cardMeta} numberOfLines={1}>{e.location?.split(',')[0]}</Text>
                </View>
                <View style={s.cardRow}>
                  <Ionicons name="cash-outline" size={12} color={T.gold}/>
                  <Text style={[s.cardMeta,{color:T.gold,fontWeight:'700'}]}>jusqu'à {rate} €/h</Text>
                  {e.organizer && <Text style={s.cardMeta}>· {e.organizer.company_name}</Text>}
                </View>
                <TouchableOpacity style={s.applyBtn} onPress={()=>router.push({ pathname:'/(staff)/mission/[id]', params:{id:e.id} } as any)} activeOpacity={0.82}>
                  <LinearGradient colors={['rgba(167,139,250,0.35)','rgba(167,139,250,0.18)']} style={s.applyGrad}>
                    <Text style={s.applyTxt}>Voir la mission</Text>
                    <Ionicons name="arrow-forward" size={14} color={T.violet}/>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root:          { flex:1 },
  header:        { flexDirection:'row', justifyContent:'space-between', alignItems:'center', paddingHorizontal:20, paddingVertical:12 },
  hello:         { color:'#fff', fontSize:22, fontWeight:'900', letterSpacing:-0.4 },
  sub:           { color:'rgba(255,255,255,0.45)', fontSize:13, marginTop:2 },
  profileBtn:    { padding:2 },
  avatar:        { width:40, height:40, borderRadius:20, borderWidth:2, borderColor:'rgba(167,139,250,0.50)' },
  filters:       { paddingHorizontal:20, paddingBottom:14, gap:8 },
  filterPill:    { paddingHorizontal:16, paddingVertical:8, borderRadius:20, backgroundColor:'rgba(255,255,255,0.05)', borderWidth:StyleSheet.hairlineWidth, borderColor:'rgba(255,255,255,0.08)' },
  filterActive:  { backgroundColor:'rgba(167,139,250,0.20)', borderColor:'#A78BFA' },
  filterTxt:     { color:'rgba(255,255,255,0.50)', fontSize:13, fontWeight:'600' },
  filterTxtActive:{ color:'#A78BFA' },
  card:          { borderRadius:20, overflow:'hidden', backgroundColor:'#0D1A35', borderWidth:StyleSheet.hairlineWidth, borderColor:'rgba(167,139,250,0.20)', minHeight:280 },
  cardImg:       { position:'absolute', top:0, left:0, right:0, height:200 },
  cardBadge:     { position:'absolute', top:14, left:14, backgroundColor:'rgba(167,139,250,0.30)', paddingHorizontal:12, paddingVertical:5, borderRadius:20, borderWidth:1, borderColor:'rgba(167,139,250,0.50)' },
  cardBadgeTxt:  { color:'#A78BFA', fontSize:11, fontWeight:'800' },
  distBadge:     { position:'absolute', top:14, right:14, flexDirection:'row', alignItems:'center', gap:4, backgroundColor:'rgba(7,12,23,0.75)', paddingHorizontal:10, paddingVertical:5, borderRadius:12 },
  distTxt:       { color:'rgba(255,255,255,0.60)', fontSize:10, fontWeight:'600' },
  cardBody:      { padding:18, paddingTop:140, gap:8 },
  cardTitle:     { color:'#fff', fontSize:18, fontWeight:'900', letterSpacing:-0.3, lineHeight:24 },
  cardRow:       { flexDirection:'row', alignItems:'center', gap:6, flexWrap:'wrap' },
  cardMeta:      { color:'rgba(255,255,255,0.55)', fontSize:12, fontWeight:'500', flex:1 },
  applyBtn:      { borderRadius:14, overflow:'hidden', marginTop:4, borderWidth:1, borderColor:'rgba(167,139,250,0.40)' },
  applyGrad:     { flexDirection:'row', alignItems:'center', justifyContent:'center', gap:8, paddingVertical:14 },
  applyTxt:      { color:'#A78BFA', fontSize:14, fontWeight:'800' },
});
