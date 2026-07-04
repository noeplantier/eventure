/**
 * app/(organizer)/applications.tsx — EVENTURE v3
 * Réaligné sur le design system Indigo Light (identique dashboard.tsx) —
 * remplace l'ancien thème sombre vert/or hérité d'avant la refonte v3.
 * Schema: public.applications (id, event_role_id, staff_id, status,
 *   message, applied_at, reject_reason, reviewed_at)
 * FK: staff_id → staff(id)  |  event_role_id → event_roles(id)
 * Triggers DB: set_reviewed_at · fn_update_slots_filled · fn_notify_application_status
 */
import React, {
  memo, useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import {
  ActivityIndicator, Animated, Dimensions, Easing,
  FlatList, Image, Keyboard, KeyboardAvoidingView,
  Modal, Platform, RefreshControl, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons }       from '@expo/vector-icons';
import { SafeAreaView }   from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase }       from '@/lib/supabase';
import { getCurrentOrganizerId } from '@/services/api';
import { acceptApplication, rejectApplication, cancelAcceptedApplication } from '@/services/recruitment';
import CenteredModal      from '@/components/CenteredModal';
import { AURA }           from '@/constants/aura-theme';
import Aura               from '@/components/Aura';

/* ─── Design tokens (Aura — dark, futuristic, professionnel) ─────────────── */
const { height: SH } = Dimensions.get('window');
const BG      = AURA.bg;
const PRIMARY = AURA.primary;
const P_LIGHT = AURA.primaryGhost;
const P_GHOST = AURA.primaryGhost;
const PURPLE  = AURA.secondary;
const SUCCESS = AURA.success;
const WARNING = AURA.warning;
const DANGER  = AURA.danger;
const BLUE    = AURA.cyan;
const EDGE    = 20;

const C = {
  text:      AURA.text,
  textSub:   AURA.textSub,
  textMuted: AURA.textMuted,
  border:    AURA.border,
  surface:   AURA.surface,
  surfaceAlt:AURA.surfaceAlt,
} as const;

/* ─── Types ────────────────────────────────────────────────────────────── */
type AppStatus = 'pending' | 'accepted' | 'rejected' | 'cancelled';
interface AppDetail {
  id            : string;
  status        : AppStatus;
  message       : string | null;
  applied_at    : string;
  reviewed_at   : string | null;
  reject_reason : string | null;
  role          : string;
  hourly_rate   : number;
  slots         : number;
  slots_filled  : number;
  event_id      : string;
  event_title   : string;
  date_start    : string;
  event_location: string;
  organizer_id  : string;
  staff_id      : string;
  staff_name    : string;
  staff_avatar  : string | null;
  staff_rating  : number;
  missions_count: number;
  experience_years: number | null;
  staff_bio     : string | null;
  event_role_id : string;
}

/* ─── Status config ────────────────────────────────────────────────────── */
const SV: Record<AppStatus,{l:string;c:string;bg:string;border:string;icon:React.ComponentProps<typeof Ionicons>['name']}> = {
  pending  : {l:'En attente',  c:WARNING, bg:AURA.warningGhost,  border:'rgba(251,191,36,0.30)',  icon:'time-outline'},
  accepted : {l:'Accepté',     c:SUCCESS, bg:AURA.successGhost,  border:'rgba(52,211,153,0.30)',  icon:'checkmark-circle-outline'},
  rejected : {l:'Refusé',      c:DANGER,  bg:AURA.dangerGhost,   border:'rgba(248,113,113,0.30)', icon:'close-circle-outline'},
  cancelled: {l:'Désistement', c:C.textMuted, bg:C.surfaceAlt,   border:C.border,                 icon:'exit-outline'},
};

/* ─── Helpers ──────────────────────────────────────────────────────────── */
const ago = (iso:string)=>{
  const s=(Date.now()-new Date(iso).getTime())/1000;
  if(s<60)    return 'À l\'instant';
  if(s<3600)  return `${Math.round(s/60)}min`;
  if(s<86400) return `${Math.round(s/3600)}h`;
  return `${Math.round(s/86400)}j`;
};
const fmt=(iso:string)=>new Date(iso).toLocaleDateString('fr-FR',{day:'numeric',month:'short'});

/* ─── Card Shell ───────────────────────────────────────────────────────── */
const Card=memo(({children,style}:{children:React.ReactNode;style?:any})=>(
  <View style={[cs.card,style]}>{children}</View>
));
const cs=StyleSheet.create({
  card:{borderRadius:20,overflow:'hidden',padding:18,gap:13,backgroundColor:C.surface,
    borderWidth:1,borderColor:C.border},
});

/* ─── Counter animé ────────────────────────────────────────────────────── */
const Counter=memo(({value,suffix='',color=C.text,size=22}:{value:number;suffix?:string;color?:string;size?:number})=>{
  const anim=useRef(new Animated.Value(0)).current;
  const[txt,setTxt]=useState(`0${suffix}`);
  useEffect(()=>{
    anim.setValue(0);
    const l=anim.addListener(({value:v})=>setTxt(`${Math.round(v)}${suffix}`));
    Animated.timing(anim,{toValue:value,duration:800,easing:Easing.out(Easing.cubic),useNativeDriver:false}).start();
    return()=>anim.removeListener(l);
  },[value]);
  return<Text style={{color,fontSize:size,fontWeight:'900',letterSpacing:-0.5}}>{txt}</Text>;
});

/* ─── LiveDot ──────────────────────────────────────────────────────────── */
const LiveDot=memo(()=>{
  const p=useRef(new Animated.Value(1)).current;
  useEffect(()=>{
    const loop=Animated.loop(Animated.sequence([
      Animated.timing(p,{toValue:1.85,duration:900,useNativeDriver:true}),
      Animated.timing(p,{toValue:1,  duration:900,useNativeDriver:true}),
    ]));
    loop.start(); return()=>loop.stop();
  },[]);
  return(
    <View style={{flexDirection:'row',alignItems:'center',gap:5}}>
      <View style={{position:'relative',width:10,height:10,alignItems:'center',justifyContent:'center'}}>
        <Animated.View style={{position:'absolute',width:10,height:10,borderRadius:5,backgroundColor:`${SUCCESS}28`,transform:[{scale:p}]}}/>
        <View style={{width:6,height:6,borderRadius:3,backgroundColor:SUCCESS}}/>
      </View>
      <Text style={{color:SUCCESS,fontSize:9,fontWeight:'700',letterSpacing:0.4}}>LIVE</Text>
    </View>
  );
});

/* ─── AlertBar ─────────────────────────────────────────────────────────── */
const AlertBar=memo(({alerts}:{alerts:{id:string;type:string;msg:string}[]})=>{
  if(!alerts.length) return null;
  const cfg:{[k:string]:{c:string;icon:string}}={
    warning:{c:WARNING,icon:'warning-outline'},
    info   :{c:BLUE,   icon:'information-circle-outline'},
    success:{c:SUCCESS,icon:'checkmark-circle-outline'},
  };
  return(
    <View style={{gap:8}}>
      {alerts.slice(0,3).map(a=>{
        const{c,icon}=cfg[a.type]??cfg.info;
        return(
          <View key={a.id} style={{flexDirection:'row',alignItems:'flex-start',gap:10,padding:12,borderRadius:14,backgroundColor:`${c}0E`,borderWidth:1,borderColor:`${c}28`}}>
            <Ionicons name={icon as any} size={15} color={c} style={{marginTop:1}}/>
            <Text style={{color:C.text,fontSize:12,flex:1,lineHeight:17}}>{a.msg}</Text>
          </View>
        );
      })}
    </View>
  );
});

/* ─── FunnelRow ────────────────────────────────────────────────────────── */
const FunnelRow=memo(({label,value,total,color}:{label:string;value:number;total:number;color:string})=>{
  const pct=total>0?Math.min(value/total,1):0;
  const animV=useRef(new Animated.Value(0)).current;
  useEffect(()=>{
    animV.setValue(0);
    Animated.timing(animV,{toValue:pct,duration:800,delay:100,easing:Easing.out(Easing.cubic),useNativeDriver:false}).start();
  },[pct]);
  return(
    <View style={{gap:3}}>
      <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center'}}>
        <Text style={{color:C.textSub,fontSize:10,fontWeight:'600'}}>{label}</Text>
        <Text style={{color,fontWeight:'800',fontSize:11}}>{value}</Text>
      </View>
      <View style={{height:4,borderRadius:2,backgroundColor:C.border,overflow:'hidden'}}>
        <Animated.View style={{position:'absolute',top:0,left:0,bottom:0,borderRadius:2,backgroundColor:color,
          width:animV.interpolate({inputRange:[0,1],outputRange:['0%','100%']}),
        }}/>
      </View>
    </View>
  );
});

/* ─── Skeleton ─────────────────────────────────────────────────────────── */
const SkeletonCard=memo(()=>{
  const a=useRef(new Animated.Value(0)).current;
  useEffect(()=>{
    const loop=Animated.loop(Animated.sequence([
      Animated.timing(a,{toValue:1,duration:860,useNativeDriver:true}),
      Animated.timing(a,{toValue:0,duration:860,useNativeDriver:true}),
    ]));
    loop.start(); return()=>loop.stop();
  },[]);
  const op=a.interpolate({inputRange:[0,1],outputRange:[0.4,0.85]});
  const L=({w,h,r=8}:{w:string|number;h:number;r?:number})=>(
    <Animated.View style={{width:w as any,height:h,borderRadius:r,backgroundColor:C.surfaceAlt,opacity:op}}/>
  );
  return(
    <View style={{borderRadius:20,padding:16,marginBottom:12,gap:11,backgroundColor:C.surface,borderWidth:1,borderColor:C.border}}>
      <L w="45%" h={10}/>
      <View style={{flexDirection:'row',gap:12}}>
        <Animated.View style={{width:52,height:52,borderRadius:14,backgroundColor:C.surfaceAlt,opacity:op}}/>
        <View style={{flex:1,gap:8}}><L w="65%" h={14}/><L w="42%" h={10}/><L w="55%" h={9}/></View>
        <View style={{alignItems:'flex-end',gap:5}}><L w={52} h={22}/><L w={36} h={9}/></View>
      </View>
      <L w="100%" h={4} r={2}/>
      <View style={{flexDirection:'row',gap:8}}><L w={60} h={36} r={12}/><L w={60} h={36} r={12}/><L w="50%" h={36} r={12}/></View>
    </View>
  );
});

/* ─── Reject / Cancel modal (centrée) ──────────────────────────────────── */
const ActionModal=memo(function ActionModal({app,onClose,onConfirm}:{app:AppDetail|null;onClose:()=>void;onConfirm:(r:string)=>void}){
  const[reason,setReason]=useState('');
  useEffect(()=>{ if(app) setReason(''); },[app]);
  if(!app) return null;
  const isCancel=app.status==='accepted';
  const color=isCancel?WARNING:DANGER;
  return(
    <CenteredModal visible={!!app} onClose={onClose}>
      <View style={{flexDirection:'row',alignItems:'center',gap:14,marginBottom:20}}>
        <View style={{width:46,height:46,borderRadius:14,backgroundColor:`${color}14`,
          alignItems:'center',justifyContent:'center',borderWidth:1,borderColor:`${color}28`}}>
          <Ionicons name={isCancel?'exit-outline':'close-circle-outline'} size={22} color={color}/>
        </View>
        <View style={{flex:1}}>
          <Text style={{color:C.text,fontSize:16,fontWeight:'900'}}>
            {isCancel?'Annuler la sélection':'Refuser la candidature'}
          </Text>
          <Text style={{color:PRIMARY,fontSize:11,fontWeight:'600',marginTop:2}}>{app.staff_name} · {app.role}</Text>
        </View>
        <TouchableOpacity onPress={onClose} hitSlop={14}><Ionicons name="close" size={20} color={C.textSub}/></TouchableOpacity>
      </View>
      <Text style={{color:C.textSub,fontSize:12,fontWeight:'600',marginBottom:10}}>
        Motif <Text style={{color:C.textMuted,fontWeight:'400'}}>(optionnel)</Text>
      </Text>
      <View style={{backgroundColor:C.surfaceAlt,borderRadius:14,padding:14,borderWidth:1,borderColor:C.border}}>
        <TextInput style={{color:C.text,fontSize:13,lineHeight:19,minHeight:72,textAlignVertical:'top'}}
          placeholder={isCancel?'Ex : événement annulé…':'Ex : profil ne correspond pas…'}
          placeholderTextColor={C.textMuted} multiline numberOfLines={3}
          value={reason} onChangeText={setReason} maxLength={300}/>
        <Text style={{color:C.textMuted,fontSize:10,alignSelf:'flex-end',marginTop:4}}>{reason.length}/300</Text>
      </View>
      <View style={{flexDirection:'row',gap:12,marginTop:16}}>
        <TouchableOpacity style={am.cancelBtn} onPress={onClose} activeOpacity={0.75}>
          <Text style={{color:C.textSub,fontWeight:'600',fontSize:14}}>Annuler</Text>
        </TouchableOpacity>
        <Aura color={`${color}73`} radius={14} onPress={()=>onConfirm(reason)} style={{flex:2}}>
          <View style={[am.confirmBtn,{backgroundColor:`${color}1E`,borderColor:`${color}45`}]}>
            <Ionicons name={isCancel?'exit-outline':'close-circle-outline'} size={15} color={color}/>
            <Text style={{color,fontWeight:'900',fontSize:14}}>{isCancel?'Annuler la sélection':'Refuser'}</Text>
          </View>
        </Aura>
      </View>
    </CenteredModal>
  );
});
const am=StyleSheet.create({
  cancelBtn:{flex:1,height:52,borderRadius:14,alignItems:'center',justifyContent:'center',backgroundColor:C.surfaceAlt,borderWidth:1,borderColor:C.border},
  confirmBtn:{flex:2,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,height:52,borderRadius:14,borderWidth:1},
});

/* ─── Application Card ─────────────────────────────────────────────────── */
const AppCard=memo(function AppCard({app,index,onAccept,onReject,onChat,onEvent}:{
  app:AppDetail;index:number;onAccept:()=>void;onReject:()=>void;onChat:()=>void;onEvent:()=>void;
}){
  const[imgErr,setImgErr]=useState(false);
  const enter=useRef(new Animated.Value(0)).current;
  const press=useRef(new Animated.Value(1)).current;

  useEffect(()=>{
    Animated.timing(enter,{toValue:1,duration:360,delay:Math.min(index*45,300),
      easing:Easing.out(Easing.cubic),useNativeDriver:true}).start();
  },[]);

  const onPI=()=>Animated.spring(press,{toValue:.97,tension:270,friction:9,useNativeDriver:true}).start();
  const onPO=()=>Animated.spring(press,{toValue:1, tension:220,friction:12,useNativeDriver:true}).start();

  const sv    = SV[app.status]??SV.pending;
  const stars = Math.round(app.staff_rating);
  const init  = app.staff_name.trim().split(' ').map(n=>n[0]).join('').toUpperCase().slice(0,2);
  const pct   = app.slots>0?app.slots_filled/app.slots:0;
  const fillC = pct>=0.8?SUCCESS:pct>=0.4?WARNING:DANGER;
  const isNew = (Date.now()-new Date(app.applied_at).getTime())<86400000 && app.status==='pending';

  return(
    <Animated.View style={{
      opacity:enter,
      transform:[{translateY:enter.interpolate({inputRange:[0,1],outputRange:[14,0]})},{scale:press}],
      marginBottom:12,
    }}>
      <TouchableOpacity style={[ac.card,{borderColor:sv.border}]}
        onPress={onEvent} onPressIn={onPI} onPressOut={onPO} activeOpacity={1}>

        {/* ── EVENT HEADER ── */}
        <TouchableOpacity style={ac.eventRow} onPress={onEvent} activeOpacity={0.80}>
          <View style={[ac.eventIcon,{backgroundColor:`${sv.c}14`,borderColor:`${sv.c}28`}]}>
            <Ionicons name="calendar-outline" size={13} color={sv.c}/>
          </View>
          <Text style={ac.eventTxt} numberOfLines={1}>{app.event_title}</Text>
          <Text style={{color:C.textMuted,fontSize:10}}>{fmt(app.date_start)}</Text>
          {isNew && <View style={{width:7,height:7,borderRadius:3.5,backgroundColor:DANGER,marginLeft:2}}/>}
          <Ionicons name="chevron-forward" size={11} color={C.textMuted}/>
        </TouchableOpacity>

        {/* ── STAFF ROW ── */}
        <View style={{flexDirection:'row',alignItems:'flex-start',gap:13}}>
          {/* Avatar */}
          <TouchableOpacity onPress={onChat} activeOpacity={0.85}>
            {app.staff_avatar&&!imgErr
              ?<Image source={{uri:app.staff_avatar}} style={ac.avatar} resizeMode="cover" onError={()=>setImgErr(true)}/>
              :<View style={[ac.avatar,ac.avatarFb]}><Text style={{color:PRIMARY,fontSize:18,fontWeight:'900'}}>{init}</Text></View>
            }
          </TouchableOpacity>

          {/* Info */}
          <View style={{flex:1,gap:3}}>
            <Text style={ac.name} numberOfLines={1}>{app.staff_name}</Text>
            <Text style={[ac.role,{color:sv.c}]}>{app.role}</Text>
            <View style={{flexDirection:'row',alignItems:'center',gap:5}}>
              <View style={{flexDirection:'row',gap:1.5}}>
                {[1,2,3,4,5].map(i=>(
                  <Ionicons key={i} name={i<=stars?'star':'star-outline'} size={10} color={i<=stars?WARNING:C.border}/>
                ))}
              </View>
              <Text style={{color:WARNING,fontSize:11,fontWeight:'800'}}>{app.staff_rating.toFixed(1)}</Text>
              <Text style={{color:C.textMuted,fontSize:10}}>·</Text>
              <Text style={{color:C.textSub,fontSize:10}}>{app.missions_count} mission{app.missions_count>1?'s':''}</Text>
              {app.experience_years!=null&&app.experience_years>0&&
                <Text style={{color:C.textMuted,fontSize:10}}>· {app.experience_years}ans</Text>}
            </View>
            {app.staff_bio&&app.status==='pending'&&(
              <Text style={{color:C.textSub,fontSize:11,fontStyle:'italic',lineHeight:15}} numberOfLines={1}>
                {app.staff_bio}
              </Text>
            )}
          </View>

          {/* Rate + status */}
          <View style={{alignItems:'flex-end',gap:5}}>
            <View style={[ac.rateChip,{backgroundColor:sv.bg,borderColor:sv.border}]}>
              <Text style={{color:sv.c,fontSize:9,fontWeight:'800'}}>{sv.l}</Text>
            </View>
            <Text style={{color:C.text,fontSize:16,fontWeight:'900',letterSpacing:-0.4}}>
              {app.hourly_rate}<Text style={{fontSize:10,color:C.textSub}}>€/h</Text>
            </Text>
            <Text style={{color:C.textMuted,fontSize:9}}>{ago(app.applied_at)}</Text>
          </View>
        </View>

        {/* ── Message candidat ── */}
        {app.message && (
          <View style={{padding:10,borderRadius:12,backgroundColor:C.surfaceAlt,
            borderLeftWidth:2,borderLeftColor:sv.c,
            borderWidth:1,borderColor:C.border}}>
            <Text style={{color:C.textSub,fontSize:11,fontStyle:'italic',lineHeight:16}} numberOfLines={2}>
              {app.message}
            </Text>
          </View>
        )}

        {/* ── Slots fill bar ── */}
        <View style={{gap:5}}>
          <View style={{flexDirection:'row',justifyContent:'space-between'}}>
            <Text style={{color:C.textSub,fontSize:10,fontWeight:'600'}}>
              Postes : <Text style={{color:C.text,fontWeight:'700'}}>{app.slots_filled}</Text>/{app.slots}
            </Text>
            <Text style={{color:fillC,fontSize:10,fontWeight:'800'}}>{Math.round(pct*100)}%</Text>
          </View>
          <View style={{height:4,borderRadius:2,backgroundColor:C.border,overflow:'hidden'}}>
            <View style={{width:`${pct*100}%` as any,height:'100%',borderRadius:2,backgroundColor:fillC}}/>
          </View>
        </View>

        {/* ── ACTIONS ── */}
        {app.status==='pending' && (
          <View style={ac.actions}>
            <Aura color={AURA.primaryGlow} radius={12} onPress={onChat}>
              <View style={ac.msgBtn}>
                <Ionicons name="chatbubble-outline" size={13} color={C.textSub}/>
                <Text style={{color:C.textSub,fontSize:11,fontWeight:'600'}}>Message</Text>
              </View>
            </Aura>
            <Aura color={AURA.dangerGlow} radius={12} onPress={onReject}>
              <View style={ac.rejectBtn}>
                <Ionicons name="close" size={14} color={DANGER}/>
                <Text style={{color:DANGER,fontSize:11,fontWeight:'700'}}>Refuser</Text>
              </View>
            </Aura>
            <Aura color={AURA.successGlow} radius={12} onPress={onAccept} style={{flex:1}}>
              <View style={[ac.acceptGrad,{backgroundColor:AURA.successGhost,borderWidth:1,borderColor:'rgba(52,211,153,0.35)',borderRadius:12}]}>
                <Ionicons name="checkmark" size={14} color={SUCCESS}/>
                <Text style={{color:SUCCESS,fontSize:12,fontWeight:'900'}}>Accepter</Text>
              </View>
            </Aura>
          </View>
        )}
        {app.status==='accepted' && (
          <View style={ac.actions}>
            <Aura color={AURA.primaryGlow} radius={12} onPress={onChat}>
              <View style={ac.msgBtn}>
                <Ionicons name="chatbubble-outline" size={13} color={C.textSub}/>
                <Text style={{color:C.textSub,fontSize:11,fontWeight:'600'}}>Contacter</Text>
              </View>
            </Aura>
            <Aura color={AURA.warningGlow} radius={12} onPress={onReject} style={{flex:1}}>
              <View style={[ac.rejectBtn,{borderColor:'rgba(251,191,36,0.30)',backgroundColor:AURA.warningGhost}]}>
                <Ionicons name="exit-outline" size={13} color={WARNING}/>
                <Text style={{color:WARNING,fontSize:11,fontWeight:'700'}}>Annuler la sélection</Text>
              </View>
            </Aura>
          </View>
        )}
        {(app.status==='rejected'||app.status==='cancelled') && (
          <View style={{flexDirection:'row',alignItems:'center',gap:6,paddingTop:2}}>
            <Ionicons name={sv.icon} size={12} color={sv.c}/>
            <Text style={{color:sv.c,fontSize:11,opacity:0.85}}>
              {app.status==='rejected'?'Candidature refusée':'Candidat désisté'}
              {app.reviewed_at?` · ${fmt(app.reviewed_at)}`:''}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
});
const ac=StyleSheet.create({
  card     :{borderRadius:20,overflow:'hidden',padding:16,gap:11,backgroundColor:C.surface,borderWidth:1},
  eventRow :{flexDirection:'row',alignItems:'center',gap:7},
  eventIcon:{width:28,height:28,borderRadius:9,alignItems:'center',justifyContent:'center',borderWidth:1},
  eventTxt :{flex:1,color:C.textSub,fontSize:11,fontWeight:'600'},
  avatar   :{width:52,height:52,borderRadius:14,backgroundColor:C.surfaceAlt},
  avatarFb :{alignItems:'center',justifyContent:'center',backgroundColor:P_LIGHT,borderWidth:1.5,borderColor:C.border},
  name     :{color:C.text,fontSize:15,fontWeight:'900',letterSpacing:-0.3},
  role     :{fontSize:11,fontWeight:'700'},
  rateChip :{paddingHorizontal:8,paddingVertical:4,borderRadius:9,borderWidth:1},
  actions  :{flexDirection:'row',gap:8},
  msgBtn   :{flexDirection:'row',alignItems:'center',gap:5,paddingHorizontal:12,paddingVertical:9,borderRadius:12,backgroundColor:C.surfaceAlt,borderWidth:1,borderColor:C.border},
  rejectBtn:{flexDirection:'row',alignItems:'center',gap:5,paddingHorizontal:12,paddingVertical:9,borderRadius:12,backgroundColor:AURA.dangerGhost,borderWidth:1,borderColor:'rgba(248,113,113,0.30)'},
  acceptBtn:{flex:1,borderRadius:12,overflow:'hidden'},
  acceptGrad:{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:6,paddingVertical:9},
});

/* ─── Screen ───────────────────────────────────────────────────────────── */
export default function ApplicationsScreen() {
  const router = useRouter();
  const { eventId } = useLocalSearchParams<{ eventId?: string }>();

  const[apps,      setApps]      = useState<AppDetail[]>([]);
  const[loading,   setLoading]   = useState(true);
  const[refreshing,setRefreshing]= useState(false);
  const[tab,       setTab]       = useState<AppStatus|'all'>('pending');
  const[filterEvt, setFilterEvt] = useState<string|null>(eventId ?? null);
  const[sortBy,    setSortBy]    = useState<'recent'|'rating'|'rate'>('recent');
  const[rejectTarget,setRejectTarget]=useState<AppDetail|null>(null);

  const appsRef=useRef<AppDetail[]>([]);
  useEffect(()=>{ appsRef.current=apps; },[apps]);

  /* ── Load ── */
  const load=useCallback(async(silent=false)=>{
    if(!silent) setLoading(true);
    try{
      const uid=await getCurrentOrganizerId();
      if(!uid){setApps([]);return;}

      // Essaie la vue
      const vr=await supabase.from('v_application_details').select('*')
        .eq('organizer_id',uid).order('applied_at',{ascending:false});
      if(!vr.error&&vr.data?.length){setApps(vr.data as AppDetail[]);return;}

      // Fallback joins manuels
      const{data:evts}=await supabase.from('events')
        .select('id,title,date_start,location').eq('organizer_id',uid);
      if(!evts?.length){setApps([]);return;}

      const{data:roles}=await supabase.from('event_roles')
        .select('id,role,hourly_rate,slots,slots_filled,event_id')
        .in('event_id',evts.map((e:any)=>e.id));
      if(!roles?.length){setApps([]);return;}

      const{data:rawApps}=await supabase.from('applications')
        .select('id,event_role_id,staff_id,status,message,applied_at,reviewed_at,reject_reason')
        .in('event_role_id',roles.map((r:any)=>r.id))
        .order('applied_at',{ascending:false});
      if(!rawApps?.length){setApps([]);return;}

      const staffIds=[...new Set((rawApps as any[]).map((a:any)=>a.staff_id))];
      const{data:staffRows}=await supabase.from('staff')
        .select('id,display_name,avatar_url,rating,missions_count,experience_years,bio')
        .in('id',staffIds);

      const sm=Object.fromEntries((staffRows??[]).map((s:any)=>[s.id,s]));
      const rm=Object.fromEntries((roles as any[]).map((r:any)=>[r.id,r]));
      const em=Object.fromEntries((evts as any[]).map((e:any)=>[e.id,e]));

      setApps((rawApps as any[]).map(a=>{
        const r=rm[a.event_role_id]??{};
        const st=sm[a.staff_id]??{};
        const ev=em[r.event_id]??{};
        return{
          id:a.id,status:a.status,message:a.message,
          applied_at:a.applied_at,reviewed_at:a.reviewed_at,reject_reason:a.reject_reason,
          role:r.role??'—',hourly_rate:r.hourly_rate??0,
          slots:r.slots??0,slots_filled:r.slots_filled??0,
          event_id:r.event_id??'',event_title:ev.title??'—',
          date_start:ev.date_start??'',event_location:ev.location??'',
          organizer_id:uid,
          staff_id:a.staff_id,staff_name:st.display_name??'Staff',
          staff_avatar:st.avatar_url??null,staff_rating:st.rating??0,
          missions_count:st.missions_count??0,experience_years:st.experience_years??null,
          staff_bio:st.bio??null,event_role_id:a.event_role_id,
        };
      }));
    }catch(e){console.error('[applications]',e);}
    finally{setLoading(false);setRefreshing(false);}
  },[]); // stable

  useEffect(()=>{load();},[]);

  /* Realtime */
  useEffect(()=>{
    let mounted=true;
    const ch=supabase.channel(`apps_rt_${Date.now()}`)
      .on('postgres_changes',{event:'*',schema:'public',table:'applications'},
        ({eventType,new:n,old:o})=>{
          if(!mounted) return;
          if(eventType==='INSERT') load(true);
          if(eventType==='UPDATE'){
            const u=n as any;
            setApps(prev=>prev.map(a=>a.id===u.id?{...a,status:u.status,reviewed_at:u.reviewed_at}:a));
          }
          if(eventType==='DELETE') setApps(prev=>prev.filter(a=>a.id!==(o as any).id));
        })
      .subscribe();
    return()=>{mounted=false;supabase.removeChannel(ch);};
  },[load]);

  /* Actions — logique partagée avec staff.tsx dans services/recruitment.ts */
  const handleAccept=useCallback(async(app:AppDetail)=>{
    const snap=appsRef.current;
    setApps(prev=>prev.map(a=>a.id===app.id?{...a,status:'accepted',reviewed_at:new Date().toISOString()}:a));
    try{ await acceptApplication(app); load(true); }
    catch(e){ console.error('[handleAccept]',e); setApps(snap); }
  },[load]);

  const handleReject=useCallback((app:AppDetail)=>setRejectTarget(app),[]);

  const handleRejectOk=useCallback(async(reason:string)=>{
    if(!rejectTarget) return;
    const app=rejectTarget;
    const snap=appsRef.current;
    const nextStatus=app.status==='accepted'?'cancelled':'rejected';
    setApps(prev=>prev.map(a=>a.id===app.id?{...a,status:nextStatus,reviewed_at:new Date().toISOString()}:a));
    setRejectTarget(null);
    try{
      if(nextStatus==='cancelled') await cancelAcceptedApplication(app.id,app.event_role_id,reason);
      else await rejectApplication(app.id,reason);
      load(true);
    }catch(e){ console.error('[handleRejectOk]',e); setApps(snap); }
  },[rejectTarget,load]);

  /* Filtered + sorted */
  const filtered=useMemo(()=>{
    let a=[...apps];
    if(tab!=='all')  a=a.filter(x=>x.status===tab);
    if(filterEvt)    a=a.filter(x=>x.event_id===filterEvt);
    switch(sortBy){
      case 'rating':a.sort((x,y)=>y.staff_rating-x.staff_rating);break;
      case 'rate'  :a.sort((x,y)=>y.hourly_rate -x.hourly_rate); break;
    }
    return a;
  },[apps,tab,filterEvt,sortBy]);

  const events=useMemo(()=>[...new Map(apps.map(a=>[a.event_id,{id:a.event_id,title:a.event_title}])).values()],[apps]);
  const TABS:[AppStatus|'all',string,number][]=useMemo(()=>[
    ['all',      'Toutes',     apps.length],
    ['pending',  'En attente', apps.filter(a=>a.status==='pending').length],
    ['accepted', 'Acceptées',  apps.filter(a=>a.status==='accepted').length],
    ['rejected', 'Refusées',   apps.filter(a=>a.status==='rejected').length],
  ],[apps]);

  const pendingCount=apps.filter(a=>a.status==='pending').length;
  const acceptedCount=apps.filter(a=>a.status==='accepted').length;
  const acceptRate=apps.length>0?Math.round(acceptedCount/apps.length*100):0;

  /* Smart alerts */
  const alerts=useMemo(()=>{
    const al:{id:string;type:string;msg:string}[]=[];
    if(pendingCount>0) al.push({id:'a1',type:'warning',msg:`${pendingCount} candidature${pendingCount>1?'s':''} en attente — traitez-les avant que les talents choisissent ailleurs.`});
    if(acceptRate>=70&&apps.length>=5) al.push({id:'a2',type:'success',msg:`Taux d'acceptation de ${acceptRate}% — vos missions attirent les meilleurs talents !`});
    if(acceptRate>0&&acceptRate<30&&apps.length>=5) al.push({id:'a3',type:'info',msg:`Taux d'acceptation de ${acceptRate}% — envisagez de revoir les conditions de vos missions.`});
    return al;
  },[pendingCount,acceptRate,apps.length]);

  const renderItem=useCallback(({item,index}:{item:AppDetail;index:number})=>(
    <AppCard app={item} index={index}
      onAccept={()=>handleAccept(item)} onReject={()=>handleReject(item)}
      onChat={()=>router.push({pathname:'/(shared)/chat/[id]',params:{id:item.staff_id,name:item.staff_name}} as any)}
      onEvent={()=>router.push({pathname:'/(organizer)/event/[id]',params:{id:item.event_id}} as any)}
    />
  ),[handleAccept,handleReject,router]);

  const keyExtractor=useCallback((a:AppDetail)=>`app_${a.id}`,[]);

  return(
    <View style={{flex:1,backgroundColor:BG}}>
      <ActionModal app={rejectTarget} onClose={()=>setRejectTarget(null)} onConfirm={handleRejectOk}/>

      <SafeAreaView edges={['top']} style={{flex:1}}>

        {/* ── NAV ── */}
        <View style={ds.nav}>
          <View style={{flex:1,gap:2}}>
            <Text style={ds.navLabel}>Gestion</Text>
            <View style={{flexDirection:'row',alignItems:'center',gap:10}}>
              <Text style={ds.title}>Candidatures</Text>
              <LiveDot/>
            </View>
          </View>
        </View>

        <ScrollView showsVerticalScrollIndicator={false}
          contentContainerStyle={{paddingBottom:130}}
          refreshControl={<RefreshControl refreshing={refreshing}
            onRefresh={()=>{setRefreshing(true);load();}} tintColor={PRIMARY}/>}>

          {loading ? (
            <View style={{padding:EDGE,gap:12}}>
              {[0,1,2,3].map(i=><SkeletonCard key={i}/>)}
            </View>
          ) : (
            <>
              {/* ── Alerts ── */}
              {alerts.length>0&&(
                <View style={{paddingHorizontal:EDGE,paddingTop:4,marginBottom:4}}>
                  <AlertBar alerts={alerts}/>
                </View>
              )}

              {/* ── KPI STRIP ── */}
              <View style={ds.kpiRow}>
                {[
                  {l:'En attente',  v:pendingCount,   c:WARNING, icon:'time-outline' as const},
                  {l:'Acceptées',   v:acceptedCount,  c:SUCCESS, icon:'checkmark-circle-outline' as const},
                  {l:'Taux accept.',v:acceptRate,      c:PRIMARY, icon:'trending-up-outline' as const,suffix:'%'},
                  {l:'Total',       v:apps.length,    c:C.text,  icon:'document-text-outline' as const},
                ].map(({l,v,c,icon,suffix})=>(
                  <View key={l} style={[ds.kpiCard,{borderColor:C.border}]}>
                    <Ionicons name={icon} size={14} color={c}/>
                    <Counter value={v} suffix={suffix??''} color={c} size={18}/>
                    <Text style={{color:C.textSub,fontSize:9,fontWeight:'700',textAlign:'center',lineHeight:12}}>{l}</Text>
                  </View>
                ))}
              </View>

              {/* ── FUNNEL CARD ── */}
              {apps.length>0&&(
                <View style={{paddingHorizontal:EDGE,marginBottom:14}}>
                  <Card>
                    <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center'}}>
                      <Text style={ds.cardTitle}>Entonnoir de recrutement</Text>
                      <Counter value={acceptRate} suffix="%" color={SUCCESS} size={22}/>
                    </View>
                    <View style={{gap:10}}>
                      <FunnelRow label="Reçues"    value={apps.length}     total={apps.length}     color={BLUE}/>
                      <FunnelRow label="En attente"value={pendingCount}    total={apps.length}     color={WARNING}/>
                      <FunnelRow label="Acceptées" value={acceptedCount}   total={apps.length}     color={SUCCESS}/>
                    </View>
                  </Card>
                </View>
              )}

              {/* ── STATUS TABS ── */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false}
                contentContainerStyle={{paddingHorizontal:EDGE,paddingBottom:10,gap:8}}>
                {TABS.map(([k,l,n])=>(
                  <TouchableOpacity key={k}
                    style={[ds.chip,tab===k&&{backgroundColor:P_GHOST,borderColor:AURA.primaryBorder}]}
                    onPress={()=>setTab(k)} activeOpacity={0.75}>
                    <Text style={[ds.chipTxt,tab===k&&{color:PRIMARY,fontWeight:'800'}]}>{l}</Text>
                    {n>0&&<Text style={{color:tab===k?PRIMARY:C.textMuted,fontSize:11,fontWeight:'700'}}> {n}</Text>}
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* ── EVENT FILTER ── */}
              {events.length>1&&(
                <ScrollView horizontal showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{paddingHorizontal:EDGE,paddingBottom:10,gap:8}}>
                  {[{id:null,title:'Tous'},...events].map(e=>(
                    <TouchableOpacity key={String(e.id)}
                      style={[ds.chip,filterEvt===e.id&&{backgroundColor:P_GHOST,borderColor:AURA.primaryBorder}]}
                      onPress={()=>setFilterEvt(e.id)} activeOpacity={0.75}>
                      {e.id&&<Ionicons name="calendar-outline" size={10} color={filterEvt===e.id?PRIMARY:C.textMuted}/>}
                      <Text style={[ds.chipTxt,filterEvt===e.id&&{color:PRIMARY,fontWeight:'800'}]} numberOfLines={1}>
                        {e.title}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}

              {/* ── LIST ── */}
              <View style={{paddingHorizontal:EDGE}}>
                {filtered.length===0 ? (
                  <View style={{alignItems:'center',paddingTop:72,gap:14}}>
                    <View style={{width:80,height:80,borderRadius:40,backgroundColor:P_LIGHT,
                      alignItems:'center',justifyContent:'center'}}>
                      <Ionicons name={tab==='pending'?'time-outline':'document-text-outline'}
                        size={38} color={PRIMARY}/>
                    </View>
                    <Text style={{color:C.text,fontSize:17,fontWeight:'900',letterSpacing:-0.3}}>
                      {tab==='pending'?'Aucune candidature en attente'
                        :tab==='accepted'?'Aucune acceptée'
                        :tab==='rejected'?'Aucune refusée':'Aucune candidature'}
                    </Text>
                    <Text style={{color:C.textSub,fontSize:13,textAlign:'center',lineHeight:20}}>
                      {tab==='pending'
                        ?'Les nouvelles candidatures\napparaîtront ici en temps réel.'
                        :'Changez d\'onglet pour voir\nd\'autres candidatures.'}
                    </Text>
                    {tab==='all'&&(
                      <Aura color={AURA.primaryGlow} radius={14} onPress={()=>router.push('/(organizer)/create-event' as any)}>
                        <View style={{paddingHorizontal:22,paddingVertical:12,borderRadius:14,backgroundColor:PRIMARY}}>
                          <Text style={{color:'#fff',fontWeight:'800',fontSize:13}}>+ Créer une mission</Text>
                        </View>
                      </Aura>
                    )}
                  </View>
                ) : (
                  <FlatList
                    data={filtered} keyExtractor={keyExtractor} renderItem={renderItem}
                    scrollEnabled={false}
                    ListFooterComponent={<View style={{height:16}}/>}
                  />
                )}
              </View>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

/* ─── Styles screen ────────────────────────────────────────────────────── */
const ds=StyleSheet.create({
  nav      :{flexDirection:'row',justifyContent:'space-between',alignItems:'center',
    paddingHorizontal:EDGE,paddingVertical:12,paddingBottom:8},
  navLabel :{color:C.textSub,fontSize:11,fontWeight:'600',letterSpacing:0.3},
  title    :{color:C.text,fontSize:22,fontWeight:'900',letterSpacing:-0.5},
  kpiRow   :{flexDirection:'row',gap:8,paddingHorizontal:EDGE,marginBottom:12},
  kpiCard  :{flex:1,borderRadius:16,overflow:'hidden',padding:12,gap:5,alignItems:'center',backgroundColor:C.surface,
    borderWidth:1},
  cardTitle:{color:C.text,fontSize:14,fontWeight:'900',letterSpacing:-0.2},
  chip     :{flexDirection:'row',alignItems:'center',gap:5,paddingHorizontal:13,paddingVertical:7,
    borderRadius:22,backgroundColor:C.surfaceAlt,borderWidth:1,borderColor:C.border},
  chipTxt  :{color:C.textSub,fontSize:12,fontWeight:'600'},
});
