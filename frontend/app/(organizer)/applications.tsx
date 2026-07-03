/**
 * app/(organizer)/applications.tsx — EVENTURE v2
 * Même ADN visuel que dashboard.tsx :
 *   ParticleBg · palette T · Card · Counter · LiveDot · AlertBar
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
import { useRouter }      from 'expo-router';
import { supabase }       from '@/lib/supabase';
import { getCurrentOrganizerId } from '@/services/api';

/* ─── Palette (identique dashboard) ───────────────────────────────────── */
const { width: SW, height: SH } = Dimensions.get('window');
const BG    = '#020A06';
const GREEN = '#00D97E';
const GOLD  = '#F5C842';
const EDGE  = 20;

const T = {
  white   : '#FFFFFF',
  muted   : 'rgba(255,255,255,0.50)',
  faint   : 'rgba(255,255,255,0.14)',
  surf    : 'rgba(255,255,255,0.045)',
  border  : 'rgba(0,217,126,0.12)',
  borderHi: 'rgba(0,217,126,0.30)',
  greenDim: 'rgba(0,217,126,0.12)',
  goldDim : 'rgba(245,200,66,0.12)',
  navy    : '#0A2218',
  amber   : '#F59E0B',
  red     : '#EF4444',
  blue    : '#60A5FA',
  purple  : '#A78BFA',
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
}

/* ─── Status config ────────────────────────────────────────────────────── */
const SV: Record<AppStatus,{l:string;c:string;bg:string;border:string;icon:React.ComponentProps<typeof Ionicons>['name']}> = {
  pending  : {l:'En attente',  c:T.amber, bg:'rgba(245,158,11,0.10)',  border:'rgba(245,158,11,0.22)',  icon:'time-outline'},
  accepted : {l:'Accepté',     c:GREEN,   bg:'rgba(0,217,126,0.10)',   border:'rgba(0,217,126,0.22)',   icon:'checkmark-circle-outline'},
  rejected : {l:'Refusé',      c:T.red,   bg:'rgba(239,68,68,0.10)',   border:'rgba(239,68,68,0.22)',   icon:'close-circle-outline'},
  cancelled: {l:'Désistement', c:T.muted, bg:'rgba(255,255,255,0.05)', border:'rgba(255,255,255,0.12)', icon:'exit-outline'},
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

/* ─── Particle Background (identique dashboard) ────────────────────────── */
const rnd=(a:number,b:number)=>a+Math.random()*(b-a);
const PCOLS=['#00D97E','rgba(0,217,126,0.4)','#F5C842','rgba(245,200,66,0.32)','rgba(255,255,255,0.16)'];
const PTS=Array.from({length:20},(_,i)=>({id:i,x:rnd(0,SW),y:rnd(0,800),sz:rnd(0.8,2.6),col:PCOLS[i%PCOLS.length],op:0.04+(i%6)*0.03}));
const ParticleBg=memo(()=>(
  <View style={StyleSheet.absoluteFill} pointerEvents="none">
    <LinearGradient colors={[BG,'#041208',BG]} style={StyleSheet.absoluteFill}/>
    <View style={{position:'absolute',top:'7%',left:'10%',width:SW*.72,height:SW*.72,borderRadius:SW*.36,backgroundColor:'rgba(0,217,126,0.025)'}}/>
    <View style={{position:'absolute',bottom:'8%',right:'-18%',width:SW*.6,height:SW*.6,borderRadius:SW*.3,backgroundColor:'rgba(245,200,66,0.02)'}}/>
    {PTS.map(p=><View key={p.id} style={{position:'absolute',left:p.x,top:p.y,width:p.sz,height:p.sz,borderRadius:p.sz/2,backgroundColor:p.col,opacity:p.op}}/>)}
  </View>
));

/* ─── Card Shell (identique dashboard) ────────────────────────────────── */
const Card=memo(({children,style,glow=GREEN}:{children:React.ReactNode;style?:any;glow?:string})=>(
  <View style={[cs.card,style]}>
    <LinearGradient colors={[`${glow}0B`,`${glow}03`]} style={StyleSheet.absoluteFillObject}/>
    {children}
    <View pointerEvents="none" style={cs.border}/>
  </View>
));
const cs=StyleSheet.create({
  card  :{borderRadius:20,overflow:'hidden',padding:18,gap:13,backgroundColor:T.navy},
  border:{position:'absolute',top:0,left:0,right:0,bottom:0,borderRadius:20,borderWidth:StyleSheet.hairlineWidth,borderColor:T.border},
});

/* ─── Counter animé (identique dashboard) ─────────────────────────────── */
const Counter=memo(({value,suffix='',color=T.white,size=22}:{value:number;suffix?:string;color?:string;size?:number})=>{
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

/* ─── LiveDot (identique dashboard) ───────────────────────────────────── */
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
        <Animated.View style={{position:'absolute',width:10,height:10,borderRadius:5,backgroundColor:`${GREEN}28`,transform:[{scale:p}]}}/>
        <View style={{width:6,height:6,borderRadius:3,backgroundColor:GREEN}}/>
      </View>
      <Text style={{color:GREEN,fontSize:9,fontWeight:'700',letterSpacing:0.4}}>LIVE</Text>
    </View>
  );
});

/* ─── AlertBar (identique dashboard) ──────────────────────────────────── */
const AlertBar=memo(({alerts}:{alerts:{id:string;type:string;msg:string}[]})=>{
  if(!alerts.length) return null;
  const cfg:{[k:string]:{c:string;icon:string}}={
    warning:{c:T.amber,icon:'warning-outline'},
    info   :{c:T.blue, icon:'information-circle-outline'},
    success:{c:GREEN,  icon:'checkmark-circle-outline'},
  };
  return(
    <View style={{gap:8}}>
      {alerts.slice(0,3).map(a=>{
        const{c,icon}=cfg[a.type]??cfg.info;
        return(
          <View key={a.id} style={{flexDirection:'row',alignItems:'flex-start',gap:10,padding:12,borderRadius:14,backgroundColor:`${c}0E`,borderWidth:StyleSheet.hairlineWidth,borderColor:`${c}28`}}>
            <Ionicons name={icon as any} size={15} color={c} style={{marginTop:1}}/>
            <Text style={{color:T.white,fontSize:12,flex:1,lineHeight:17}}>{a.msg}</Text>
          </View>
        );
      })}
    </View>
  );
});

/* ─── FunnelRow (identique dashboard) ─────────────────────────────────── */
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
        <Text style={{color:T.muted,fontSize:10,fontWeight:'600'}}>{label}</Text>
        <Text style={{color,fontWeight:'800',fontSize:11}}>{value}</Text>
      </View>
      <View style={{height:4,borderRadius:2,backgroundColor:T.faint,overflow:'hidden'}}>
        <Animated.View style={{position:'absolute',top:0,left:0,bottom:0,borderRadius:2,backgroundColor:color,
          width:animV.interpolate({inputRange:[0,1],outputRange:['0%','100%']}),
        }}/>
      </View>
    </View>
  );
});

/* ─── Skeleton (même style dashboard) ─────────────────────────────────── */
const SkeletonCard=memo(()=>{
  const a=useRef(new Animated.Value(0)).current;
  useEffect(()=>{
    const loop=Animated.loop(Animated.sequence([
      Animated.timing(a,{toValue:1,duration:860,useNativeDriver:true}),
      Animated.timing(a,{toValue:0,duration:860,useNativeDriver:true}),
    ]));
    loop.start(); return()=>loop.stop();
  },[]);
  const op=a.interpolate({inputRange:[0,1],outputRange:[0.25,0.6]});
  const L=({w,h,r=8}:{w:string|number;h:number;r?:number})=>(
    <Animated.View style={{width:w,height:h,borderRadius:r,backgroundColor:T.surf,opacity:op}}/>
  );
  return(
    <View style={{borderRadius:20,padding:16,marginBottom:12,gap:11,backgroundColor:T.navy}}>
      <L w="45%" h={10}/>
      <View style={{flexDirection:'row',gap:12}}>
        <Animated.View style={{width:52,height:52,borderRadius:14,backgroundColor:T.surf,opacity:op}}/>
        <View style={{flex:1,gap:8}}><L w="65%" h={14}/><L w="42%" h={10}/><L w="55%" h={9}/></View>
        <View style={{alignItems:'flex-end',gap:5}}><L w={52} h={22}/><L w={36} h={9}/></View>
      </View>
      <L w="100%" h={4} r={2}/>
      <View style={{flexDirection:'row',gap:8}}><L w={60} h={36} r={12}/><L w={60} h={36} r={12}/><L w="50%" h={36} r={12}/></View>
    </View>
  );
});

/* ─── Reject / Cancel modal ────────────────────────────────────────────── */
const ActionModal=memo(function ActionModal({app,onClose,onConfirm}:{app:AppDetail|null;onClose:()=>void;onConfirm:(r:string)=>void}){
  const slideY=useRef(new Animated.Value(SH)).current;
  const bgOp=useRef(new Animated.Value(0)).current;
  const[reason,setReason]=useState('');
  useEffect(()=>{
    if(app){
      setReason('');
      Animated.parallel([
        Animated.spring(slideY,{toValue:0,tension:65,friction:14,useNativeDriver:true}),
        Animated.timing(bgOp,{toValue:1,duration:200,useNativeDriver:true}),
      ]).start();
    }else{
      Animated.parallel([
        Animated.timing(slideY,{toValue:SH,duration:250,useNativeDriver:true}),
        Animated.timing(bgOp,{toValue:0,duration:180,useNativeDriver:true}),
      ]).start();
    }
  },[app]);
  if(!app) return null;
  const isCancel=app.status==='accepted';
  const color=isCancel?T.amber:T.red;
  return(
    <Modal transparent visible animationType="none" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS==='ios'?'padding':undefined} style={{flex:1}}>
        <Animated.View style={{flex:1,backgroundColor:'rgba(2,8,4,0.78)',opacity:bgOp}}>
          <TouchableOpacity style={{flex:1}} activeOpacity={1} onPress={()=>{Keyboard.dismiss();onClose();}}/>
        </Animated.View>
        <Animated.View style={[am.sheet,{transform:[{translateY:slideY}]}]}>
          <LinearGradient colors={['#0B2014','#041208']} style={StyleSheet.absoluteFillObject}/>
          <View style={am.handle}/>
          <View style={{flexDirection:'row',alignItems:'center',gap:14,marginBottom:20}}>
            <View style={{width:46,height:46,borderRadius:14,backgroundColor:`${color}12`,
              alignItems:'center',justifyContent:'center',borderWidth:1,borderColor:`${color}25`}}>
              <Ionicons name={isCancel?'exit-outline':'close-circle-outline'} size={22} color={color}/>
            </View>
            <View style={{flex:1}}>
              <Text style={{color:T.white,fontSize:16,fontWeight:'900'}}>
                {isCancel?'Annuler la sélection':'Refuser la candidature'}
              </Text>
              <Text style={{color:GREEN,fontSize:11,fontWeight:'600',marginTop:2}}>{app.staff_name} · {app.role}</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={14}><Ionicons name="close" size={20} color={T.muted}/></TouchableOpacity>
          </View>
          <Text style={{color:T.muted,fontSize:12,fontWeight:'600',marginBottom:10}}>
            Motif <Text style={{color:T.faint,fontWeight:'400'}}>(optionnel)</Text>
          </Text>
          <View style={{backgroundColor:T.surf,borderRadius:14,padding:14,borderWidth:StyleSheet.hairlineWidth,borderColor:T.border}}>
            <TextInput style={{color:T.white,fontSize:13,lineHeight:19,minHeight:72,textAlignVertical:'top'}}
              placeholder={isCancel?'Ex : événement annulé…':'Ex : profil ne correspond pas…'}
              placeholderTextColor={T.faint} multiline numberOfLines={3}
              value={reason} onChangeText={setReason} maxLength={300}/>
            <Text style={{color:T.faint,fontSize:10,alignSelf:'flex-end',marginTop:4}}>{reason.length}/300</Text>
          </View>
          <View style={{flexDirection:'row',gap:12,marginTop:16}}>
            <TouchableOpacity style={am.cancelBtn} onPress={onClose} activeOpacity={0.75}>
              <Text style={{color:T.muted,fontWeight:'600',fontSize:14}}>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[am.confirmBtn,{backgroundColor:`${color}12`,borderColor:`${color}30`}]}
              onPress={()=>onConfirm(reason)} activeOpacity={0.82}>
              <Ionicons name={isCancel?'exit-outline':'close-circle-outline'} size={15} color={color}/>
              <Text style={{color,fontWeight:'900',fontSize:14}}>{isCancel?'Annuler la sélection':'Refuser'}</Text>
            </TouchableOpacity>
          </View>
          <View style={{height:Platform.OS==='ios'?32:14}}/>
          <View pointerEvents="none" style={am.border}/>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
});
const am=StyleSheet.create({
  sheet    :{borderTopLeftRadius:26,borderTopRightRadius:26,overflow:'hidden',paddingHorizontal:EDGE,paddingTop:12,backgroundColor:T.navy},
  handle   :{width:36,height:4,borderRadius:2,backgroundColor:T.faint,alignSelf:'center',marginBottom:22},
  cancelBtn:{flex:1,height:52,borderRadius:14,alignItems:'center',justifyContent:'center',backgroundColor:T.surf,borderWidth:StyleSheet.hairlineWidth,borderColor:T.border},
  confirmBtn:{flex:2,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,height:52,borderRadius:14,borderWidth:1},
  border   :{position:'absolute',top:0,left:0,right:0,bottom:0,borderTopLeftRadius:26,borderTopRightRadius:26,borderWidth:StyleSheet.hairlineWidth,borderColor:T.border},
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
  const fillC = pct>=0.8?GREEN:pct>=0.4?T.amber:T.red;
  const isNew = (Date.now()-new Date(app.applied_at).getTime())<86400000 && app.status==='pending';

  return(
    <Animated.View style={{
      opacity:enter,
      transform:[{translateY:enter.interpolate({inputRange:[0,1],outputRange:[14,0]})},{scale:press}],
      marginBottom:12,
    }}>
      <TouchableOpacity style={[ac.card,{borderColor:sv.border}]}
        onPress={onEvent} onPressIn={onPI} onPressOut={onPO} activeOpacity={1}>
        {/* Status tint — même pattern que KPI cards dashboard */}
        <LinearGradient colors={[`${sv.c}0B`,`${sv.c}03`]} style={StyleSheet.absoluteFillObject}/>

        {/* ── EVENT HEADER ── */}
        <TouchableOpacity style={ac.eventRow} onPress={onEvent} activeOpacity={0.80}>
          <View style={[ac.eventIcon,{backgroundColor:`${sv.c}14`,borderColor:`${sv.c}25`}]}>
            <Ionicons name="calendar-outline" size={13} color={sv.c}/>
          </View>
          <Text style={ac.eventTxt} numberOfLines={1}>{app.event_title}</Text>
          <Text style={{color:T.muted,fontSize:10}}>{fmt(app.date_start)}</Text>
          {isNew && <View style={{width:7,height:7,borderRadius:3.5,backgroundColor:T.red,marginLeft:2}}/>}
          <Ionicons name="chevron-forward" size={11} color={T.faint}/>
        </TouchableOpacity>

        {/* ── STAFF ROW ── */}
        <View style={{flexDirection:'row',alignItems:'flex-start',gap:13}}>
          {/* Avatar */}
          <TouchableOpacity onPress={onChat} activeOpacity={0.85}>
            {app.staff_avatar&&!imgErr
              ?<Image source={{uri:app.staff_avatar}} style={ac.avatar} resizeMode="cover" onError={()=>setImgErr(true)}/>
              :<View style={[ac.avatar,ac.avatarFb]}><Text style={{color:GREEN,fontSize:18,fontWeight:'900'}}>{init}</Text></View>
            }
          </TouchableOpacity>

          {/* Info */}
          <View style={{flex:1,gap:3}}>
            <Text style={ac.name} numberOfLines={1}>{app.staff_name}</Text>
            <Text style={[ac.role,{color:sv.c}]}>{app.role}</Text>
            <View style={{flexDirection:'row',alignItems:'center',gap:5}}>
              <View style={{flexDirection:'row',gap:1.5}}>
                {[1,2,3,4,5].map(i=>(
                  <Ionicons key={i} name={i<=stars?'star':'star-outline'} size={10} color={i<=stars?GOLD:T.faint}/>
                ))}
              </View>
              <Text style={{color:GOLD,fontSize:11,fontWeight:'800'}}>{app.staff_rating.toFixed(1)}</Text>
              <Text style={{color:T.faint,fontSize:10}}>·</Text>
              <Text style={{color:T.muted,fontSize:10}}>{app.missions_count} mission{app.missions_count>1?'s':''}</Text>
              {app.experience_years!=null&&app.experience_years>0&&
                <Text style={{color:T.faint,fontSize:10}}>· {app.experience_years}ans</Text>}
            </View>
            {app.staff_bio&&app.status==='pending'&&(
              <Text style={{color:T.muted,fontSize:11,fontStyle:'italic',lineHeight:15}} numberOfLines={1}>
                {app.staff_bio}
              </Text>
            )}
          </View>

          {/* Rate + status — même style daysChip dashboard */}
          <View style={{alignItems:'flex-end',gap:5}}>
            <View style={[ac.rateChip,{backgroundColor:sv.bg,borderColor:sv.border}]}>
              <Text style={{color:sv.c,fontSize:9,fontWeight:'800'}}>{sv.l}</Text>
            </View>
            <Text style={{color:GOLD,fontSize:16,fontWeight:'900',letterSpacing:-0.4}}>
              {app.hourly_rate}<Text style={{fontSize:10,color:T.muted}}>€/h</Text>
            </Text>
            <Text style={{color:T.faint,fontSize:9}}>{ago(app.applied_at)}</Text>
          </View>
        </View>

        {/* ── Message candidat ── */}
        {app.message && (
          <View style={{padding:10,borderRadius:12,backgroundColor:T.surf,
            borderLeftWidth:2,borderLeftColor:`${sv.c}40`,
            borderWidth:StyleSheet.hairlineWidth,borderColor:T.border}}>
            <Text style={{color:T.muted,fontSize:11,fontStyle:'italic',lineHeight:16}} numberOfLines={2}>
              {app.message}
            </Text>
          </View>
        )}

        {/* ── Slots fill bar (même ProgBar que dashboard) ── */}
        <View style={{gap:5}}>
          <View style={{flexDirection:'row',justifyContent:'space-between'}}>
            <Text style={{color:T.muted,fontSize:10,fontWeight:'600'}}>
              Postes : <Text style={{color:T.white,fontWeight:'700'}}>{app.slots_filled}</Text>/{app.slots}
            </Text>
            <Text style={{color:fillC,fontSize:10,fontWeight:'800'}}>{Math.round(pct*100)}%</Text>
          </View>
          <View style={{height:4,borderRadius:2,backgroundColor:T.faint,overflow:'hidden'}}>
            <View style={{width:`${pct*100}%` as any,height:'100%',borderRadius:2,backgroundColor:fillC}}/>
          </View>
        </View>

        {/* ── ACTIONS ── */}
        {app.status==='pending' && (
          <View style={ac.actions}>
            <TouchableOpacity style={ac.msgBtn} onPress={onChat} activeOpacity={0.78}>
              <Ionicons name="chatbubble-outline" size={13} color={T.muted}/>
              <Text style={{color:T.muted,fontSize:11,fontWeight:'600'}}>Message</Text>
            </TouchableOpacity>
            <TouchableOpacity style={ac.rejectBtn} onPress={onReject} activeOpacity={0.78}>
              <Ionicons name="close" size={14} color={T.red}/>
              <Text style={{color:T.red,fontSize:11,fontWeight:'700'}}>Refuser</Text>
            </TouchableOpacity>
            <TouchableOpacity style={ac.acceptBtn} onPress={onAccept} activeOpacity={0.85}>
              <LinearGradient colors={['rgba(0,217,126,0.30)','rgba(0,217,126,0.14)']} style={ac.acceptGrad}>
                <Ionicons name="checkmark" size={14} color={GREEN}/>
                <Text style={{color:GREEN,fontSize:12,fontWeight:'900'}}>Accepter</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}
        {app.status==='accepted' && (
          <View style={ac.actions}>
            <TouchableOpacity style={ac.msgBtn} onPress={onChat} activeOpacity={0.78}>
              <Ionicons name="chatbubble-outline" size={13} color={T.muted}/>
              <Text style={{color:T.muted,fontSize:11,fontWeight:'600'}}>Contacter</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[ac.rejectBtn,{flex:1,borderColor:'rgba(245,158,11,0.25)',backgroundColor:'rgba(245,158,11,0.07)'}]}
              onPress={onReject} activeOpacity={0.78}>
              <Ionicons name="exit-outline" size={13} color={T.amber}/>
              <Text style={{color:T.amber,fontSize:11,fontWeight:'700'}}>Annuler la sélection</Text>
            </TouchableOpacity>
          </View>
        )}
        {(app.status==='rejected'||app.status==='cancelled') && (
          <View style={{flexDirection:'row',alignItems:'center',gap:6,paddingTop:2}}>
            <Ionicons name={sv.icon} size={12} color={sv.c}/>
            <Text style={{color:sv.c,fontSize:11,opacity:0.75}}>
              {app.status==='rejected'?'Candidature refusée':'Candidat désisté'}
              {app.reviewed_at?` · ${fmt(app.reviewed_at)}`:''}
            </Text>
          </View>
        )}

        <View pointerEvents="none" style={{position:'absolute',top:0,left:0,right:0,bottom:0,
          borderRadius:20,borderWidth:StyleSheet.hairlineWidth,borderColor:sv.border}}/>
      </TouchableOpacity>
    </Animated.View>
  );
});
const ac=StyleSheet.create({
  card     :{borderRadius:20,overflow:'hidden',padding:16,gap:11,backgroundColor:T.navy},
  eventRow :{flexDirection:'row',alignItems:'center',gap:7},
  eventIcon:{width:28,height:28,borderRadius:9,alignItems:'center',justifyContent:'center',borderWidth:1},
  eventTxt :{flex:1,color:T.muted,fontSize:11,fontWeight:'600'},
  avatar   :{width:52,height:52,borderRadius:14,backgroundColor:T.navy},
  avatarFb :{alignItems:'center',justifyContent:'center',backgroundColor:T.greenDim,borderWidth:1.5,borderColor:T.border},
  name     :{color:T.white,fontSize:15,fontWeight:'900',letterSpacing:-0.3},
  role     :{fontSize:11,fontWeight:'700'},
  rateChip :{paddingHorizontal:8,paddingVertical:4,borderRadius:9,borderWidth:StyleSheet.hairlineWidth},
  actions  :{flexDirection:'row',gap:8},
  msgBtn   :{flexDirection:'row',alignItems:'center',gap:5,paddingHorizontal:12,paddingVertical:9,borderRadius:12,backgroundColor:T.surf,borderWidth:StyleSheet.hairlineWidth,borderColor:T.border},
  rejectBtn:{flexDirection:'row',alignItems:'center',gap:5,paddingHorizontal:12,paddingVertical:9,borderRadius:12,backgroundColor:'rgba(239,68,68,0.07)',borderWidth:StyleSheet.hairlineWidth,borderColor:'rgba(239,68,68,0.20)'},
  acceptBtn:{flex:1,borderRadius:12,overflow:'hidden'},
  acceptGrad:{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:6,paddingVertical:9},
});

/* ─── Screen ───────────────────────────────────────────────────────────── */
export default function ApplicationsScreen() {
  const router = useRouter();

  const[apps,      setApps]      = useState<AppDetail[]>([]);
  const[loading,   setLoading]   = useState(true);
  const[refreshing,setRefreshing]= useState(false);
  const[tab,       setTab]       = useState<AppStatus|'all'>('pending');
  const[filterEvt, setFilterEvt] = useState<string|null>(null);
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
          staff_bio:st.bio??null,
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

  /* Optimistic update */
  const updateStatus=useCallback(async(id:string,status:AppStatus,reason?:string)=>{
    const snap=appsRef.current;
    setApps(prev=>prev.map(a=>a.id===id?{...a,status,reviewed_at:new Date().toISOString()}:a));
    try{
      const payload:Record<string,any>={status};
      if(reason) payload.reject_reason=reason;
      const{error}=await supabase.from('applications').update(payload).eq('id',id);
      if(error) throw error;
      load(true); // refresh pour avoir slots_filled à jour (trigger DB)
    }catch(e){console.error('[updateStatus]',e);setApps(snap);}
  },[load]);

  const handleAccept=useCallback((app:AppDetail)=>updateStatus(app.id,'accepted'),[updateStatus]);
  const handleReject=useCallback((app:AppDetail)=>setRejectTarget(app),[]);
  const handleRejectOk=useCallback((reason:string)=>{
    if(!rejectTarget) return;
    updateStatus(rejectTarget.id,rejectTarget.status==='accepted'?'cancelled':'rejected',reason);
    setRejectTarget(null);
  },[rejectTarget,updateStatus]);

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

  /* Smart alerts (même logique que dashboard) */
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
      <ParticleBg/>
      <ActionModal app={rejectTarget} onClose={()=>setRejectTarget(null)} onConfirm={handleRejectOk}/>

      <SafeAreaView edges={['top']} style={{flex:1}}>

        {/* ── NAV (même structure que dashboard) ── */}
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
            onRefresh={()=>{setRefreshing(true);load();}} tintColor={GREEN}/>}>

          {loading ? (
            <View style={{padding:EDGE,gap:12}}>
              {[0,1,2,3].map(i=><SkeletonCard key={i}/>)}
            </View>
          ) : (
            <>
              {/* ── Alerts (identique dashboard) ── */}
              {alerts.length>0&&(
                <View style={{paddingHorizontal:EDGE,paddingTop:4,marginBottom:4}}>
                  <AlertBar alerts={alerts}/>
                </View>
              )}

              {/* ── KPI STRIP (même grid que dashboard) ── */}
              <View style={ds.kpiRow}>
                {[
                  {l:'En attente',  v:pendingCount,   c:T.amber, icon:'time-outline' as const},
                  {l:'Acceptées',   v:acceptedCount,  c:GREEN,   icon:'checkmark-circle-outline' as const},
                  {l:'Taux accept.',v:acceptRate,      c:GOLD,    icon:'trending-up-outline' as const,suffix:'%'},
                  {l:'Total',       v:apps.length,    c:T.white, icon:'document-text-outline' as const},
                ].map(({l,v,c,icon,suffix})=>(
                  <View key={l} style={[ds.kpiCard,{borderColor:`${c}20`}]}>
                    <LinearGradient colors={[`${c}12`,`${c}04`]} style={StyleSheet.absoluteFillObject}/>
                    <Ionicons name={icon} size={14} color={c}/>
                    <Counter value={v} suffix={suffix??''} color={c} size={18}/>
                    <Text style={{color:T.muted,fontSize:9,fontWeight:'700',textAlign:'center',lineHeight:12}}>{l}</Text>
                    <View pointerEvents="none" style={{position:'absolute',top:0,left:0,right:0,bottom:0,borderRadius:16,borderWidth:StyleSheet.hairlineWidth,borderColor:`${c}20`}}/>
                  </View>
                ))}
              </View>

              {/* ── FUNNEL CARD (identique dashboard Invitations card) ── */}
              {apps.length>0&&(
                <View style={{paddingHorizontal:EDGE,marginBottom:14}}>
                  <Card>
                    <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center'}}>
                      <Text style={ds.cardTitle}>Entonnoir de recrutement</Text>
                      <Counter value={acceptRate} suffix="%" color={GREEN} size={22}/>
                    </View>
                    <View style={{gap:10}}>
                      <FunnelRow label="Reçues"    value={apps.length}     total={apps.length}     color={T.blue}/>
                      <FunnelRow label="En attente"value={pendingCount}    total={apps.length}     color={T.amber}/>
                      <FunnelRow label="Acceptées" value={acceptedCount}   total={apps.length}     color={GREEN}/>
                    </View>
                  </Card>
                </View>
              )}

              {/* ── STATUS TABS ── */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false}
                contentContainerStyle={{paddingHorizontal:EDGE,paddingBottom:10,gap:8}}>
                {TABS.map(([k,l,n])=>(
                  <TouchableOpacity key={k}
                    style={[ds.chip,tab===k&&{backgroundColor:T.greenDim,borderColor:T.borderHi}]}
                    onPress={()=>setTab(k)} activeOpacity={0.75}>
                    <Text style={[ds.chipTxt,tab===k&&{color:GREEN,fontWeight:'800'}]}>{l}</Text>
                    {n>0&&<Text style={{color:tab===k?GREEN:T.faint,fontSize:11,fontWeight:'700'}}> {n}</Text>}
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* ── EVENT FILTER ── */}
              {events.length>1&&(
                <ScrollView horizontal showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{paddingHorizontal:EDGE,paddingBottom:10,gap:8}}>
                  {[{id:null,title:'Tous'},...events].map(e=>(
                    <TouchableOpacity key={String(e.id)}
                      style={[ds.chip,filterEvt===e.id&&{backgroundColor:T.greenDim,borderColor:T.borderHi}]}
                      onPress={()=>setFilterEvt(e.id)} activeOpacity={0.75}>
                      {e.id&&<Ionicons name="calendar-outline" size={10} color={filterEvt===e.id?GREEN:T.faint}/>}
                      <Text style={[ds.chipTxt,filterEvt===e.id&&{color:GREEN,fontWeight:'800'}]} numberOfLines={1}>
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
                    <View style={{width:80,height:80,borderRadius:40,backgroundColor:T.greenDim,
                      alignItems:'center',justifyContent:'center',borderWidth:1,borderColor:T.border}}>
                      <Ionicons name={tab==='pending'?'time-outline':'document-text-outline'}
                        size={38} color="rgba(0,217,126,0.4)"/>
                    </View>
                    <Text style={{color:T.white,fontSize:17,fontWeight:'900',letterSpacing:-0.3}}>
                      {tab==='pending'?'Aucune candidature en attente'
                        :tab==='accepted'?'Aucune acceptée'
                        :tab==='rejected'?'Aucune refusée':'Aucune candidature'}
                    </Text>
                    <Text style={{color:T.muted,fontSize:13,textAlign:'center',lineHeight:20}}>
                      {tab==='pending'
                        ?'Les nouvelles candidatures\napparaîtront ici en temps réel.'
                        :'Changez d\'onglet pour voir\nd\'autres candidatures.'}
                    </Text>
                    {tab==='all'&&(
                      <TouchableOpacity
                        style={{paddingHorizontal:22,paddingVertical:12,borderRadius:14,
                          backgroundColor:T.greenDim,borderWidth:1,borderColor:T.borderHi}}
                        onPress={()=>router.push('/(organizer)/create-event' as any)}>
                        <Text style={{color:GREEN,fontWeight:'800',fontSize:13}}>+ Créer une mission</Text>
                      </TouchableOpacity>
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
  navLabel :{color:T.muted,fontSize:11,fontWeight:'600',letterSpacing:0.3},
  title    :{color:T.white,fontSize:22,fontWeight:'900',letterSpacing:-0.5},
  navBtn   :{width:34,height:34,borderRadius:11,alignItems:'center',justifyContent:'center',
    backgroundColor:T.surf,borderWidth:StyleSheet.hairlineWidth,borderColor:T.border},
  kpiRow   :{flexDirection:'row',gap:8,paddingHorizontal:EDGE,marginBottom:12},
  kpiCard  :{flex:1,borderRadius:16,overflow:'hidden',padding:12,gap:5,alignItems:'center',backgroundColor:T.navy},
  cardTitle:{color:T.white,fontSize:14,fontWeight:'900',letterSpacing:-0.2},
  chip     :{flexDirection:'row',alignItems:'center',gap:5,paddingHorizontal:13,paddingVertical:7,
    borderRadius:22,backgroundColor:T.surf,borderWidth:StyleSheet.hairlineWidth,borderColor:T.border},
  chipTxt  :{color:T.muted,fontSize:12,fontWeight:'600'},
});