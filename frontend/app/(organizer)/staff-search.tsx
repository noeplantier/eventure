/**
 * app/(organizer)/staff-search.tsx — EVENTURE v2
 * 100 % Supabase · Full-text search · Pagination · Realtime dispo · Animations
 */
import React, {
  memo, useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import {
  ActivityIndicator, Animated, Dimensions, Easing, FlatList,
  Image, Modal, Platform, RefreshControl, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons }       from '@expo/vector-icons';
import { SafeAreaView }   from 'react-native-safe-area-context';
import { useRouter }      from 'expo-router';
import { supabase }       from '@/lib/supabase';

const { width: SW } = Dimensions.get('window');
const BG = '#020A06'; const GREEN = '#00D97E'; const GOLD = '#F5C842';
const T = {
  white:'#FFFFFF', muted:'rgba(255,255,255,0.50)', faint:'rgba(255,255,255,0.18)',
  surf:'rgba(255,255,255,0.05)', surfHi:'rgba(255,255,255,0.09)',
  border:'rgba(0,217,126,0.12)', borderHi:'rgba(0,217,126,0.30)',
  greenDim:'rgba(0,217,126,0.12)', goldDim:'rgba(245,200,66,0.12)',
  navy:'#0A2218', amber:'#F59E0B', red:'#EF4444',
} as const;
const EDGE = 20; const PAGE = 15;

// ─── Types ────────────────────────────────────────────────────────────────────
interface StaffProfile {
  id:string; display_name:string; avatar_url:string|null;
  role:string[]; hourly_rate:number; rating:number;
  missions_count:number; location:string; is_available:boolean;
  bio:string|null; experience_years:number|null; verified:boolean;
}

// ─── Particle Background ──────────────────────────────────────────────────────
const PCOLS=['#00D97E','rgba(0,217,126,0.45)','#F5C842','rgba(245,200,66,0.38)','rgba(255,255,255,0.22)'];
const rnd=(a:number,b:number)=>a+Math.random()*(b-a);
const STATIC_PTS=Array.from({length:18},(_,i)=>({id:i,x:rnd(0,SW),y:rnd(0,700),sz:rnd(1,3),col:PCOLS[i%PCOLS.length],op:0.06+i%6*0.04}));
const ParticleBg=memo(()=>(
  <View style={StyleSheet.absoluteFill} pointerEvents="none">
    <LinearGradient colors={[BG,'#051A0E',BG]} style={StyleSheet.absoluteFill}/>
    <View style={{position:'absolute',top:'12%',left:'18%',width:SW*.64,height:SW*.64,borderRadius:SW*.32,backgroundColor:'rgba(0,217,126,0.04)'}}/>
    <View style={{position:'absolute',bottom:'8%',right:'-12%',width:SW*.55,height:SW*.55,borderRadius:SW*.27,backgroundColor:'rgba(245,200,66,0.03)'}}/>
    {STATIC_PTS.map(p=><View key={p.id} style={{position:'absolute',left:p.x,top:p.y,width:p.sz,height:p.sz,borderRadius:p.sz/2,backgroundColor:p.col,opacity:p.op}}/>)}
  </View>
));

// ─── Constants ────────────────────────────────────────────────────────────────
const ROLE_FILTERS = [
  'Tous','Serveur·se','Barman / Barmaid','Agent de sécurité',
  "Hôte·sse d'accueil",'Coordinateur·rice','Runner',
  'Photographe','Vidéaste','Sommelier·ère',
];
const SORT_OPTIONS = [
  {k:'rating',    l:'Mieux notés', icon:'star-outline'          as const},
  {k:'rate_asc',  l:'Prix ↑',      icon:'trending-up-outline'   as const},
  {k:'rate_desc', l:'Prix ↓',      icon:'trending-down-outline' as const},
  {k:'missions',  l:'Expérience',  icon:'briefcase-outline'     as const},
];
const AVAIL_FILTERS = [{k:null,l:'Tous'},{k:true,l:'Disponibles'},{k:false,l:'Indisponibles'}];

// ─── Staff Card ───────────────────────────────────────────────────────────────
const StaffCard = memo(function StaffCard({
  s, index, onInvite, onChat, onProfile,
}:{s:StaffProfile;index:number;onInvite:()=>void;onChat:()=>void;onProfile:()=>void;}) {
  const [imgErr,setImgErr] = useState(false);
  const anim    = useRef(new Animated.Value(0)).current;
  const pressAnim = useRef(new Animated.Value(1)).current;

  useEffect(()=>{
    Animated.timing(anim,{toValue:1,duration:300,delay:index*60,easing:Easing.out(Easing.cubic),useNativeDriver:true}).start();
  },[index]);

  const onPressIn  = ()=>Animated.spring(pressAnim,{toValue:.97,tension:300,friction:8,useNativeDriver:true}).start();
  const onPressOut = ()=>Animated.spring(pressAnim,{toValue:1,tension:200,friction:8,useNativeDriver:true}).start();

  const stars     = Math.round(s.rating);
  const roles     = Array.isArray(s.role)?s.role:[];
  const primary   = roles[0]??'—';
  const secondary = roles.slice(1,3);
  const initials  = s.display_name.trim().split(' ').map(n=>n[0]).join('').toUpperCase().slice(0,2);

  return(
    <Animated.View style={{opacity:anim,transform:[{translateY:anim.interpolate({inputRange:[0,1],outputRange:[20,0]}),scale:pressAnim}]}}>
      <TouchableOpacity
        style={sc.card}
        onPress={onProfile}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        activeOpacity={1}
      >
        <LinearGradient colors={['rgba(0,217,126,0.07)','rgba(0,217,126,0.02)']} style={StyleSheet.absoluteFillObject}/>

        <View style={sc.header}>
          {/* Avatar */}
          <TouchableOpacity onPress={onProfile} activeOpacity={0.85}>
            <View style={sc.avatarWrap}>
              {s.avatar_url&&!imgErr
                ?<Image source={{uri:s.avatar_url}} style={sc.avatar} resizeMode="cover" onError={()=>setImgErr(true)}/>
                :<View style={[sc.avatar,sc.avatarFb]}><Text style={sc.initials}>{initials}</Text></View>
              }
              <View style={[sc.availDot,{backgroundColor:s.is_available?GREEN:T.amber}]}/>
            </View>
          </TouchableOpacity>

          {/* Info principale */}
          <View style={sc.mainInfo}>
            <View style={{flexDirection:'row',alignItems:'center',gap:6,flexWrap:'wrap'}}>
              <Text style={sc.name} numberOfLines={1}>{s.display_name}</Text>
              {s.verified&&<Ionicons name="shield-checkmark" size={13} color={GREEN}/>}
              {s.is_available
                ?<View style={sc.availBadge}><View style={{width:5,height:5,borderRadius:2.5,backgroundColor:GREEN}}/><Text style={sc.availTxt}>Dispo</Text></View>
                :<View style={sc.unavailBadge}><Text style={sc.unavailTxt}>Occupé</Text></View>
              }
            </View>
            <Text style={sc.primary}>{primary}</Text>
            {s.location&&(
              <View style={{flexDirection:'row',alignItems:'center',gap:4,marginTop:1}}>
                <Ionicons name="location-outline" size={10} color={T.muted}/>
                <Text style={sc.location} numberOfLines={1}>{s.location}</Text>
              </View>
            )}
            <View style={{flexDirection:'row',alignItems:'center',gap:8,marginTop:4}}>
              <View style={{flexDirection:'row',gap:1.5}}>
                {[1,2,3,4,5].map(i=><Ionicons key={i} name={i<=stars?'star':'star-outline'} size={11} color={i<=stars?GOLD:T.faint}/>)}
              </View>
              <Text style={{color:GOLD,fontSize:11,fontWeight:'800'}}>{s.rating.toFixed(1)}</Text>
              <Text style={{color:T.faint,fontSize:10}}>·</Text>
              <Text style={{color:T.muted,fontSize:10}}>{s.missions_count} mission{s.missions_count>1?'s':''}</Text>
              {s.experience_years!=null&&s.experience_years>0&&(
                <><Text style={{color:T.faint,fontSize:10}}>·</Text>
                <Text style={{color:T.muted,fontSize:10}}>{s.experience_years}ans</Text></>
              )}
            </View>
          </View>

          {/* Tarif */}
          <View style={sc.rateBlock}>
            <Text style={sc.rate}>{s.hourly_rate}€</Text>
            <Text style={sc.rateLabel}>/h</Text>
          </View>
        </View>

        {/* Roles secondaires + bio */}
        <View style={{gap:6}}>
          {secondary.length>0&&(
            <View style={{flexDirection:'row',gap:6,flexWrap:'wrap'}}>
              {secondary.map(r=>(
                <View key={r} style={sc.rolePill}><Text style={sc.roleTxt}>{r}</Text></View>
              ))}
              {roles.length>3&&<View style={sc.rolePill}><Text style={sc.roleTxt}>+{roles.length-3}</Text></View>}
            </View>
          )}
          {s.bio&&<Text style={sc.bio} numberOfLines={2}>{s.bio}</Text>}
        </View>

        {/* Actions */}
        <View style={sc.actions}>
          <TouchableOpacity style={sc.chatBtn} onPress={onChat} activeOpacity={0.78}>
            <Ionicons name="chatbubble-outline" size={14} color={T.muted}/>
            <Text style={sc.chatTxt}>Message</Text>
          </TouchableOpacity>
          <TouchableOpacity style={sc.inviteBtn} onPress={onInvite} activeOpacity={0.82}>
            <LinearGradient colors={['rgba(0,217,126,0.28)','rgba(0,217,126,0.14)']} style={sc.inviteGrad}>
              <Ionicons name="send-outline" size={13} color={GREEN}/>
              <Text style={sc.inviteTxt}>Inviter à une mission</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        <View style={{position:'absolute',top:0,left:0,right:0,bottom:0,borderRadius:20,borderWidth:StyleSheet.hairlineWidth,borderColor:T.border}} pointerEvents="none"/>
      </TouchableOpacity>
    </Animated.View>
  );
});
const sc=StyleSheet.create({
  card:        {borderRadius:20,overflow:'hidden',marginBottom:14,padding:16,gap:12,backgroundColor:T.navy},
  header:      {flexDirection:'row',alignItems:'flex-start',gap:13},
  avatarWrap:  {position:'relative'},
  avatar:      {width:62,height:62,borderRadius:31,backgroundColor:T.navy},
  avatarFb:    {alignItems:'center',justifyContent:'center',borderWidth:1.5,borderColor:T.border,backgroundColor:'rgba(0,217,126,0.08)'},
  initials:    {color:GREEN,fontSize:20,fontWeight:'900'},
  availDot:    {position:'absolute',bottom:1,right:1,width:13,height:13,borderRadius:6.5,borderWidth:2.5,borderColor:BG},
  availBadge:  {flexDirection:'row',alignItems:'center',gap:4,paddingHorizontal:7,paddingVertical:3,borderRadius:10,backgroundColor:'rgba(0,217,126,0.15)',borderWidth:StyleSheet.hairlineWidth,borderColor:T.borderHi},
  availTxt:    {color:GREEN,fontSize:8,fontWeight:'800'},
  unavailBadge:{paddingHorizontal:7,paddingVertical:3,borderRadius:10,backgroundColor:'rgba(245,158,11,0.12)'},
  unavailTxt:  {color:T.amber,fontSize:8,fontWeight:'700'},
  mainInfo:    {flex:1,gap:2},
  name:        {color:T.white,fontSize:16,fontWeight:'900',letterSpacing:-0.3,flexShrink:1},
  primary:     {color:GREEN,fontSize:11,fontWeight:'700'},
  location:    {color:T.muted,fontSize:10},
  rateBlock:   {alignItems:'flex-end',gap:1},
  rate:        {color:GOLD,fontSize:22,fontWeight:'900',letterSpacing:-0.5},
  rateLabel:   {color:T.muted,fontSize:10},
  rolePill:    {paddingHorizontal:9,paddingVertical:4,borderRadius:18,backgroundColor:'rgba(0,217,126,0.09)',borderWidth:StyleSheet.hairlineWidth,borderColor:T.border},
  roleTxt:     {color:GREEN,fontSize:10,fontWeight:'600'},
  bio:         {color:T.muted,fontSize:11,lineHeight:15,fontStyle:'italic'},
  actions:     {flexDirection:'row',gap:10,marginTop:2},
  chatBtn:     {flexDirection:'row',alignItems:'center',gap:6,paddingHorizontal:14,paddingVertical:10,borderRadius:13,backgroundColor:T.surf,borderWidth:StyleSheet.hairlineWidth,borderColor:T.border},
  chatTxt:     {color:T.muted,fontSize:12,fontWeight:'600'},
  inviteBtn:   {flex:1,borderRadius:13,overflow:'hidden',borderWidth:1,borderColor:'rgba(0,217,126,0.28)'},
  inviteGrad:  {flexDirection:'row',alignItems:'center',justifyContent:'center',gap:7,paddingVertical:10},
  inviteTxt:   {color:GREEN,fontSize:12,fontWeight:'800'},
});

// ─── Sort Modal ───────────────────────────────────────────────────────────────
const SortModal=memo(function SortModal({visible,sort,onSelect,onClose}:{visible:boolean;sort:string;onSelect:(k:string)=>void;onClose:()=>void}){
  const anim=useRef(new Animated.Value(0)).current;
  useEffect(()=>{Animated.spring(anim,{toValue:visible?1:0,tension:80,friction:12,useNativeDriver:true}).start();},[visible]);
  if(!visible) return null;
  return(
    <TouchableOpacity style={{...StyleSheet.absoluteFillObject,zIndex:200}} onPress={onClose} activeOpacity={1}>
      <Animated.View style={{position:'absolute',top:160,right:EDGE,borderRadius:16,overflow:'hidden',width:200,transform:[{scale:anim.interpolate({inputRange:[0,1],outputRange:[.9,1]})}],opacity:anim}}>
        <LinearGradient colors={['#0A2218','#051A0E']} style={{borderWidth:1,borderColor:T.border,borderRadius:16}}>
          {SORT_OPTIONS.map((o,i)=>(
            <TouchableOpacity key={o.k} style={{flexDirection:'row',alignItems:'center',gap:10,paddingHorizontal:16,paddingVertical:13,borderBottomWidth:i<SORT_OPTIONS.length-1?StyleSheet.hairlineWidth:0,borderBottomColor:T.border,backgroundColor:sort===o.k?T.greenDim:'transparent'}} onPress={()=>{onSelect(o.k);onClose();}}>
              <Ionicons name={o.icon} size={14} color={sort===o.k?GREEN:T.muted}/>
              <Text style={{color:sort===o.k?GREEN:T.muted,fontSize:13,fontWeight:sort===o.k?'800':'500',flex:1}}>{o.l}</Text>
              {sort===o.k&&<Ionicons name="checkmark" size={13} color={GREEN}/>}
            </TouchableOpacity>
          ))}
        </LinearGradient>
      </Animated.View>
    </TouchableOpacity>
  );
});

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function StaffSearchScreen() {
  const router = useRouter();
  const [staff,      setStaff]      = useState<StaffProfile[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [loadingMore,setLoadingMore]= useState(false);
  const [refresh,    setRefresh]    = useState(false);
  const [hasMore,    setHasMore]    = useState(true);
  const [query,      setQuery]      = useState('');
  const [role,       setRole]       = useState('Tous');
  const [sort,       setSort]       = useState('rating');
  const [avail,      setAvail]      = useState<boolean|null>(null);
  const [rateMax,    setRateMax]    = useState<number|null>(null);
  const [showSort,   setShowSort]   = useState(false);
  const [page,       setPage]       = useState(0);
  const queryTimeout = useRef<ReturnType<typeof setTimeout>|null>(null);
  const rtRef        = useRef<ReturnType<typeof supabase.channel>|null>(null);

  // ── Build Supabase query ───────────────────────────────────────────────────
  const buildQuery = useCallback((offset:number, searchQ:string, roleF:string, sortF:string, availF:boolean|null, rateF:number|null)=>{
    let q = supabase.from('staff').select(
      'id,display_name,avatar_url,role,hourly_rate,rating,missions_count,location,is_available,bio,experience_years,verified',
      {count:'exact'}
    );
    // Full-text search
    if(searchQ.trim()) {
      q = q.textSearch('search_vector', searchQ.trim().split(' ').map(w=>w+':*').join(' & '), {type:'websearch',config:'french'});
    }
    // Role filter (array contains)
    if(roleF!=='Tous') q = q.contains('role', [roleF]);
    // Availability
    if(availF!==null) q = q.eq('is_available', availF);
    // Rate max
    if(rateF) q = q.lte('hourly_rate', rateF);
    // Sort
    if(sortF==='rating')    q = q.order('rating',        {ascending:false});
    if(sortF==='rate_asc')  q = q.order('hourly_rate',   {ascending:true});
    if(sortF==='rate_desc') q = q.order('hourly_rate',   {ascending:false});
    if(sortF==='missions')  q = q.order('missions_count',{ascending:false});
    // Pagination
    q = q.range(offset, offset+PAGE-1);
    return q;
  },[]);

  const load = useCallback(async(reset=false)=>{
    const offset = reset ? 0 : page*PAGE;
    if(reset){setLoading(true);setPage(0);setStaff([]);}
    try{
      const {data,error,count} = await buildQuery(offset,query,role,sort,avail,rateMax);
      if(error) throw error;
      const items=(data??[]) as StaffProfile[];
      setStaff(prev=>reset?items:[...prev,...items]);
      setHasMore((count??0)>(offset+PAGE));
      if(!reset) setPage(p=>p+1);
    }catch(e){console.error('[staff-search]',e);}
    finally{setLoading(false);setRefresh(false);setLoadingMore(false);}
  },[page,query,role,sort,avail,rateMax,buildQuery]);

  // Debounced search
  useEffect(()=>{
    if(queryTimeout.current) clearTimeout(queryTimeout.current);
    queryTimeout.current=setTimeout(()=>load(true),400);
    return()=>{if(queryTimeout.current)clearTimeout(queryTimeout.current);};
  },[query]);

  // Re-fetch on filter change
  useEffect(()=>{load(true);},[role,sort,avail,rateMax]);

  // Realtime : staff availability changes
  useEffect(()=>{
    let ch:ReturnType<typeof supabase.channel>|null=null;let mounted=true;
    ch=supabase.channel('staff_availability')
      .on('postgres_changes',{event:'UPDATE',schema:'public',table:'staff',filter:'is_available=eq.true'},
        ({new:row})=>{if(!mounted)return;setStaff(prev=>prev.map(s=>s.id===(row as any).id?{...s,...(row as any)}:s));})
      .subscribe();
    return()=>{mounted=false;if(ch)supabase.removeChannel(ch);};
  },[]);

  const loadMore=useCallback(()=>{
    if(loadingMore||!hasMore||loading) return;
    setLoadingMore(true);
    load(false);
  },[loadingMore,hasMore,loading,load]);

  const handleInvite=(s:StaffProfile)=>router.push({pathname:'/(organizer)/create-event',params:{inviteStaffId:s.id,inviteStaffName:s.display_name}} as any);
  const handleChat  =(s:StaffProfile)=>router.push({pathname:'/(shared)/chat/[id]',params:{id:s.id,name:s.display_name}} as any);
  const handleProfile=(s:StaffProfile)=>router.push({pathname:'/(staff)/profile',params:{id:s.id}} as any);

  const renderItem=useCallback(({item,index}:{item:StaffProfile;index:number})=>(
    <StaffCard s={item} index={index} onInvite={()=>handleInvite(item)} onChat={()=>handleChat(item)} onProfile={()=>handleProfile(item)}/>
  ),[]);

  const availCount = useMemo(()=>staff.filter(s=>s.is_available).length,[staff]);
  const sortLabel  = SORT_OPTIONS.find(o=>o.k===sort)?.l??'Trier';

  return(
    <View style={{flex:1,backgroundColor:BG}}>
      <ParticleBg/>
      {showSort&&<SortModal visible={showSort} sort={sort} onSelect={setSort} onClose={()=>setShowSort(false)}/>}

      <SafeAreaView edges={['top']}>
        {/* Header */}
        <View style={s.header}>
          <View style={{flex:1}}>
            <Text style={s.title}>Catalogue Talents</Text>
            <Text style={s.sub}>
              {loading?'Chargement…':`${availCount} dispo · ${staff.length} profils`}
            </Text>
          </View>
          <TouchableOpacity style={[s.sortBtn,showSort&&s.sortBtnActive]} onPress={()=>setShowSort(v=>!v)} activeOpacity={0.75}>
            <Ionicons name="options-outline" size={14} color={showSort?GREEN:T.muted}/>
            <Text style={[s.sortTxt,showSort&&{color:GREEN}]}>{sortLabel}</Text>
          </TouchableOpacity>
        </View>

        {/* Search */}
        <View style={s.searchWrap}>
          <Ionicons name="search-outline" size={16} color={T.muted}/>
          <TextInput
            style={s.searchInput}
            placeholder="Rechercher par nom, rôle, ville…"
            placeholderTextColor={T.faint}
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
            autoCorrect={false}
          />
          {query.length>0&&(
            <TouchableOpacity onPress={()=>setQuery('')} hitSlop={10}>
              <Ionicons name="close-circle" size={16} color={T.muted}/>
            </TouchableOpacity>
          )}
        </View>

        {/* Availability filter */}
        <View style={{flexDirection:'row',gap:7,paddingHorizontal:EDGE,marginBottom:8}}>
          {AVAIL_FILTERS.map(f=>(
            <TouchableOpacity key={String(f.k)} style={[s.availPill,avail===f.k&&s.availPillActive]} onPress={()=>setAvail(f.k)} activeOpacity={0.75}>
              {f.k===true&&<View style={{width:7,height:7,borderRadius:3.5,backgroundColor:GREEN}}/>}
              {f.k===false&&<View style={{width:7,height:7,borderRadius:3.5,backgroundColor:T.amber}}/>}
              <Text style={[s.availPillTxt,avail===f.k&&s.availPillTxtActive]}>{f.l}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Role filters */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.roleFilters}>
          {ROLE_FILTERS.map(r=>(
            <TouchableOpacity key={r} style={[s.rolePill,role===r&&s.rolePillActive]} onPress={()=>setRole(r)} activeOpacity={0.75}>
              <Text style={[s.rolePillTxt,role===r&&s.rolePillTxtActive]}>{r}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </SafeAreaView>

      {/* Liste */}
      {loading&&staff.length===0
        ?<View style={{flex:1,alignItems:'center',justifyContent:'center',gap:12}}>
            <ActivityIndicator color={GREEN} size="large"/>
            <Text style={{color:T.muted,fontSize:13}}>Recherche en cours…</Text>
          </View>
        :<FlatList
          data={staff}
          keyExtractor={i=>`stf_${i.id}`}
          renderItem={renderItem}
          contentContainerStyle={{padding:EDGE,paddingBottom:120}}
          showsVerticalScrollIndicator={false}
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          refreshControl={<RefreshControl refreshing={refresh} onRefresh={()=>{setRefresh(true);load(true);}} tintColor={GREEN}/>}
          ListFooterComponent={loadingMore?<ActivityIndicator color={GREEN} style={{marginVertical:20}}/>:null}
          ListEmptyComponent={
            <View style={{alignItems:'center',paddingTop:60,gap:12}}>
              <View style={{width:80,height:80,borderRadius:40,backgroundColor:'rgba(0,217,126,0.08)',alignItems:'center',justifyContent:'center',borderWidth:1,borderColor:T.border}}>
                <Ionicons name="people-outline" size={36} color="rgba(0,217,126,0.40)"/>
              </View>
              <Text style={{color:T.white,fontSize:16,fontWeight:'800'}}>Aucun talent trouvé</Text>
              <Text style={{color:T.muted,fontSize:12,textAlign:'center'}}>Essayez d'autres filtres\nou revenez plus tard</Text>
            </View>
          }
        />
      }
    </View>
  );
}

const s=StyleSheet.create({
  header:          {flexDirection:'row',alignItems:'center',paddingHorizontal:EDGE,paddingVertical:14,gap:12},
  title:           {color:T.white,fontSize:22,fontWeight:'900',letterSpacing:-0.4},
  sub:             {color:T.muted,fontSize:12,marginTop:1},
  sortBtn:         {flexDirection:'row',alignItems:'center',gap:5,paddingHorizontal:12,paddingVertical:8,borderRadius:12,backgroundColor:T.surf,borderWidth:StyleSheet.hairlineWidth,borderColor:T.border},
  sortBtnActive:   {backgroundColor:T.greenDim,borderColor:T.borderHi},
  sortTxt:         {color:T.muted,fontSize:12,fontWeight:'600'},
  searchWrap:      {flexDirection:'row',alignItems:'center',gap:10,marginHorizontal:EDGE,marginBottom:10,paddingHorizontal:14,height:46,borderRadius:16,backgroundColor:T.surf,borderWidth:StyleSheet.hairlineWidth,borderColor:T.border},
  searchInput:     {flex:1,color:T.white,fontSize:14},
  availPill:       {flexDirection:'row',alignItems:'center',gap:5,paddingHorizontal:12,paddingVertical:6,borderRadius:20,backgroundColor:T.surf,borderWidth:StyleSheet.hairlineWidth,borderColor:T.border},
  availPillActive: {backgroundColor:T.greenDim,borderColor:T.borderHi},
  availPillTxt:    {color:T.muted,fontSize:11,fontWeight:'600'},
  availPillTxtActive:{color:GREEN,fontWeight:'800'},
  roleFilters:     {paddingHorizontal:EDGE,paddingBottom:10,gap:8},
  rolePill:        {paddingHorizontal:14,paddingVertical:7,borderRadius:20,backgroundColor:T.surf,borderWidth:StyleSheet.hairlineWidth,borderColor:T.border},
  rolePillActive:  {backgroundColor:T.greenDim,borderColor:T.borderHi},
  rolePillTxt:     {color:T.muted,fontSize:12,fontWeight:'600'},
  rolePillTxtActive:{color:GREEN,fontWeight:'800'},
});