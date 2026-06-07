/**
 * app/(organizer)/applications.tsx — EVENTURE v2
 * 100% dynamique · Vue v_application_details · Optimistic updates · Realtime
 */
import React, {
  memo, useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import {
  ActivityIndicator, Alert, Animated, Dimensions, Easing,
  FlatList, Image, RefreshControl, ScrollView,
  StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons }       from '@expo/vector-icons';
import { SafeAreaView }   from 'react-native-safe-area-context';
import { useRouter }      from 'expo-router';
import { supabase }       from '@/lib/supabase';

const { width: SW } = Dimensions.get('window');
const BG='#020A06';const GREEN='#00D97E';const GOLD='#F5C842';
const T={
  white:'#FFFFFF',muted:'rgba(255,255,255,0.50)',faint:'rgba(255,255,255,0.18)',
  surf:'rgba(255,255,255,0.05)',surfHi:'rgba(255,255,255,0.09)',
  border:'rgba(0,217,126,0.12)',borderHi:'rgba(0,217,126,0.28)',
  greenDim:'rgba(0,217,126,0.12)',goldDim:'rgba(245,200,66,0.12)',
  amber:'#F59E0B',red:'#EF4444',navy:'#0A2218',
} as const;
const EDGE=20;

// ─── Types ────────────────────────────────────────────────────────────────────
type AppStatus='pending'|'accepted'|'rejected'|'cancelled';
interface AppDetail {
  id:string; status:AppStatus; message:string|null;
  applied_at:string; reviewed_at:string|null;
  role:string; hourly_rate:number; slots:number; slots_filled:number;
  event_id:string; event_title:string; date_start:string; date_end:string; event_location:string;
  staff_id:string; staff_name:string; staff_avatar:string|null;
  staff_rating:number; missions_count:number; experience_years:number|null; staff_roles:string[];
}

// ─── Particle Background ──────────────────────────────────────────────────────
const PTS=Array.from({length:16},(_,i)=>({id:i,x:(Math.sin(i*2.4)+1)/2*SW,y:(Math.cos(i*1.6)+1)/2*600,sz:i%7===0?1.8:i%3===0?1.1:0.6,col:i%7===0?GREEN:i%3===0?GOLD:'rgba(255,255,255,0.6)',op:0.06+i%8*0.03}));
const ParticleBg=memo(()=>(
  <View style={StyleSheet.absoluteFill} pointerEvents="none">
    <LinearGradient colors={[BG,'#051A0E',BG]} style={StyleSheet.absoluteFill}/>
    <View style={{position:'absolute',top:'10%',left:'20%',width:SW*.6,height:SW*.6,borderRadius:SW*.3,backgroundColor:'rgba(0,217,126,0.04)'}}/>
    {PTS.map(p=><View key={p.id} style={{position:'absolute',left:p.x,top:p.y,width:p.sz*2,height:p.sz*2,borderRadius:p.sz,backgroundColor:p.col,opacity:p.op}}/>)}
  </View>
));

// ─── Status config ────────────────────────────────────────────────────────────
const STATUS={
  pending:   {l:'En attente', c:T.amber,  bg:'rgba(245,158,11,0.14)', icon:'time-outline'            as const},
  accepted:  {l:'Accepté',   c:GREEN,    bg:'rgba(0,217,126,0.14)',   icon:'checkmark-circle-outline' as const},
  rejected:  {l:'Refusé',    c:T.red,    bg:'rgba(239,68,68,0.14)',   icon:'close-circle-outline'     as const},
  cancelled: {l:'Désistement',c:T.muted, bg:'rgba(255,255,255,0.06)', icon:'exit-outline'             as const},
};

// ─── Application Card ─────────────────────────────────────────────────────────
const AppCard=memo(function AppCard({
  app, index, onAccept, onReject, onChat, onEventPress,
}:{app:AppDetail;index:number;onAccept:()=>void;onReject:()=>void;onChat:()=>void;onEventPress:()=>void;}) {
  const [imgErr,setImgErr]=useState(false);
  const anim=useRef(new Animated.Value(0)).current;
  const cfg=STATUS[app.status]??STATUS.pending;
  const stars=Math.round(app.staff_rating);
  const initials=app.staff_name.trim().split(' ').map(n=>n[0]).join('').toUpperCase().slice(0,2);
  const slotsPct=app.slots>0?app.slots_filled/app.slots:0;

  useEffect(()=>{Animated.timing(anim,{toValue:1,duration:300,delay:index*50,easing:Easing.out(Easing.cubic),useNativeDriver:true}).start();},[index]);

  const timeAgo=(iso:string)=>{
    const diff=(Date.now()-new Date(iso).getTime())/1000;
    if(diff<3600) return `il y a ${Math.round(diff/60)}min`;
    if(diff<86400) return `il y a ${Math.round(diff/3600)}h`;
    return `il y a ${Math.round(diff/86400)}j`;
  };

  return(
    <Animated.View style={{opacity:anim,transform:[{translateY:anim.interpolate({inputRange:[0,1],outputRange:[16,0]})}]}}>
      <View style={ac.card}>
        <LinearGradient colors={['rgba(0,217,126,0.06)','rgba(0,217,126,0.01)']} style={StyleSheet.absoluteFillObject}/>

        {/* Event chip */}
        <TouchableOpacity style={ac.eventChip} onPress={onEventPress} activeOpacity={0.80}>
          <Ionicons name="calendar-outline" size={10} color={T.muted}/>
          <Text style={ac.eventTxt} numberOfLines={1}>{app.event_title}</Text>
          <Text style={ac.eventDate}>
            {new Date(app.date_start).toLocaleDateString('fr-FR',{day:'numeric',month:'short'})}
          </Text>
          <Ionicons name="chevron-forward" size={10} color={T.faint}/>
        </TouchableOpacity>

        {/* Staff row */}
        <View style={ac.staffRow}>
          <TouchableOpacity onPress={onChat} activeOpacity={0.88}>
            {app.staff_avatar&&!imgErr
              ?<Image source={{uri:app.staff_avatar}} style={ac.avatar} resizeMode="cover" onError={()=>setImgErr(true)}/>
              :<View style={[ac.avatar,ac.avatarFb]}><Text style={ac.avatarInit}>{initials}</Text></View>
            }
          </TouchableOpacity>
          <View style={{flex:1,gap:2}}>
            <Text style={ac.name} numberOfLines={1}>{app.staff_name}</Text>
            <Text style={ac.role}>{app.role}</Text>
            <View style={{flexDirection:'row',alignItems:'center',gap:6}}>
              <View style={{flexDirection:'row',gap:1.5}}>{[1,2,3,4,5].map(i=><Ionicons key={i} name={i<=stars?'star':'star-outline'} size={9} color={i<=stars?GOLD:T.faint}/>)}</View>
              <Text style={{color:T.muted,fontSize:9}}>{app.staff_rating.toFixed(1)} · {app.missions_count} missions</Text>
            </View>
          </View>
          <View style={{alignItems:'flex-end',gap:4}}>
            <View style={[ac.statusBadge,{backgroundColor:cfg.bg}]}>
              <Ionicons name={cfg.icon} size={9} color={cfg.c}/>
              <Text style={[ac.statusTxt,{color:cfg.c}]}>{cfg.l}</Text>
            </View>
            <Text style={ac.rate}>{app.hourly_rate}€/h</Text>
          </View>
        </View>

        {/* Slots progress */}
        <View style={{gap:4}}>
          <View style={{flexDirection:'row',justifyContent:'space-between'}}>
            <Text style={{color:T.muted,fontSize:10}}>Postes: {app.slots_filled}/{app.slots}</Text>
            <Text style={{color:GREEN,fontSize:10,fontWeight:'700'}}>{Math.round(slotsPct*100)}% rempli</Text>
          </View>
          <View style={{height:3,borderRadius:2,backgroundColor:'rgba(255,255,255,0.08)',overflow:'hidden'}}>
            <View style={{height:'100%',borderRadius:2,backgroundColor:GREEN,width:`${slotsPct*100}%` as any}}/>
          </View>
        </View>

        {/* Message */}
        {app.message&&(
          <View style={ac.messageBox}>
            <Ionicons name="chatbubble-outline" size={11} color={T.muted}/>
            <Text style={ac.messageTxt} numberOfLines={2}>"{app.message}"</Text>
          </View>
        )}

        {/* Time */}
        <Text style={ac.time}>{timeAgo(app.applied_at)}</Text>

        {/* Actions */}
        {app.status==='pending'&&(
          <View style={ac.actions}>
            <TouchableOpacity style={ac.chatBtn} onPress={onChat} activeOpacity={0.78}>
              <Ionicons name="chatbubble-outline" size={13} color={T.muted}/>
              <Text style={ac.chatTxt}>Message</Text>
            </TouchableOpacity>
            <TouchableOpacity style={ac.rejectBtn} onPress={onReject} activeOpacity={0.78}>
              <Ionicons name="close" size={14} color={T.red}/>
              <Text style={ac.rejectTxt}>Refuser</Text>
            </TouchableOpacity>
            <TouchableOpacity style={ac.acceptBtn} onPress={onAccept} activeOpacity={0.82}>
              <LinearGradient colors={['rgba(0,217,126,0.30)','rgba(0,217,126,0.15)']} style={ac.acceptGrad}>
                <Ionicons name="checkmark" size={14} color={GREEN}/>
                <Text style={ac.acceptTxt}>Accepter</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}
        {app.status==='accepted'&&(
          <View style={ac.actions}>
            <TouchableOpacity style={ac.chatBtn} onPress={onChat} activeOpacity={0.78}>
              <Ionicons name="chatbubble-outline" size={13} color={T.muted}/>
              <Text style={ac.chatTxt}>Contacter</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[ac.rejectBtn,{flex:1}]} onPress={onReject} activeOpacity={0.78}>
              <Ionicons name="exit-outline" size={13} color={T.amber}/>
              <Text style={[ac.rejectTxt,{color:T.amber}]}>Annuler la sélection</Text>
            </TouchableOpacity>
          </View>
        )}
        <View style={{position:'absolute',top:0,left:0,right:0,bottom:0,borderRadius:20,borderWidth:StyleSheet.hairlineWidth,borderColor:T.border}} pointerEvents="none"/>
      </View>
    </Animated.View>
  );
});
const ac=StyleSheet.create({
  card:       {borderRadius:20,overflow:'hidden',marginBottom:12,padding:15,gap:11,backgroundColor:T.navy},
  eventChip:  {flexDirection:'row',alignItems:'center',gap:6,paddingHorizontal:10,paddingVertical:6,borderRadius:10,backgroundColor:'rgba(255,255,255,0.04)',borderWidth:StyleSheet.hairlineWidth,borderColor:T.border,alignSelf:'flex-start'},
  eventTxt:   {color:T.muted,fontSize:10,fontWeight:'600',flex:1},
  eventDate:  {color:T.faint,fontSize:9},
  staffRow:   {flexDirection:'row',alignItems:'center',gap:12},
  avatar:     {width:52,height:52,borderRadius:26,backgroundColor:T.navy},
  avatarFb:   {alignItems:'center',justifyContent:'center',borderWidth:1.5,borderColor:T.border,backgroundColor:'rgba(0,217,126,0.08)'},
  avatarInit: {color:GREEN,fontSize:18,fontWeight:'900'},
  name:       {color:T.white,fontSize:15,fontWeight:'800',letterSpacing:-0.2},
  role:       {color:GREEN,fontSize:11,fontWeight:'600'},
  statusBadge:{flexDirection:'row',alignItems:'center',gap:3,paddingHorizontal:8,paddingVertical:4,borderRadius:10},
  statusTxt:  {fontSize:9,fontWeight:'800'},
  rate:       {color:GOLD,fontSize:14,fontWeight:'900'},
  messageBox: {flexDirection:'row',alignItems:'flex-start',gap:7,padding:10,borderRadius:12,backgroundColor:'rgba(255,255,255,0.03)',borderWidth:StyleSheet.hairlineWidth,borderColor:T.border},
  messageTxt: {color:T.muted,fontSize:11,fontStyle:'italic',lineHeight:15,flex:1},
  time:       {color:T.faint,fontSize:9},
  actions:    {flexDirection:'row',gap:8},
  chatBtn:    {flexDirection:'row',alignItems:'center',gap:5,paddingHorizontal:13,paddingVertical:9,borderRadius:12,backgroundColor:T.surf,borderWidth:StyleSheet.hairlineWidth,borderColor:T.border},
  chatTxt:    {color:T.muted,fontSize:11,fontWeight:'600'},
  rejectBtn:  {flexDirection:'row',alignItems:'center',gap:5,paddingHorizontal:13,paddingVertical:9,borderRadius:12,backgroundColor:'rgba(239,68,68,0.08)',borderWidth:StyleSheet.hairlineWidth,borderColor:'rgba(239,68,68,0.22)'},
  rejectTxt:  {color:T.red,fontSize:11,fontWeight:'700'},
  acceptBtn:  {flex:1,borderRadius:12,overflow:'hidden',borderWidth:1,borderColor:'rgba(0,217,126,0.28)'},
  acceptGrad: {flexDirection:'row',alignItems:'center',justifyContent:'center',gap:6,paddingVertical:9},
  acceptTxt:  {color:GREEN,fontSize:12,fontWeight:'900'},
});

// ─── Summary Bar ─────────────────────────────────────────────────────────────
const SummaryBar=memo(function SummaryBar({apps}:{apps:AppDetail[]}){
  const pending  = apps.filter(a=>a.status==='pending').length;
  const accepted = apps.filter(a=>a.status==='accepted').length;
  const rejected = apps.filter(a=>a.status==='rejected').length;
  return(
    <View style={sb.bar}>
      {[{v:String(pending),l:'En attente',c:T.amber},{v:String(accepted),l:'Acceptées',c:GREEN},{v:String(rejected),l:'Refusées',c:T.red},{v:String(apps.length),l:'Total',c:T.white}].map(({v,l,c},i,arr)=>(
        <React.Fragment key={l}>
          <View style={{flex:1,alignItems:'center',gap:2}}>
            <Text style={{color:c,fontSize:18,fontWeight:'900',letterSpacing:-0.5}}>{v}</Text>
            <Text style={{color:T.muted,fontSize:9,fontWeight:'600',textTransform:'uppercase',letterSpacing:0.4,textAlign:'center'}}>{l}</Text>
          </View>
          {i<arr.length-1&&<View style={{width:StyleSheet.hairlineWidth,height:24,backgroundColor:T.border}}/>}
        </React.Fragment>
      ))}
    </View>
  );
});
const sb=StyleSheet.create({
  bar:{flexDirection:'row',alignItems:'center',marginHorizontal:EDGE,marginBottom:10,padding:14,borderRadius:16,backgroundColor:T.navy,borderWidth:StyleSheet.hairlineWidth,borderColor:T.border},
});

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function ApplicationsScreen() {
  const router = useRouter();
  const [apps,    setApps]    = useState<AppDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(false);
  const [tab,     setTab]     = useState<AppStatus|'all'>('pending');
  const [filterEvt,setFilterEvt]=useState<string|null>(null);
  const rtRef=useRef<ReturnType<typeof supabase.channel>|null>(null);

  const load=useCallback(async()=>{
    try{
      const {data:{session}}=await supabase.auth.getSession();

      let query=supabase.from('v_application_details').select('*');
      if(session?.user?.id) query=query.eq('organizer_id',session.user.id);
      query=query.order('applied_at',{ascending:false});

      const {data,error}=await query;
      if(error) throw error;
      setApps((data??[]) as AppDetail[]);
    }catch(e){
      console.error('[applications]',e);
      // Fallback: query directe sans vue
      try{
        const {data:{session}}=await supabase.auth.getSession();
        if(!session) return;
        const {data:evts}=await supabase.from('events').select('id,title,date_start,date_end,location').eq('organizer_id',session.user.id);
        if(!evts?.length){setApps([]);return;}
        const evtIds=evts.map((e:any)=>e.id);
        const {data:roles}=await supabase.from('event_roles').select('id,role,hourly_rate,slots,slots_filled,event_id').in('event_id',evtIds);
        if(!roles?.length){setApps([]);return;}
        const roleIds=roles.map((r:any)=>r.id);
        const {data:rawApps}=await supabase.from('applications').select('*').in('event_role_id',roleIds).order('applied_at',{ascending:false});
        if(!rawApps?.length){setApps([]);return;}
        const staffIds=[...new Set((rawApps as any[]).map((a:any)=>a.staff_id))];
        const {data:staffRows}=await supabase.from('staff').select('id,display_name,avatar_url,rating,missions_count,experience_years,role').in('id',staffIds);
        const sm=Object.fromEntries((staffRows??[]).map((s:any)=>[s.id,s]));
        const rm=Object.fromEntries((roles as any[]).map((r:any)=>[r.id,r]));
        const em=Object.fromEntries((evts as any[]).map((e:any)=>[e.id,e]));
        setApps((rawApps as any[]).map(a=>{
          const r=rm[a.event_role_id];const st=sm[a.staff_id]??{};const ev=em[r?.event_id]??{};
          return{id:a.id,status:a.status,message:a.message,applied_at:a.applied_at,reviewed_at:a.reviewed_at,role:r?.role??'—',hourly_rate:r?.hourly_rate??0,slots:r?.slots??0,slots_filled:r?.slots_filled??0,event_id:r?.event_id??'',event_title:ev.title??'—',date_start:ev.date_start??'',date_end:ev.date_end??'',event_location:ev.location??'',staff_id:a.staff_id,staff_name:st.display_name??'Staff',staff_avatar:st.avatar_url??null,staff_rating:st.rating??0,missions_count:st.missions_count??0,experience_years:st.experience_years??null,staff_roles:st.role??[]};
        }));
      }catch(e2){console.error('[apps fallback]',e2);}
    }finally{setLoading(false);setRefresh(false);}
  },[]);

  useEffect(()=>{load();},[]);

  // Realtime
  useEffect(()=>{
    let ch:ReturnType<typeof supabase.channel>|null=null;let mounted=true;
    ch=supabase.channel('apps_realtime')
      .on('postgres_changes',{event:'*',schema:'public',table:'applications'},({eventType,new:n,old:o})=>{
        if(!mounted)return;
        if(eventType==='INSERT') load();
        if(eventType==='UPDATE'){
          const updated=n as any;
          setApps(prev=>prev.map(a=>a.id===updated.id?{...a,status:updated.status,reviewed_at:updated.reviewed_at}:a));
        }
        if(eventType==='DELETE') setApps(prev=>prev.filter(a=>a.id!==(o as any).id));
      })
      .subscribe();
    return()=>{mounted=false;if(ch)supabase.removeChannel(ch);};
  },[load]);

  // ── Optimistic update ────────────────────────────────────────────────────────
  const updateStatus=useCallback(async(id:string,status:AppStatus)=>{
    const prev=[...apps];
    setApps(a=>a.map(x=>x.id===id?{...x,status,reviewed_at:new Date().toISOString()}:x));
    try{
      const {error}=await supabase.from('applications').update({status,reviewed_at:new Date().toISOString()}).eq('id',id);
      if(error)throw error;
    }catch{setApps(prev);}
  },[apps]);

  const handleAccept=(app:AppDetail)=>{
    Alert.alert(
      '✅ Confirmer l\'acceptation',
      `Accepter ${app.staff_name} pour le poste de ${app.role} ?\n\nUn slot sera automatiquement occupé.`,
      [{text:'Annuler',style:'cancel'},{text:'Accepter',onPress:()=>updateStatus(app.id,'accepted')}]
    );
  };
  const handleReject=(app:AppDetail)=>{
    const isCancel=app.status==='accepted';
    Alert.alert(
      isCancel?'Annuler la sélection':'Refuser la candidature',
      isCancel?`Annuler la sélection de ${app.staff_name} ? Le slot sera libéré.`:`Refuser ${app.staff_name} ?`,
      [{text:'Annuler',style:'cancel'},{text:isCancel?'Annuler la sélection':'Refuser',style:'destructive',onPress:()=>updateStatus(app.id,isCancel?'cancelled':'rejected')}]
    );
  };

  const filtered=useMemo(()=>{
    let a=[...apps];
    if(tab!=='all') a=a.filter(x=>x.status===tab);
    if(filterEvt)   a=a.filter(x=>x.event_id===filterEvt);
    return a;
  },[apps,tab,filterEvt]);

  const events=useMemo(()=>[...new Map(apps.map(a=>[a.event_id,{id:a.event_id,title:a.event_title}])).values()],[apps]);

  const TABS:[AppStatus|'all',string,number][]=[
    ['all','Toutes',apps.length],
    ['pending','En attente',apps.filter(a=>a.status==='pending').length],
    ['accepted','Acceptées',apps.filter(a=>a.status==='accepted').length],
    ['rejected','Refusées',apps.filter(a=>a.status==='rejected').length],
  ];

  const renderItem=useCallback(({item,index}:{item:AppDetail;index:number})=>(
    <AppCard
      app={item} index={index}
      onAccept={()=>handleAccept(item)}
      onReject={()=>handleReject(item)}
      onChat={()=>router.push({pathname:'/(shared)/chat/[id]',params:{id:item.staff_id,name:item.staff_name}} as any)}
      onEventPress={()=>router.push({pathname:'/(organizer)/event/[id]',params:{id:item.event_id}} as any)}
    />
  ),[apps]);

  return(
    <View style={{flex:1,backgroundColor:BG}}>
      <ParticleBg/>
      <SafeAreaView edges={['top']}>
        <View style={s.header}>
          <View style={{flex:1}}>
            <Text style={s.title}>Candidatures</Text>
            <Text style={s.sub}>{loading?'Chargement…':`${apps.length} au total`}</Text>
          </View>
          <TouchableOpacity style={s.refreshBtn} onPress={()=>{setRefresh(true);load();}} activeOpacity={0.75}>
            <Ionicons name="refresh-outline" size={16} color={T.muted}/>
          </TouchableOpacity>
        </View>

        {/* Summary */}
        {!loading&&<SummaryBar apps={apps}/>}

        {/* Tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tabs}>
          {TABS.map(([k,l,n])=>(
            <TouchableOpacity key={k} style={[s.tab,tab===k&&s.tabActive]} onPress={()=>setTab(k)} activeOpacity={0.75}>
              <Text style={[s.tabTxt,tab===k&&s.tabTxtActive]}>{l}</Text>
              {n>0&&<View style={[s.tabBadge,tab===k&&s.tabBadgeActive]}>
                <Text style={[s.tabBadgeTxt,tab===k&&{color:GREEN}]}>{n}</Text>
              </View>}
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Event filter */}
        {events.length>1&&(
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.evtFilters}>
            <TouchableOpacity style={[s.evtPill,!filterEvt&&s.evtPillActive]} onPress={()=>setFilterEvt(null)} activeOpacity={0.75}>
              <Text style={[s.evtPillTxt,!filterEvt&&s.evtPillTxtActive]}>Tous</Text>
            </TouchableOpacity>
            {events.map(e=>(
              <TouchableOpacity key={e.id} style={[s.evtPill,filterEvt===e.id&&s.evtPillActive]} onPress={()=>setFilterEvt(filterEvt===e.id?null:e.id)} activeOpacity={0.75}>
                <Text style={[s.evtPillTxt,filterEvt===e.id&&s.evtPillTxtActive]} numberOfLines={1}>{e.title}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </SafeAreaView>

      {loading&&apps.length===0
        ?<View style={{flex:1,alignItems:'center',justifyContent:'center',gap:12}}>
            <ActivityIndicator color={GREEN} size="large"/>
            <Text style={{color:T.muted,fontSize:13}}>Chargement des candidatures…</Text>
          </View>
        :<FlatList
          data={filtered}
          keyExtractor={i=>`app_${i.id}`}
          renderItem={renderItem}
          contentContainerStyle={{padding:EDGE,paddingBottom:120}}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refresh} onRefresh={()=>{setRefresh(true);load();}} tintColor={GREEN}/>}
          ListEmptyComponent={
            <View style={{alignItems:'center',paddingTop:60,gap:12}}>
              <View style={{width:80,height:80,borderRadius:40,backgroundColor:'rgba(0,217,126,0.08)',alignItems:'center',justifyContent:'center',borderWidth:1,borderColor:T.border}}>
                <Ionicons name={tab==='pending'?'time-outline':'document-text-outline'} size={34} color="rgba(0,217,126,0.40)"/>
              </View>
              <Text style={{color:T.white,fontSize:16,fontWeight:'800'}}>
                {tab==='pending'?'Aucune candidature en attente':tab==='accepted'?'Aucune candidature acceptée':tab==='rejected'?'Aucune candidature refusée':'Aucune candidature'}
              </Text>
              {tab==='all'&&<TouchableOpacity style={{backgroundColor:T.greenDim,borderRadius:14,paddingHorizontal:20,paddingVertical:12,borderWidth:1,borderColor:T.borderHi}} onPress={()=>router.push('/(organizer)/create-event' as any)}>
                <Text style={{color:GREEN,fontSize:13,fontWeight:'700'}}>+ Créer une mission</Text>
              </TouchableOpacity>}
            </View>
          }
        />
      }
    </View>
  );
}

const s=StyleSheet.create({
  header:         {flexDirection:'row',alignItems:'center',paddingHorizontal:EDGE,paddingVertical:14,gap:10},
  title:          {color:T.white,fontSize:22,fontWeight:'900',letterSpacing:-0.4},
  sub:            {color:T.muted,fontSize:12,marginTop:1},
  refreshBtn:     {width:36,height:36,borderRadius:18,alignItems:'center',justifyContent:'center',backgroundColor:T.surf,borderWidth:StyleSheet.hairlineWidth,borderColor:T.border},
  tabs:           {paddingHorizontal:EDGE,paddingBottom:10,gap:8},
  tab:            {flexDirection:'row',alignItems:'center',gap:6,paddingHorizontal:14,paddingVertical:8,borderRadius:20,backgroundColor:T.surf,borderWidth:StyleSheet.hairlineWidth,borderColor:T.border},
  tabActive:      {backgroundColor:T.greenDim,borderColor:T.borderHi},
  tabTxt:         {color:T.muted,fontSize:12,fontWeight:'600'},
  tabTxtActive:   {color:GREEN,fontWeight:'800'},
  tabBadge:       {paddingHorizontal:6,paddingVertical:1,borderRadius:8,backgroundColor:'rgba(255,255,255,0.08)'},
  tabBadgeActive: {backgroundColor:'rgba(0,217,126,0.20)'},
  tabBadgeTxt:    {color:T.muted,fontSize:9,fontWeight:'700'},
  evtFilters:     {paddingHorizontal:EDGE,paddingBottom:10,gap:8},
  evtPill:        {paddingHorizontal:12,paddingVertical:6,borderRadius:16,backgroundColor:T.surf,borderWidth:StyleSheet.hairlineWidth,borderColor:T.border,maxWidth:160},
  evtPillActive:  {backgroundColor:T.greenDim,borderColor:T.borderHi},
  evtPillTxt:     {color:T.muted,fontSize:11,fontWeight:'500'},
  evtPillTxtActive:{color:GREEN,fontWeight:'700'},
});