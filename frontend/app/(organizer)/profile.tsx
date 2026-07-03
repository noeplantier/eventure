/**
 * app/(organizer)/profile.tsx — EVENTURE v2
 * 100% Supabase · v_organizer_stats · Animations · Realtime · Édition
 */
import React, {
  memo, useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import {
  ActivityIndicator, Animated, Dimensions, Easing, Image,
  Linking, RefreshControl, ScrollView, StyleSheet,
  Text, TouchableOpacity, View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons }       from '@expo/vector-icons';
import { SafeAreaView }   from 'react-native-safe-area-context';
import { useRouter }      from 'expo-router';
import { supabase }       from '@/lib/supabase';
import { getCurrentOrganizerId } from '@/services/api';

const { width: SW } = Dimensions.get('window');
const BG='#020A06';const GREEN='#00D97E';const GOLD='#F5C842';
const T={
  white:'#FFFFFF',offWhite:'rgba(255,255,255,0.88)',muted:'rgba(255,255,255,0.50)',
  faint:'rgba(255,255,255,0.18)',surf:'rgba(255,255,255,0.05)',surfHi:'rgba(255,255,255,0.09)',
  border:'rgba(0,217,126,0.12)',borderHi:'rgba(0,217,126,0.28)',
  greenDim:'rgba(0,217,126,0.12)',goldDim:'rgba(245,200,66,0.12)',goldBd:'rgba(245,200,66,0.28)',
  amber:'#F59E0B',red:'#EF4444',navy:'#0A2218',
} as const;
const EDGE=20;

// ─── Types ────────────────────────────────────────────────────────────────────
interface OrgProfile {
  id:string; display_name:string; company_name:string; username:string; bio:string;
  avatar_url:string; location:string; website:string; phone:string; email:string;
  is_pro:boolean; verified:boolean; rating:number;
}
interface EventRow {
  id:string; title:string; location:string; date_start:string; date_end:string;
  type:string; status:string; budget_total:number; total_slots:number; filled_slots:number;
}
interface StaffRow  { id:string; display_name:string; avatar_url:string|null; role:string[]; rating:number; hourly_rate:number; missions_count:number; }
interface ReviewRow { id:string; rating:number; comment:string|null; created_at:string; reviewer_id:string; }
interface OrgStats  { active_missions:number; done_missions:number; total_missions:number; pending_applications:number; accepted_applications:number; total_staff_hired:number; total_paid:number; response_rate:number; rating:number; }

// ─── Particle Background ──────────────────────────────────────────────────────
const PCOLS=['#00D97E','rgba(0,217,126,0.50)','#F5C842','rgba(245,200,66,0.45)','rgba(255,255,255,0.20)'];
const rnd=(a:number,b:number)=>a+Math.random()*(b-a);
const PTS=Array.from({length:22},(_,i)=>({id:i,x:rnd(0,SW),y:rnd(0,800),sz:i%7===0?1.8:i%3===0?1.1:0.6,col:PCOLS[i%PCOLS.length],op:0.06+i%8*0.04,spd:3000+i*200,del:i*170}));
const FPt=memo(function FPt({p}:{p:typeof PTS[0]}){
  const op=useRef(new Animated.Value(p.op)).current,ty=useRef(new Animated.Value(0)).current;
  useEffect(()=>{Animated.loop(Animated.sequence([Animated.delay(p.del),Animated.parallel([Animated.sequence([Animated.timing(op,{toValue:p.op*4.5,duration:p.spd*.4,useNativeDriver:true}),Animated.timing(op,{toValue:p.op,duration:p.spd*.6,useNativeDriver:true})]),Animated.sequence([Animated.timing(ty,{toValue:-22,duration:p.spd,easing:Easing.inOut(Easing.sin),useNativeDriver:true}),Animated.timing(ty,{toValue:0,duration:p.spd,easing:Easing.inOut(Easing.sin),useNativeDriver:true})])])])).start();},[]);
  return(<Animated.View style={{position:'absolute',left:p.x,top:p.y,opacity:op,transform:[{translateY:ty}]}}><View style={{width:p.sz,height:p.sz,borderRadius:p.sz/2,backgroundColor:p.col}}/></Animated.View>);
});
const ParticleBg=memo(()=>(
  <View style={StyleSheet.absoluteFill} pointerEvents="none">
    <LinearGradient colors={[BG,'#051A0E','#061408',BG]} style={StyleSheet.absoluteFill}/>
    <View style={{position:'absolute',top:'8%',left:'15%',width:SW*.70,height:SW*.70,borderRadius:SW*.35,backgroundColor:'rgba(0,217,126,0.04)'}}/>
    <View style={{position:'absolute',bottom:'5%',right:'-15%',width:SW*.65,height:SW*.65,borderRadius:SW*.32,backgroundColor:'rgba(245,200,66,0.03)'}}/>
    {PTS.map(p=><FPt key={p.id} p={p}/>)}
  </View>
));

// ─── Helpers ─────────────────────────────────────────────────────────────────
const fmtBudget=(n:number)=>n>=1000?`${(n/1000).toFixed(0)}K€`:`${Math.round(n)}€`;
const fmtDate=(iso:string)=>new Date(iso).toLocaleDateString('fr-FR',{day:'numeric',month:'short'});
const EVENT_TYPE_ICONS:Record<string,keyof typeof Ionicons.glyphMap>={wedding:'heart-outline',corporate:'business-outline',concert:'musical-notes-outline',sport:'trophy-outline',gala:'sparkles-outline',festival:'color-palette-outline',private:'home-outline',other:'calendar-outline'};
const EVENT_TYPE_COLORS:Record<string,string>={wedding:'#F472B6',corporate:'#38BDF8',concert:'#A78BFA',sport:'#FB923C',gala:GOLD,festival:'#4ADE80',private:'#94A3B8',other:T.muted};
const STATUS_CFG:Record<string,{c:string;bg:string;l:string}>={draft:{c:T.muted,bg:'rgba(255,255,255,0.06)',l:'Brouillon'},published:{c:GREEN,bg:'rgba(0,217,126,0.14)',l:'En ligne'},closed:{c:T.amber,bg:'rgba(245,158,11,0.14)',l:'Complet'},done:{c:T.faint,bg:'rgba(255,255,255,0.05)',l:'Terminé'},cancelled:{c:T.red,bg:'rgba(239,68,68,0.10)',l:'Annulé'}};

// ─── Event Card ───────────────────────────────────────────────────────────────
const EventCard=memo(function EventCard({e,onPress}:{e:EventRow;onPress:()=>void}){
  const cfg=STATUS_CFG[e.status]??STATUS_CFG.published;
  const pct=e.total_slots>0?e.filled_slots/e.total_slots:0;
  const icon=EVENT_TYPE_ICONS[e.type]??'calendar-outline';
  const col=EVENT_TYPE_COLORS[e.type]??T.muted;
  return(
    <TouchableOpacity style={ec.card} onPress={onPress} activeOpacity={0.85}>
      <LinearGradient colors={['rgba(0,217,126,0.07)','rgba(0,217,126,0.01)']} style={StyleSheet.absoluteFillObject}/>
      <View style={ec.top}>
        <View style={[ec.icon,{backgroundColor:`${col}18`}]}><Ionicons name={icon} size={14} color={col}/></View>
        <View style={{flex:1,gap:2}}>
          <Text style={ec.title} numberOfLines={1}>{e.title}</Text>
          <View style={{flexDirection:'row',alignItems:'center',gap:5}}>
            <Ionicons name="calendar-outline" size={10} color={T.muted}/>
            <Text style={ec.meta}>{fmtDate(e.date_start)}</Text>
            <Text style={ec.dot}>·</Text>
            <Ionicons name="location-outline" size={10} color={T.muted}/>
            <Text style={ec.meta} numberOfLines={1}>{e.location.split(',')[0]}</Text>
          </View>
        </View>
        <View style={[ec.status,{backgroundColor:cfg.bg}]}>
          <View style={{width:5,height:5,borderRadius:2.5,backgroundColor:cfg.c}}/>
          <Text style={[ec.statusTxt,{color:cfg.c}]}>{cfg.l}</Text>
        </View>
      </View>
      <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between'}}>
        <Text style={{color:GREEN,fontSize:10,fontWeight:'700'}}>{e.filled_slots}/{e.total_slots} recrutés</Text>
        <Text style={{color:GOLD,fontSize:11,fontWeight:'800'}}>{fmtBudget(e.budget_total)}</Text>
      </View>
      <View style={ec.track}><View style={[ec.fill,{width:`${Math.min(pct*100,100)}%` as any}]}/></View>
      <View style={{position:'absolute',top:0,left:0,right:0,bottom:0,borderRadius:16,borderWidth:StyleSheet.hairlineWidth,borderColor:T.border}} pointerEvents="none"/>
    </TouchableOpacity>
  );
});
const ec=StyleSheet.create({
  card:   {borderRadius:16,overflow:'hidden',marginBottom:10,padding:13,gap:8,backgroundColor:T.navy},
  top:    {flexDirection:'row',alignItems:'flex-start',gap:8},
  icon:   {width:28,height:28,borderRadius:8,alignItems:'center',justifyContent:'center'},
  title:  {color:T.white,fontSize:13,fontWeight:'800',lineHeight:17},
  meta:   {color:T.muted,fontSize:9,flexShrink:1},
  dot:    {color:T.faint,fontSize:9},
  status: {flexDirection:'row',alignItems:'center',gap:3,paddingHorizontal:7,paddingVertical:3,borderRadius:10},
  statusTxt:{fontSize:8,fontWeight:'800'},
  track:  {height:3,borderRadius:2,backgroundColor:'rgba(255,255,255,0.08)',overflow:'hidden'},
  fill:   {height:'100%',borderRadius:2,backgroundColor:GREEN},
});

// ─── Staff Row ────────────────────────────────────────────────────────────────
const StaffRow=memo(function StaffRow({s,onChat}:{s:StaffRow;onChat:()=>void}){
  const [imgErr,setImgErr]=useState(false);const stars=Math.round(s.rating);
  return(
    <View style={{flexDirection:'row',alignItems:'center',gap:10,paddingVertical:11,borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:T.border}}>
      {s.avatar_url&&!imgErr?<Image source={{uri:s.avatar_url}} style={{width:42,height:42,borderRadius:21}} resizeMode="cover" onError={()=>setImgErr(true)}/>:<View style={{width:42,height:42,borderRadius:21,backgroundColor:'rgba(0,217,126,0.10)',alignItems:'center',justifyContent:'center',borderWidth:1,borderColor:T.border}}><Ionicons name="person-outline" size={18} color={GREEN}/></View>}
      <View style={{flex:1,gap:2}}>
        <Text style={{color:T.white,fontSize:13,fontWeight:'700'}}>{s.display_name}</Text>
        <Text style={{color:T.muted,fontSize:10}}>{Array.isArray(s.role)?s.role[0]:s.role} · {s.missions_count} missions</Text>
        <View style={{flexDirection:'row',gap:1}}>{[1,2,3,4,5].map(i=><Ionicons key={i} name={i<=stars?'star':'star-outline'} size={8} color={i<=stars?GOLD:T.faint}/>)}</View>
      </View>
      <Text style={{color:GOLD,fontSize:13,fontWeight:'800'}}>{s.hourly_rate}€/h</Text>
      <TouchableOpacity style={{width:32,height:32,borderRadius:16,backgroundColor:T.greenDim,alignItems:'center',justifyContent:'center',borderWidth:1,borderColor:T.borderHi}} onPress={onChat} activeOpacity={0.78}>
        <Ionicons name="chatbubble-outline" size={13} color={GREEN}/>
      </TouchableOpacity>
    </View>
  );
});

// ─── Accordion ────────────────────────────────────────────────────────────────
const Accordion=memo(function Accordion({icon,title,count,badge,defaultOpen=false,children}:{icon:keyof typeof Ionicons.glyphMap;title:string;count?:number;badge?:string;defaultOpen?:boolean;children:React.ReactNode}){
  const [open,setOpen]=useState(defaultOpen);
  const rot=useRef(new Animated.Value(defaultOpen?1:0)).current;
  const toggle=()=>{const n=!open;Animated.spring(rot,{toValue:n?1:0,tension:100,friction:10,useNativeDriver:true}).start();setOpen(n);};
  return(
    <View style={{marginBottom:8,borderRadius:16,overflow:'hidden',borderWidth:StyleSheet.hairlineWidth,borderColor:open?T.borderHi:T.border,backgroundColor:T.navy}}>
      <TouchableOpacity onPress={toggle} activeOpacity={0.78} style={{flexDirection:'row',alignItems:'center',gap:10,padding:15}}>
        <View style={{width:32,height:32,borderRadius:11,backgroundColor:open?T.greenDim:T.surf,alignItems:'center',justifyContent:'center'}}><Ionicons name={icon} size={15} color={open?GREEN:T.muted}/></View>
        <Text style={{color:open?T.white:T.offWhite,fontSize:13,fontWeight:'700',flex:1}}>{title}</Text>
        {badge&&<View style={{paddingHorizontal:8,paddingVertical:2,borderRadius:10,backgroundColor:T.greenDim,borderWidth:StyleSheet.hairlineWidth,borderColor:T.borderHi}}><Text style={{color:GREEN,fontSize:9,fontWeight:'800'}}>{badge}</Text></View>}
        {count!=null&&<View style={{paddingHorizontal:7,paddingVertical:2,borderRadius:7,backgroundColor:T.surf}}><Text style={{color:T.muted,fontSize:9,fontWeight:'700'}}>{count}</Text></View>}
        <Animated.View style={{transform:[{rotate:rot.interpolate({inputRange:[0,1],outputRange:['0deg','90deg']})}]}}><Ionicons name="chevron-forward" size={14} color={T.muted}/></Animated.View>
      </TouchableOpacity>
      {open&&<View style={{borderTopWidth:StyleSheet.hairlineWidth,borderTopColor:T.border,paddingHorizontal:15,paddingTop:12,paddingBottom:15,gap:8}}>{children}</View>}
    </View>
  );
});

// ─── AnimBar ─────────────────────────────────────────────────────────────────
const AnimBar=memo(function AnimBar({v,max,col=GREEN}:{v:number;max:number;col?:string}){
  const prog=useRef(new Animated.Value(0)).current;
  useEffect(()=>{Animated.timing(prog,{toValue:max>0?v/max:0,duration:900,easing:Easing.out(Easing.cubic),useNativeDriver:false}).start();},[v,max]);
  return(<View style={{flex:1,height:4,borderRadius:2,backgroundColor:'rgba(255,255,255,0.07)',overflow:'hidden'}}><Animated.View style={{height:'100%',borderRadius:2,backgroundColor:col,width:prog.interpolate({inputRange:[0,1],outputRange:['0%','100%']})}}/></View>);
});

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function OrganizerProfileScreen() {
  const router  = useRouter();
  const [profile,  setProfile]  = useState<OrgProfile>({id:'',display_name:'',company_name:'',username:'',bio:'',avatar_url:'',location:'',website:'',phone:'',email:'',is_pro:false,verified:false,rating:0});
  const [stats,    setStats]    = useState<OrgStats>({active_missions:0,done_missions:0,total_missions:0,pending_applications:0,accepted_applications:0,total_staff_hired:0,total_paid:0,response_rate:0,rating:0});
  const [events,   setEvents]   = useState<EventRow[]>([]);
  const [staff,    setStaff]    = useState<StaffRow[]>([]);
  const [reviews,  setReviews]  = useState<ReviewRow[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [refresh,  setRefresh]  = useState(false);
  const [activeTab,setActiveTab]= useState<0|1|2>(0);
  const [imgErr,   setImgErr]   = useState(false);

  const ratingAnim = useRef(new Animated.Value(0)).current;
  const ringAnim   = useRef(new Animated.Value(1)).current;
  const tabAnim    = useRef(new Animated.Value(0)).current;

  useEffect(()=>{
    Animated.loop(Animated.sequence([Animated.timing(ringAnim,{toValue:1.05,duration:2800,easing:Easing.inOut(Easing.ease),useNativeDriver:true}),Animated.timing(ringAnim,{toValue:1,duration:2800,easing:Easing.inOut(Easing.ease),useNativeDriver:true})])).start();
  },[]);

  useEffect(()=>{
    Animated.spring(tabAnim,{toValue:activeTab,tension:100,friction:12,useNativeDriver:true}).start();
  },[activeTab]);

  const load=useCallback(async()=>{
    try{
      const uid=await getCurrentOrganizerId();
      if(!uid){setLoading(false);return;}

      // Parallel fetch
      const [profRes,statsRes,eventsRes,reviewsRes]=await Promise.all([
        supabase.from('organizers').select('*').eq('id',uid).single(),
        supabase.from('v_organizer_stats').select('*').eq('organizer_id',uid).single(),
        supabase.from('v_event_with_budget').select('id,title,location,date_start,date_end,type,status,budget_total,total_slots,filled_slots').eq('organizer_id',uid).order('date_start',{ascending:false}).limit(20),
        supabase.from('reviews').select('id,rating,comment,created_at,reviewer_id').eq('reviewee_id',uid).order('created_at',{ascending:false}).limit(10),
      ]);

      if(profRes.data){
        const p=profRes.data as any;
        setProfile({id:uid,display_name:p.contact_name??'',company_name:p.company_name??'',username:'',bio:p.bio??'',avatar_url:p.avatar_url??'',location:p.location??'',website:p.website??'',phone:p.phone??'',email:'',is_pro:p.is_pro??false,verified:p.verified??false,rating:p.rating??0});
      }

      if(statsRes.data) setStats(statsRes.data as any);
      if(eventsRes.data) setEvents(eventsRes.data as EventRow[]);
      if(reviewsRes.data) setReviews(reviewsRes.data as ReviewRow[]);

      // Staff ayant des candidatures acceptées pour mes events
      const evtIds=eventsRes.data?.map((e:any)=>e.id)??[];
      if(evtIds.length>0){
        const {data:roles}=await supabase.from('event_roles').select('id').in('event_id',evtIds);
        if(roles?.length){
          const {data:apps}=await supabase.from('applications').select('staff:staff_id(id,display_name,avatar_url,role,rating,hourly_rate,missions_count)').in('event_role_id',roles.map((r:any)=>r.id)).eq('status','accepted').limit(10);
          const uniqueStaff=new Map();
          (apps??[]).forEach((a:any)=>{if(a.staff)uniqueStaff.set(a.staff.id,a.staff);});
          setStaff([...uniqueStaff.values()] as StaffRow[]);
        }
      }

      Animated.timing(ratingAnim,{toValue:statsRes.data?(statsRes.data as any).rating/5:0,duration:1400,easing:Easing.out(Easing.cubic),useNativeDriver:false}).start();

    }catch(e){console.error('[profile v2]',e);}
    finally{setLoading(false);setRefresh(false);}
  },[]);

  // Realtime
  useEffect(()=>{
    let ch:ReturnType<typeof supabase.channel>|null=null;let mounted=true;
    getCurrentOrganizerId().then((organizerId)=>{
      if(!organizerId||!mounted)return;
      ch=supabase.channel('profile_rt')
        .on('postgres_changes',{event:'*',schema:'public',table:'organizers',filter:`id=eq.${organizerId}`},()=>{if(mounted)load();})
        .on('postgres_changes',{event:'*',schema:'public',table:'events',filter:`organizer_id=eq.${organizerId}`},()=>{if(mounted)load();})
        .subscribe();
    });
    return()=>{mounted=false;if(ch)supabase.removeChannel(ch);};
  },[load]);

  useEffect(()=>{load();},[]);

  // Dérivés
  const activeEvents = useMemo(()=>events.filter(e=>e.status==='published'),[events]);
  const doneEvents   = useMemo(()=>events.filter(e=>e.status==='done'),[events]);
  const draftEvents  = useMemo(()=>events.filter(e=>e.status==='draft'),[events]);
  const typeStats    = useMemo(()=>{const m:Record<string,number>={};events.forEach(e=>{m[e.type]=(m[e.type]??0)+1;});return Object.entries(m).sort((a,b)=>b[1]-a[1]);},[events]);
  const maxType      = useMemo(()=>Math.max(1,...typeStats.map(t=>t[1])),[typeStats]);
  const avgRating    = useMemo(()=>reviews.length?reviews.reduce((a,r)=>a+r.rating,0)/reviews.length:0,[reviews]);

  const dn   = profile.company_name||profile.display_name||'Mon Agence';
  const init = dn.trim().split(/\s+/).map(n=>n[0]).join('').toUpperCase().slice(0,2);
  const barW = ratingAnim.interpolate({inputRange:[0,1],outputRange:['0%','100%']});

  const TABS=['Missions','Analytics','Mon Staff'];

  const handleChat=(s:StaffRow)=>router.push({pathname:'/(shared)/chat/[id]',params:{id:s.id,name:s.display_name}} as any);

  return(
    <View style={{flex:1,backgroundColor:BG}}>
      <ParticleBg/>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{paddingBottom:110}}
        refreshControl={<RefreshControl refreshing={refresh} onRefresh={()=>{setRefresh(true);load();}} tintColor={GREEN}/>}
      >
        <SafeAreaView edges={['top']}>
          {/* Top bar */}
          <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center',paddingHorizontal:EDGE,paddingTop:6,paddingBottom:10}}>
            <View style={{flexDirection:'row',alignItems:'center',gap:7}}>
              <Text style={{color:GREEN,fontSize:9,fontWeight:'900',letterSpacing:2.8}}>EVENTURE</Text>
              <View style={{width:2,height:8,backgroundColor:T.faint,borderRadius:1}}/>
              <Text style={{color:T.muted,fontSize:9,fontWeight:'600'}}>Organisateur</Text>
              {profile.verified&&(
                <View style={{flexDirection:'row',alignItems:'center',gap:3,paddingHorizontal:6,paddingVertical:2,borderRadius:7,backgroundColor:T.greenDim,borderWidth:StyleSheet.hairlineWidth,borderColor:T.borderHi}}>
                  <Ionicons name="shield-checkmark" size={9} color={GREEN}/>
                  <Text style={{color:GREEN,fontSize:7,fontWeight:'800',letterSpacing:0.5}}>VÉRIFIÉ</Text>
                </View>
              )}
            </View>
            <View style={{flexDirection:'row',gap:7}}>
              <TouchableOpacity style={ps.iconBtn} onPress={()=>router.push('/(shared)/notifications' as any)}><Ionicons name="notifications-outline" size={16} color={T.muted}/></TouchableOpacity>
              <TouchableOpacity style={ps.iconBtn} onPress={()=>router.push('/(shared)/settings' as any)}><Ionicons name="settings-outline" size={15} color={T.muted}/></TouchableOpacity>
            </View>
          </View>

          {/* Identity */}
          {loading
            ?<View style={{paddingHorizontal:EDGE,paddingBottom:20,height:120,alignItems:'center',justifyContent:'center'}}><ActivityIndicator color={GREEN}/></View>
            :<View style={{flexDirection:'row',alignItems:'flex-start',paddingHorizontal:EDGE,marginBottom:14,gap:16}}>
              {/* Avatar */}
              <TouchableOpacity onPress={()=>router.push('/(organizer)/edit-profile' as any)} activeOpacity={0.82}>
                <View style={{position:'relative',width:86,height:86,alignItems:'center',justifyContent:'center'}}>
                  <Animated.View style={{position:'absolute',width:86,height:86,borderRadius:43,borderWidth:1.5,borderColor:'rgba(0,217,126,0.45)',transform:[{scale:ringAnim}]}}/>
                  {profile.avatar_url&&!imgErr
                    ?<Image source={{uri:profile.avatar_url}} style={{width:78,height:78,borderRadius:39}} resizeMode="cover" onError={()=>setImgErr(true)}/>
                    :<View style={{width:78,height:78,borderRadius:39,backgroundColor:T.navy,alignItems:'center',justifyContent:'center',borderWidth:1.5,borderColor:T.border,backgroundColor:'rgba(0,217,126,0.08)'}}>
                       <Text style={{color:GREEN,fontSize:24,fontWeight:'900'}}>{init}</Text>
                     </View>
                  }
                  {profile.is_pro&&<View style={{position:'absolute',bottom:2,right:-3,paddingHorizontal:6,paddingVertical:2,borderRadius:5,backgroundColor:BG,borderWidth:1.5,borderColor:T.borderHi}}><Text style={{color:GREEN,fontSize:7,fontWeight:'900',letterSpacing:0.6}}>PRO</Text></View>}
                  <View style={{position:'absolute',bottom:0,left:0,right:0,height:'30%',borderBottomLeftRadius:39,borderBottomRightRadius:39,backgroundColor:'rgba(0,0,0,0.35)',alignItems:'center',justifyContent:'flex-end',paddingBottom:5}}>
                    <Ionicons name="camera-outline" size={11} color="rgba(255,255,255,0.80)"/>
                  </View>
                </View>
              </TouchableOpacity>

              {/* Info */}
              <View style={{flex:1,paddingTop:2,gap:4}}>
                <Text style={{color:T.white,fontSize:18,fontWeight:'900',letterSpacing:-0.4}} numberOfLines={1}>{dn}</Text>
                {profile.display_name&&profile.company_name&&profile.display_name!==profile.company_name&&<Text style={{color:T.muted,fontSize:11}}>{profile.display_name}</Text>}
                {profile.location&&<View style={{flexDirection:'row',alignItems:'center',gap:4}}><Ionicons name="location-outline" size={10} color={T.muted}/><Text style={{color:T.muted,fontSize:10}}>{profile.location}</Text></View>}
                <View style={{flexDirection:'row',alignItems:'center',gap:7,marginTop:2}}>
                  <View style={{flexDirection:'row',alignItems:'center',gap:3,paddingHorizontal:8,paddingVertical:3,borderRadius:9,backgroundColor:T.goldDim,borderWidth:StyleSheet.hairlineWidth,borderColor:T.goldBd}}>
                    <Ionicons name="star" size={10} color={GOLD}/>
                    <Text style={{color:GOLD,fontSize:12,fontWeight:'900'}}>{stats.rating.toFixed(1)}</Text>
                  </View>
                  <Text style={{color:T.muted,fontSize:10,flex:1}}>{stats.total_missions} mission{stats.total_missions>1?'s':''}</Text>
                </View>
                {/* Rating bar */}
                <View style={{height:4,borderRadius:2,backgroundColor:T.surf,overflow:'hidden',marginTop:3}}>
                  <Animated.View style={{height:'100%',borderRadius:2,backgroundColor:GREEN,width:barW}}/>
                </View>
                <Text style={{color:T.faint,fontSize:9}}>{Math.round(stats.response_rate)}% taux de réponse · {stats.total_staff_hired} staff recruté{stats.total_staff_hired>1?'s':''}</Text>
              </View>
            </View>
          }

          {/* Bio */}
          {!!profile.bio&&<Text style={{color:T.muted,fontSize:12.5,lineHeight:18,paddingHorizontal:EDGE,marginBottom:12}}>{profile.bio}</Text>}

          {/* Socials */}
          {(profile.website||profile.email||profile.phone)&&(
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{paddingHorizontal:EDGE,gap:7,paddingBottom:14}}>
              {profile.website&&<TouchableOpacity style={ps.socialBtn} onPress={()=>Linking.openURL(profile.website).catch(()=>{})} activeOpacity={0.78}><Ionicons name="globe-outline" size={13} color={T.muted}/><Text style={ps.socialTxt}>Site web</Text></TouchableOpacity>}
              {profile.email&&<TouchableOpacity style={ps.socialBtn} onPress={()=>Linking.openURL(`mailto:${profile.email}`).catch(()=>{})} activeOpacity={0.78}><Ionicons name="mail-outline" size={13} color={T.muted}/><Text style={ps.socialTxt}>Email</Text></TouchableOpacity>}
              {profile.phone&&<TouchableOpacity style={ps.socialBtn} onPress={()=>Linking.openURL(`tel:${profile.phone}`).catch(()=>{})} activeOpacity={0.78}><Ionicons name="call-outline" size={13} color={T.muted}/><Text style={ps.socialTxt}>Appeler</Text></TouchableOpacity>}
            </ScrollView>
          )}
        </SafeAreaView>

        {/* Stat Strip */}
        {!loading&&(
          <View style={ps.statStrip}>
            {[
              {v:String(stats.active_missions), l:'Actives',  c:GREEN},
              {v:String(stats.pending_applications), l:'En attente', c:T.amber},
              {v:String(stats.total_staff_hired), l:'Staff',   c:GOLD},
              {v:stats.total_paid>0?`${(stats.total_paid/1000).toFixed(0)}K€`:fmtBudget(events.reduce((a,e)=>a+e.budget_total,0)), l:'Budget', c:T.offWhite},
            ].map(({v,l,c},i,arr)=>(
              <React.Fragment key={l}>
                <View style={{flex:1,alignItems:'center',gap:3}}>
                  <Text style={{color:c,fontSize:19,fontWeight:'900',letterSpacing:-0.5}}>{v}</Text>
                  <Text style={{color:T.muted,fontSize:9,fontWeight:'600',textTransform:'uppercase',letterSpacing:0.5,textAlign:'center'}}>{l}</Text>
                </View>
                {i<arr.length-1&&<View style={{width:StyleSheet.hairlineWidth,height:26,backgroundColor:T.border}}/>}
              </React.Fragment>
            ))}
          </View>
        )}

        {/* Edit btn */}
        <TouchableOpacity style={ps.editBtn} onPress={()=>router.push('/(organizer)/edit-profile' as any)} activeOpacity={0.80}>
          <Ionicons name="pencil-outline" size={13} color={T.muted}/>
          <Text style={ps.editTxt}>Modifier le profil</Text>
        </TouchableOpacity>

        {/* Tabs */}
        <View style={{flexDirection:'row',borderTopWidth:StyleSheet.hairlineWidth,borderBottomWidth:StyleSheet.hairlineWidth,borderColor:T.border,marginTop:10,marginBottom:4}}>
          {TABS.map((lbl,idx)=>{
            const a=activeTab===idx;
            const badge=idx===0?stats.pending_applications:0;
            return(
              <TouchableOpacity key={lbl} style={{flex:1,alignItems:'center',paddingVertical:12,gap:3,position:'relative'}} onPress={()=>setActiveTab(idx as 0|1|2)} activeOpacity={0.75}>
                <Text style={{fontSize:10,fontWeight:'700',color:a?GREEN:T.muted,letterSpacing:0.6,textTransform:'uppercase'}}>{lbl}</Text>
                {a&&<View style={{position:'absolute',top:0,left:'15%',right:'15%',height:2,backgroundColor:GREEN,borderBottomLeftRadius:2,borderBottomRightRadius:2}}/>}
                {badge>0&&<View style={{position:'absolute',top:5,right:6,width:15,height:15,borderRadius:7.5,backgroundColor:T.amber,alignItems:'center',justifyContent:'center'}}><Text style={{color:BG,fontSize:8,fontWeight:'900'}}>{badge}</Text></View>}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── Tab 0 — Missions ── */}
        {activeTab===0&&(
          <View style={{paddingHorizontal:EDGE,paddingTop:12}}>
            {loading?<ActivityIndicator color={GREEN} style={{marginTop:30}}/>:<>
              {activeEvents.length>0&&(
                <>
                  <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
                    <Text style={ps.secLbl}>En ligne ({activeEvents.length})</Text>
                    <TouchableOpacity onPress={()=>router.push('/(organizer)/dashboard' as any)}><Text style={{color:GREEN,fontSize:11,fontWeight:'700'}}>Tout voir</Text></TouchableOpacity>
                  </View>
                  {activeEvents.map(e=><EventCard key={e.id} e={e} onPress={()=>router.push({pathname:'/(organizer)/event/[id]',params:{id:e.id}} as any)}/>)}
                </>
              )}
              {draftEvents.length>0&&(
                <View style={{marginTop:16}}>
                  <Text style={[ps.secLbl,{marginBottom:10}]}>Brouillons ({draftEvents.length})</Text>
                  {draftEvents.slice(0,3).map(e=><EventCard key={e.id} e={e} onPress={()=>router.push({pathname:'/(organizer)/event/[id]',params:{id:e.id}} as any)}/>)}
                </View>
              )}
              {doneEvents.length>0&&(
                <View style={{marginTop:16}}>
                  <Text style={[ps.secLbl,{marginBottom:10}]}>Terminées ({doneEvents.length})</Text>
                  {doneEvents.slice(0,3).map(e=><EventCard key={e.id} e={e} onPress={()=>router.push({pathname:'/(organizer)/event/[id]',params:{id:e.id}} as any)}/>)}
                </View>
              )}
              {events.length===0&&(
                <View style={{alignItems:'center',paddingTop:50,gap:14}}>
                  <View style={{width:88,height:88,borderRadius:44,backgroundColor:'rgba(0,217,126,0.08)',alignItems:'center',justifyContent:'center',borderWidth:1,borderColor:T.border}}>
                    <Ionicons name="calendar-outline" size={38} color="rgba(0,217,126,0.45)"/>
                  </View>
                  <Text style={{color:T.white,fontSize:17,fontWeight:'800',textAlign:'center'}}>Aucune mission encore</Text>
                  <Text style={{color:T.muted,fontSize:13,textAlign:'center'}}>Créez votre première mission pour commencer à recruter</Text>
                  <TouchableOpacity style={ps.createBtn} onPress={()=>router.push('/(organizer)/create-event' as any)}>
                    <Ionicons name="add-circle-outline" size={16} color={GREEN}/>
                    <Text style={{color:GREEN,fontSize:14,fontWeight:'800'}}>Créer ma première mission</Text>
                  </TouchableOpacity>
                </View>
              )}
            </>}
          </View>
        )}

        {/* ── Tab 1 — Analytics ── */}
        {activeTab===1&&(
          <View style={{paddingHorizontal:EDGE,paddingTop:12,gap:10}}>
            {loading?<ActivityIndicator color={GREEN} style={{marginTop:30}}/>:<>
              <Accordion icon="trending-up-outline" title="Performance globale" defaultOpen>
                {[
                  {l:'Missions publiées',    v:String(stats.active_missions+stats.done_missions), c:T.white},
                  {l:'Taux de réponse',      v:`${Math.round(stats.response_rate)}%`,             c:GREEN},
                  {l:'Staff accepté',        v:String(stats.accepted_applications),               c:GOLD},
                  {l:'Candidatures reçues',  v:String(stats.accepted_applications+stats.pending_applications), c:T.white},
                  {l:'Budget total engagé',  v:fmtBudget(events.reduce((a,e)=>a+e.budget_total,0)), c:GOLD},
                  {l:'Montant versé',        v:fmtBudget(stats.total_paid),                       c:T.muted},
                ].map(({l,v,c})=>(
                  <View key={l} style={{flexDirection:'row',justifyContent:'space-between',paddingVertical:9,borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:T.border}}>
                    <Text style={{color:T.muted,fontSize:12}}>{l}</Text>
                    <Text style={{color:c,fontSize:13,fontWeight:'800'}}>{v}</Text>
                  </View>
                ))}
              </Accordion>

              <Accordion icon="layers-outline" title="Types d'événements" count={typeStats.length}>
                {!typeStats.length
                  ?<Text style={{color:T.muted,fontSize:12,textAlign:'center',paddingVertical:8}}>Créez des missions pour voir vos statistiques</Text>
                  :typeStats.map(([type,count])=>(
                    <View key={type} style={{flexDirection:'row',alignItems:'center',gap:10,paddingVertical:5}}>
                      <Ionicons name={EVENT_TYPE_ICONS[type]??'calendar-outline'} size={13} color={EVENT_TYPE_COLORS[type]??T.muted}/>
                      <Text style={{color:T.muted,fontSize:11,width:90}}>{type.charAt(0).toUpperCase()+type.slice(1)}</Text>
                      <AnimBar v={count} max={maxType} col={EVENT_TYPE_COLORS[type]??GREEN}/>
                      <Text style={{color:T.muted,fontSize:10,fontWeight:'700',width:18,textAlign:'right'}}>{count}</Text>
                    </View>
                  ))
                }
              </Accordion>

              <Accordion icon="star-outline" title="Avis reçus" count={reviews.length} badge={reviews.length>0?`${avgRating.toFixed(1)}★`:undefined}>
                {!reviews.length
                  ?<Text style={{color:T.muted,fontSize:12,textAlign:'center',paddingVertical:8}}>Aucun avis pour le moment</Text>
                  :reviews.slice(0,5).map(r=>(
                    <View key={r.id} style={{paddingVertical:10,borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:T.border,gap:4}}>
                      <View style={{flexDirection:'row',alignItems:'center',gap:6}}>
                        <View style={{flexDirection:'row',gap:1}}>{[1,2,3,4,5].map(i=><Ionicons key={i} name={i<=r.rating?'star':'star-outline'} size={10} color={i<=r.rating?GOLD:T.faint}/>)}</View>
                        <Text style={{color:T.faint,fontSize:9}}>{new Date(r.created_at).toLocaleDateString('fr-FR')}</Text>
                      </View>
                      {r.comment&&<Text style={{color:T.muted,fontSize:12,lineHeight:16,fontStyle:'italic'}}>"{r.comment}"</Text>}
                    </View>
                  ))
                }
              </Accordion>

              <Accordion icon="business-outline" title="Informations agence" defaultOpen>
                {[
                  {icon:'mail-outline' as const, l:profile.email,    url:`mailto:${profile.email}`},
                  {icon:'call-outline' as const, l:profile.phone,    url:`tel:${profile.phone}`},
                  {icon:'globe-outline' as const,l:profile.website,  url:profile.website},
                  {icon:'location-outline' as const,l:profile.location, url:null},
                ].filter(i=>!!i.l).map(({icon,l,url})=>(
                  <TouchableOpacity key={l} style={{flexDirection:'row',alignItems:'center',gap:10,paddingVertical:8}} onPress={url?()=>Linking.openURL(url).catch(()=>{}):undefined} activeOpacity={url?0.75:1}>
                    <Ionicons name={icon} size={13} color={url?GREEN:T.muted}/>
                    <Text style={{color:url?GREEN:T.muted,fontSize:12,flex:1,textDecorationLine:url?'underline':'none'}}>{l}</Text>
                    {url&&<Ionicons name="open-outline" size={11} color={T.faint}/>}
                  </TouchableOpacity>
                ))}
                {!profile.email&&!profile.phone&&!profile.website&&!profile.location&&(
                  <TouchableOpacity style={ps.createBtn} onPress={()=>router.push('/(organizer)/edit-profile' as any)}>
                    <Text style={{color:GREEN,fontSize:12,fontWeight:'700'}}>Compléter mon profil →</Text>
                  </TouchableOpacity>
                )}
              </Accordion>
            </>}
          </View>
        )}

        {/* ── Tab 2 — Mon Staff ── */}
        {activeTab===2&&(
          <View style={{paddingHorizontal:EDGE,paddingTop:12}}>
            {loading?<ActivityIndicator color={GREEN} style={{marginTop:30}}/>:
             staff.length===0?(
              <View style={{alignItems:'center',paddingTop:50,gap:14}}>
                <View style={{width:88,height:88,borderRadius:44,backgroundColor:'rgba(0,217,126,0.08)',alignItems:'center',justifyContent:'center',borderWidth:1,borderColor:T.border}}>
                  <Ionicons name="people-outline" size={38} color="rgba(0,217,126,0.45)"/>
                </View>
                <Text style={{color:T.white,fontSize:17,fontWeight:'800',textAlign:'center'}}>Aucun staff encore recruté</Text>
                <Text style={{color:T.muted,fontSize:13,textAlign:'center'}}>Publiez des missions et acceptez des candidatures</Text>
                <TouchableOpacity style={ps.createBtn} onPress={()=>router.push('/(organizer)/missions' as any)}>
                  <Ionicons name="file-tray-stacked-outline" size={14} color={GREEN}/>
                  <Text style={{color:GREEN,fontSize:13,fontWeight:'800'}}>Explorer le catalogue</Text>
                </TouchableOpacity>
              </View>
            ):(
              <>
                <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
                  <Text style={ps.secLbl}>Équipe ({staff.length})</Text>
                  <TouchableOpacity onPress={()=>router.push('/(organizer)/missions' as any)}><Text style={{color:GREEN,fontSize:11,fontWeight:'700'}}>+ Recruter</Text></TouchableOpacity>
                </View>
                {staff.map(s=><StaffRow key={s.id} s={s} onChat={()=>handleChat(s)}/>)}
              </>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const ps=StyleSheet.create({
  iconBtn:   {width:33,height:33,borderRadius:16.5,alignItems:'center',justifyContent:'center',backgroundColor:T.surf,borderWidth:StyleSheet.hairlineWidth,borderColor:T.border},
  statStrip: {flexDirection:'row',alignItems:'center',marginHorizontal:EDGE,marginBottom:10,padding:14,borderRadius:16,backgroundColor:T.navy,borderWidth:StyleSheet.hairlineWidth,borderColor:T.border},
  editBtn:   {flexDirection:'row',alignItems:'center',justifyContent:'center',gap:6,marginHorizontal:EDGE,marginBottom:4,paddingVertical:11,borderRadius:13,backgroundColor:T.surf,borderWidth:StyleSheet.hairlineWidth,borderColor:T.border},
  editTxt:   {color:T.muted,fontSize:13,fontWeight:'700'},
  socialBtn: {flexDirection:'row',alignItems:'center',gap:5,paddingHorizontal:11,paddingVertical:7,borderRadius:10,borderWidth:StyleSheet.hairlineWidth,borderColor:T.border,backgroundColor:T.surf},
  socialTxt: {color:T.muted,fontSize:10,fontWeight:'600'},
  secLbl:    {color:T.white,fontSize:13,fontWeight:'800'},
  createBtn: {flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,paddingVertical:13,paddingHorizontal:24,borderRadius:16,borderWidth:1.5,borderColor:T.borderHi,backgroundColor:T.greenDim},
});