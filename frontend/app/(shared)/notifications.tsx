/**
 * app/(shared)/notifications.tsx — EVENTURE v2
 * ADN dashboard.tsx identique : ParticleBg · Card · Counter · LiveDot
 *
 * TABLES:
 *   public.notifications  (id, organizer_id, type, title, body,
 *     read, data jsonb, created_at)  ← crée si absente via fallback
 *   Fallback synthétique depuis: applications, missions, invitations,
 *     events, messages — pour un feed riche même sans table dédiée.
 *
 * TYPES de notifications :
 *   application · accepted · rejected · payment · mission
 *   message · event · system · invitation
 *
 * REALTIME: channel unique par mount
 * INTERACTION : deep-link vers chaque écran du projet
 */
import React, {
    memo, useCallback, useEffect, useMemo, useRef, useState,
  } from 'react';
  import {
    Animated, Dimensions, Easing, FlatList,
    RefreshControl, ScrollView, StyleSheet,
    Text, TouchableOpacity, View,
  } from 'react-native';
  import { LinearGradient } from 'expo-linear-gradient';
  import { Ionicons }       from '@expo/vector-icons';
  import { SafeAreaView }   from 'react-native-safe-area-context';
  import { useRouter }      from 'expo-router';
  import { supabase }       from '@/lib/supabase';
  
  /* ─── Palette ADN dashboard ────────────────────────────────────────────── */
  const { width: SW } = Dimensions.get('window');
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
  type NotifType =
    | 'application' | 'accepted' | 'rejected'
    | 'payment'     | 'mission'  | 'message'
    | 'event'       | 'system'   | 'invitation';
  
  interface Notif {
    id        : string;
    type      : NotifType;
    title     : string;
    body      : string;
    read      : boolean;
    created_at: string;
    data      : Record<string, any>;  // { event_id, staff_id, mission_id, ... }
  }
  
  /* ─── Notif type config ─────────────────────────────────────────────────── */
  const NC: Record<NotifType, {
    icon : React.ComponentProps<typeof Ionicons>['name'];
    color: string;
    label: string;
  }> = {
    application : { icon:'document-text-outline',         color:T.blue,   label:'Candidature'  },
    accepted    : { icon:'checkmark-circle-outline',       color:GREEN,    label:'Accepté'      },
    rejected    : { icon:'close-circle-outline',           color:T.red,    label:'Refusé'       },
    payment     : { icon:'cash-outline',                   color:GOLD,     label:'Paiement'     },
    mission     : { icon:'briefcase-outline',              color:T.purple, label:'Mission'      },
    message     : { icon:'chatbubble-outline',             color:T.blue,   label:'Message'      },
    event       : { icon:'calendar-outline',               color:GREEN,    label:'Événement'    },
    system      : { icon:'information-circle-outline',     color:T.amber,  label:'Système'      },
    invitation  : { icon:'send-outline',                   color:T.amber,  label:'Invitation'   },
  };
  
  /* ─── Helpers ───────────────────────────────────────────────────────────── */
  const ago = (iso: string): string => {
    const s = (Date.now() - new Date(iso).getTime()) / 1000;
    if (s < 60)      return 'À l\'instant';
    if (s < 3600)    return `il y a ${Math.round(s / 60)}min`;
    if (s < 86400)   return `il y a ${Math.round(s / 3600)}h`;
    if (s < 604800)  return `il y a ${Math.round(s / 86400)}j`;
    return new Date(iso).toLocaleDateString('fr-FR', { day:'numeric', month:'short' });
  };
  
  /* ─── Particle Background (identique dashboard) ────────────────────────── */
  const rnd = (a: number, b: number) => a + Math.random() * (b - a);
  const PCOLS = ['#00D97E','rgba(0,217,126,0.4)','#F5C842','rgba(245,200,66,0.32)','rgba(255,255,255,0.16)'];
  const PTS   = Array.from({length:20},(_,i)=>({
    id:i, x:rnd(0,SW), y:rnd(0,880),
    sz:rnd(0.8,2.6), col:PCOLS[i%PCOLS.length], op:0.04+(i%6)*0.03,
  }));
  const ParticleBg = memo(() => (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient colors={[BG,'#041208',BG]} style={StyleSheet.absoluteFill}/>
      <View style={{position:'absolute',top:'7%',left:'10%',width:SW*.72,height:SW*.72,borderRadius:SW*.36,backgroundColor:'rgba(0,217,126,0.025)'}}/>
      <View style={{position:'absolute',bottom:'8%',right:'-18%',width:SW*.6,height:SW*.6,borderRadius:SW*.3,backgroundColor:'rgba(245,200,66,0.02)'}}/>
      {PTS.map(p=><View key={p.id} style={{position:'absolute',left:p.x,top:p.y,width:p.sz,height:p.sz,borderRadius:p.sz/2,backgroundColor:p.col,opacity:p.op}}/>)}
    </View>
  ));
  
  /* ─── Card (identique dashboard) ──────────────────────────────────────── */
  const Card = memo(({children,style,glow=GREEN}:{children:React.ReactNode;style?:any;glow?:string})=>(
    <View style={[cs.card,style]}>
      <LinearGradient colors={[`${glow}0B`,`${glow}03`]} style={StyleSheet.absoluteFillObject}/>
      {children}
      <View pointerEvents="none" style={cs.border}/>
    </View>
  ));
  const cs = StyleSheet.create({
    card  :{ borderRadius:20, overflow:'hidden', padding:18, gap:13, backgroundColor:T.navy },
    border:{ position:'absolute',top:0,left:0,right:0,bottom:0,borderRadius:20,borderWidth:StyleSheet.hairlineWidth,borderColor:T.border },
  });
  
  /* ─── Counter (identique dashboard) ────────────────────────────────────── */
  const Counter = memo(({value,color=T.white,size=26}:{value:number;color?:string;size?:number})=>{
    const anim = useRef(new Animated.Value(0)).current;
    const [txt, setTxt] = useState('0');
    useEffect(()=>{
      anim.setValue(0);
      const l = anim.addListener(({value:v})=>setTxt(String(Math.round(v))));
      Animated.timing(anim,{toValue:value,duration:850,easing:Easing.out(Easing.cubic),useNativeDriver:false}).start();
      return()=>anim.removeListener(l);
    },[value]);
    return <Text style={{color,fontSize:size,fontWeight:'900',letterSpacing:-0.5}}>{txt}</Text>;
  });
  
  /* ─── LiveDot (identique dashboard) ────────────────────────────────────── */
  const LiveDot = memo(()=>{
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
  
  /* ─── Skeleton ──────────────────────────────────────────────────────────── */
  const Skeleton = memo(()=>{
    const a = useRef(new Animated.Value(0)).current;
    useEffect(()=>{
      Animated.loop(Animated.sequence([
        Animated.timing(a,{toValue:1,duration:860,useNativeDriver:true}),
        Animated.timing(a,{toValue:0,duration:860,useNativeDriver:true}),
      ])).start();
    },[]);
    const op = a.interpolate({inputRange:[0,1],outputRange:[0.25,0.6]});
    return(
      <View style={{gap:3}}>
        {[80,90,75,85,70].map((w,i)=>(
          <Animated.View key={i} style={{
            height:72,borderRadius:16,backgroundColor:T.navy,opacity:op,marginBottom:3,
          }}>
            <View style={{flexDirection:'row',alignItems:'center',gap:12,padding:14}}>
              <Animated.View style={{width:40,height:40,borderRadius:12,backgroundColor:T.surf,opacity:op}}/>
              <View style={{flex:1,gap:7}}>
                <Animated.View style={{width:`${w}%` as any,height:12,borderRadius:6,backgroundColor:T.surf,opacity:op}}/>
                <Animated.View style={{width:'55%',height:9,borderRadius:6,backgroundColor:T.surf,opacity:op}}/>
              </View>
            </View>
          </Animated.View>
        ))}
      </View>
    );
  });
  
  /* ─── Swipe-to-delete wrapper ───────────────────────────────────────────── */
  const SwipeRow = memo(({children,onDelete}:{children:React.ReactNode;onDelete:()=>void})=>{
    const tx       = useRef(new Animated.Value(0)).current;
    const delWidth = 72;
  
    const snap = (toVal: number) =>
      Animated.spring(tx,{toValue:toVal,tension:100,friction:12,useNativeDriver:true}).start();
  
    return(
      <View style={{overflow:'hidden',borderRadius:16,marginBottom:3}}>
        {/* Delete background */}
        <View style={{
          position:'absolute',top:0,bottom:0,right:0,width:delWidth,
          backgroundColor:'rgba(239,68,68,0.18)',borderRadius:16,
          alignItems:'center',justifyContent:'center',
        }}>
          <TouchableOpacity onPress={onDelete} hitSlop={8} activeOpacity={0.75}>
            <Ionicons name="trash-outline" size={18} color={T.red}/>
          </TouchableOpacity>
        </View>
        <Animated.View style={{transform:[{translateX:tx}]}}>
          <TouchableOpacity onLongPress={()=>snap(-delWidth)} onPress={()=>snap(0)} activeOpacity={1}>
            {children}
          </TouchableOpacity>
        </Animated.View>
      </View>
    );
  });
  
  /* ─── Notification Item ─────────────────────────────────────────────────── */
  const NotifItem = memo(function NotifItem({
    n, index, onPress, onMarkRead,
  }:{
    n:Notif; index:number; onPress:()=>void; onMarkRead:()=>void;
  }){
    const enter = useRef(new Animated.Value(0)).current;
    const press = useRef(new Animated.Value(1)).current;
  
    useEffect(()=>{
      Animated.timing(enter,{
        toValue:1, duration:360,
        delay:Math.min(index*35,280),
        easing:Easing.out(Easing.cubic),
        useNativeDriver:true,
      }).start();
    },[]);
  
    const onPI = ()=>Animated.spring(press,{toValue:.972,tension:270,friction:9,useNativeDriver:true}).start();
    const onPO = ()=>Animated.spring(press,{toValue:1,  tension:220,friction:12,useNativeDriver:true}).start();
  
    const cfg = NC[n.type] ?? NC.system;
  
    return(
      <Animated.View style={{
        opacity:enter,
        transform:[
          {translateY:enter.interpolate({inputRange:[0,1],outputRange:[12,0]})},
          {scale:press},
        ],
      }}>
        <TouchableOpacity
          style={[ni.row, !n.read && ni.rowUnread]}
          onPress={()=>{ onMarkRead(); onPress(); }}
          onPressIn={onPI} onPressOut={onPO}
          activeOpacity={1}
        >
          {/* Unread accent */}
          {!n.read && <View style={[ni.accent,{backgroundColor:cfg.color}]}/>}
  
          {/* Tint gradient */}
          <LinearGradient
            colors={n.read?['transparent','transparent']:[`${cfg.color}0A`,'transparent']}
            style={StyleSheet.absoluteFillObject}
            start={{x:0,y:0}} end={{x:1,y:0}}
          />
  
          {/* Icon */}
          <View style={[ni.iconWrap,{
            backgroundColor:`${cfg.color}16`,
            borderColor:`${cfg.color}28`,
          }]}>
            <Ionicons name={cfg.icon} size={18} color={cfg.color}/>
            {!n.read && (
              <View style={[ni.unreadDot,{backgroundColor:cfg.color}]}/>
            )}
          </View>
  
          {/* Content */}
          <View style={{flex:1,gap:3}}>
            <View style={{flexDirection:'row',alignItems:'center',gap:7}}>
              <Text style={[ni.title, n.read && {color:T.muted,fontWeight:'600'}]} numberOfLines={1}>
                {n.title}
              </Text>
              <View style={[ni.typeChip,{backgroundColor:`${cfg.color}12`,borderColor:`${cfg.color}25`}]}>
                <Text style={{color:cfg.color,fontSize:8,fontWeight:'800'}}>{cfg.label}</Text>
              </View>
            </View>
            <Text style={ni.body} numberOfLines={2}>{n.body}</Text>
            <Text style={ni.time}>{ago(n.created_at)}</Text>
          </View>
  
          {/* Chevron if actionable */}
          {n.type !== 'system' && (
            <Ionicons name="chevron-forward" size={13} color={n.read?T.faint:cfg.color} style={{marginTop:2}}/>
          )}
        </TouchableOpacity>
      </Animated.View>
    );
  });
  const ni = StyleSheet.create({
    row      :{ flexDirection:'row', alignItems:'flex-start', gap:12, padding:14,
      borderRadius:16, backgroundColor:T.navy, overflow:'hidden' },
    rowUnread:{ backgroundColor:'#0C2115' },
    accent   :{ position:'absolute', left:0, top:0, bottom:0, width:3, borderRadius:1.5 },
    iconWrap :{ width:42, height:42, borderRadius:13, alignItems:'center', justifyContent:'center',
      borderWidth:StyleSheet.hairlineWidth, position:'relative' },
    unreadDot:{ position:'absolute', top:-2, right:-2, width:9, height:9, borderRadius:4.5,
      borderWidth:2, borderColor:T.navy },
    title    :{ color:T.white, fontSize:13, fontWeight:'800', letterSpacing:-0.1, flex:1 },
    body     :{ color:T.muted, fontSize:11, lineHeight:16 },
    time     :{ color:T.faint, fontSize:9, fontWeight:'600' },
    typeChip :{ paddingHorizontal:6, paddingVertical:2, borderRadius:7, borderWidth:StyleSheet.hairlineWidth },
  });
  
  /* ─── Day separator ─────────────────────────────────────────────────────── */
  const DaySep = memo(({label}:{label:string})=>(
    <View style={{flexDirection:'row',alignItems:'center',gap:10,paddingVertical:10,paddingHorizontal:2}}>
      <View style={{flex:1,height:StyleSheet.hairlineWidth,backgroundColor:T.border}}/>
      <Text style={{color:T.faint,fontSize:9,fontWeight:'700',letterSpacing:0.8}}>{label.toUpperCase()}</Text>
      <View style={{flex:1,height:StyleSheet.hairlineWidth,backgroundColor:T.border}}/>
    </View>
  ));
  
  /* ─── Screen ────────────────────────────────────────────────────────────── */
  export default function NotificationsScreen() {
    const router = useRouter();
  
    const [notifs,     setNotifs]     = useState<Notif[]>([]);
    const [loading,    setLoading]    = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [filter,     setFilter]     = useState<NotifType|'all'>('all');
  
    /* ── Deep link routing based on notification type + data ── */
    const navigate = useCallback((n: Notif) => {
      const d = n.data ?? {};
      switch(n.type) {
        case 'application':
        case 'rejected':
        case 'invitation':
          router.push('/(organizer)/applications' as any);
          break;
        case 'accepted':
        case 'payment':
        case 'mission':
          router.push('/(organizer)/missions' as any);
          break;
        case 'message':
          if(d.staff_id && d.staff_name)
            router.push({pathname:'/(shared)/chat/[id]',params:{id:d.staff_id,name:d.staff_name}} as any);
          else
            router.push('/(organizer)/applications' as any);
          break;
        case 'event':
          if(d.event_id)
            router.push({pathname:'/(organizer)/event/[id]',params:{id:d.event_id}} as any);
          else
            router.push('/(organizer)/missions' as any);
          break;
        case 'system':
        default:
          break;
      }
    },[router]);
  
    /* ── Synthetic notifications from real tables ── */
    const buildSyntheticNotifs = useCallback(async (uid: string): Promise<Notif[]> => {
      const notifs: Notif[] = [];
      const now = Date.now();
  
      try {
        // 1) New applications (pending) → type 'application'
        const { data: evts } = await supabase
          .from('events').select('id,title').eq('organizer_id',uid).limit(20);
        if(evts?.length) {
          const evtIds = evts.map((e:any)=>e.id);
          const evtMap = Object.fromEntries(evts.map((e:any)=>[e.id,e.title]));
          const { data: roles } = await supabase
            .from('event_roles').select('id,role,event_id').in('event_id',evtIds);
          if(roles?.length) {
            const roleMap = Object.fromEntries((roles as any[]).map((r:any)=>[r.id,r]));
            const { data: apps } = await supabase
              .from('applications')
              .select('id,status,applied_at,event_role_id,staff:staff_id(display_name)')
              .in('event_role_id',roles.map((r:any)=>r.id))
              .order('applied_at',{ascending:false})
              .limit(15);
            (apps??[]).forEach((a:any)=>{
              const role  = roleMap[a.event_role_id];
              const eName = role ? evtMap[role.event_id] : '—';
              const sName = a.staff?.display_name ?? 'Un talent';
              const type: NotifType =
                a.status==='accepted' ? 'accepted' :
                a.status==='rejected' ? 'rejected' : 'application';
              notifs.push({
                id:`app_${a.id}`, type,
                title: type==='application'
                  ? `Nouvelle candidature · ${eName}`
                  : type==='accepted'
                    ? `Candidature acceptée`
                    : `Candidature refusée`,
                body: type==='application'
                  ? `${sName} postule pour ${role?.role??'un poste'} — examinez son profil.`
                  : type==='accepted'
                    ? `${sName} a accepté le poste de ${role?.role??'staff'} sur "${eName}".`
                    : `${sName} a décliné la mission sur "${eName}".`,
                read: a.status!=='pending',
                created_at: a.applied_at,
                data:{ event_id:role?.event_id, staff_id:a.staff?.id, staff_name:sName },
              });
            });
          }
        }
  
        // 2) Missions with payment pending → type 'payment'
        if(evts?.length) {
          const evtIds = evts.map((e:any)=>e.id);
          const evtMap = Object.fromEntries(evts.map((e:any)=>[e.id,e.title]));
          const { data: missions } = await supabase
            .from('missions')
            .select('id,payment_status,amount_due,event_id,created_at')
            .in('event_id',evtIds)
            .eq('payment_status','pending')
            .not('amount_due','is',null)
            .order('created_at',{ascending:false})
            .limit(5);
          (missions??[]).forEach((m:any)=>{
            notifs.push({
              id:`pay_${m.id}`, type:'payment',
              title:`Paiement en attente · ${evtMap[m.event_id]??'Mission'}`,
              body:`${Number(m.amount_due).toLocaleString('fr-FR')}€ à régler pour cette mission.`,
              read:false,
              created_at:m.created_at,
              data:{ mission_id:m.id, event_id:m.event_id },
            });
          });
        }
  
        // 3) Invitations pending → type 'invitation'
        const { data: invites } = await supabase
          .from('invitations')
          .select('id,status,created_at,staff:staff_id(display_name)')
          .eq('organizer_id',uid)
          .eq('status','pending')
          .order('created_at',{ascending:false})
          .limit(5);
        (invites??[]).forEach((inv:any)=>{
          notifs.push({
            id:`inv_${inv.id}`, type:'invitation',
            title:`Invitation en attente de réponse`,
            body:`${inv.staff?.display_name??'Un talent'} n'a pas encore répondu à votre invitation.`,
            read:false,
            created_at:inv.created_at,
            data:{},
          });
        });
  
        // 4) System: welcome if no events yet
        if(!evts?.length) {
          notifs.push({
            id:'sys_welcome', type:'system',
            title:'Bienvenue sur Eventure 🎉',
            body:'Créez votre première mission pour commencer à recruter des talents événementiels.',
            read:false,
            created_at:new Date(now - 60000).toISOString(),
            data:{},
          });
        } else {
          notifs.push({
            id:'sys_tip', type:'system',
            title:'Conseil Eventure',
            body:'Complétez votre profil organisateur pour augmenter votre taux d\'acceptation.',
            read:true,
            created_at:new Date(now - 3600000*24).toISOString(),
            data:{},
          });
        }
      } catch(e) { console.error('[notifs synthetic]',e); }
  
      return notifs.sort((a,b)=>new Date(b.created_at).getTime()-new Date(a.created_at).getTime());
    },[]);
  
    /* ── Load ── */
    const load = useCallback(async(silent=false)=>{
      if(!silent) setLoading(true);
      try{
        const{data:{session}}=await supabase.auth.getSession();
        if(!session){setNotifs([]);return;}
        const uid=session.user.id;
  
        // Try dedicated notifications table first
        const{data:rows,error}=await supabase
          .from('notifications')
          .select('*')
          .eq('organizer_id',uid)
          .order('created_at',{ascending:false})
          .limit(50);
  
        if(!error && rows?.length) {
          setNotifs(rows as Notif[]);
        } else {
          // Fallback: build synthetic from real tables
          const synthetic = await buildSyntheticNotifs(uid);
          setNotifs(synthetic);
        }
      }catch(e){console.error('[notifications load]',e);}
      finally{setLoading(false);setRefreshing(false);}
    },[buildSyntheticNotifs]);
  
    useEffect(()=>{load();},[]);
  
    /* ── Realtime ── */
    useEffect(()=>{
      let mounted=true;
      const ch=supabase.channel(`notifs_rt_${Date.now()}`)
        .on('postgres_changes',{event:'INSERT',schema:'public',table:'applications'},
          ()=>{if(mounted)load(true);})
        .on('postgres_changes',{event:'UPDATE',schema:'public',table:'applications'},
          ()=>{if(mounted)load(true);})
        .on('postgres_changes',{event:'INSERT',schema:'public',table:'missions'},
          ()=>{if(mounted)load(true);})
        .on('postgres_changes',{event:'*',schema:'public',table:'notifications'},
          ()=>{if(mounted)load(true);})
        .subscribe();
      return()=>{mounted=false;supabase.removeChannel(ch);};
    },[load]);
  
    /* ── Mark single read ── */
    const markRead = useCallback((id: string)=>{
      setNotifs(prev=>prev.map(n=>n.id===id?{...n,read:true}:n));
      supabase.from('notifications').update({read:true}).eq('id',id).then(()=>{});
    },[]);
  
    /* ── Mark all read ── */
    const markAllRead = useCallback(async()=>{
      setNotifs(prev=>prev.map(n=>({...n,read:true})));
      const{data:{session}}=await supabase.auth.getSession();
      if(session)
        await supabase.from('notifications').update({read:true}).eq('organizer_id',session.user.id);
    },[]);
  
    /* ── Delete ── */
    const deleteNotif = useCallback((id: string)=>{
      setNotifs(prev=>prev.filter(n=>n.id!==id));
      supabase.from('notifications').delete().eq('id',id).then(()=>{});
    },[]);
  
    /* ── Filtered + grouped by day ── */
    const filtered = useMemo(()=>{
      if(filter==='all') return notifs;
      return notifs.filter(n=>n.type===filter);
    },[notifs,filter]);
  
    type ListItem =
      | {_type:'day';  label:string}
      | {_type:'notif';n:Notif; index:number};
  
    const listItems: ListItem[] = useMemo(()=>{
      const result:ListItem[]=[];
      let lastDay='';
      filtered.forEach((n,idx)=>{
        const d = new Date(n.created_at);
        const today    = new Date(); today.setHours(0,0,0,0);
        const yesterday= new Date(today); yesterday.setDate(today.getDate()-1);
        const nDay     = new Date(d); nDay.setHours(0,0,0,0);
        const label    = nDay>=today ? 'Aujourd\'hui'
          : nDay>=yesterday ? 'Hier'
          : d.toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'});
        if(label!==lastDay){result.push({_type:'day',label});lastDay=label;}
        result.push({_type:'notif',n,index:idx});
      });
      return result;
    },[filtered]);
  
    const unreadCount = useMemo(()=>notifs.filter(n=>!n.read).length,[notifs]);
  
    const renderItem = useCallback(({item}:{item:ListItem})=>{
      if(item._type==='day') return <DaySep label={item.label}/>;
      return(
        <SwipeRow onDelete={()=>deleteNotif(item.n.id)}>
          <NotifItem
            n={item.n} index={item.index}
            onPress={()=>navigate(item.n)}
            onMarkRead={()=>markRead(item.n.id)}
          />
        </SwipeRow>
      );
    },[navigate,markRead,deleteNotif]);
  
    const keyExtractor = useCallback((item:ListItem)=>
      item._type==='day'?`day_${item.label}`:`notif_${item.n.id}`,[]);
  
    return(
      <View style={{flex:1,backgroundColor:BG}}>
        <ParticleBg/>
        <SafeAreaView edges={['top']} style={{flex:1}}>
  
          {/* ── HEADER ── */}
          <View style={ds.nav}>
            <TouchableOpacity style={ds.navBtn} onPress={()=>router.back()} activeOpacity={0.78}>
              <Ionicons name="arrow-back" size={18} color={T.muted}/>
            </TouchableOpacity>
            <View style={{flex:1,paddingLeft:10}}>
              <Text style={ds.greet}>Centre de</Text>
              <View style={{flexDirection:'row',alignItems:'center',gap:10}}>
                <Text style={ds.title}>Notifications</Text>
                <LiveDot/>
              </View>
            </View>
            {unreadCount>0&&(
              <TouchableOpacity
                style={{paddingHorizontal:12,paddingVertical:7,borderRadius:12,
                  backgroundColor:T.greenDim,borderWidth:1,borderColor:T.borderHi}}
                onPress={markAllRead} activeOpacity={0.78}>
                <Text style={{color:GREEN,fontSize:11,fontWeight:'800'}}>Tout lire</Text>
              </TouchableOpacity>
            )}
          </View>
  
          {/* ── KPI STRIP (identique dashboard) ── */}
          {!loading&&(
            <View style={[ds.kpiRow,{paddingHorizontal:EDGE,marginBottom:12}]}>
              {[
                {l:'Non lues', v:unreadCount,                              c:GREEN,   icon:'notifications-outline'     as const},
                {l:'Candidatures',v:notifs.filter(n=>n.type==='application').length,c:T.blue,icon:'document-text-outline'as const},
                {l:'Paiements', v:notifs.filter(n=>n.type==='payment').length,c:GOLD,icon:'cash-outline'             as const},
                {l:'Total',     v:notifs.length,                           c:T.muted, icon:'layers-outline'            as const},
              ].map(({l,v,c,icon})=>(
                <View key={l} style={[ds.kpiCard,{borderColor:`${c}20`}]}>
                  <LinearGradient colors={[`${c}12`,`${c}04`]} style={StyleSheet.absoluteFillObject}/>
                  <Ionicons name={icon} size={14} color={c}/>
                  <Counter value={v} color={c} size={18}/>
                  <Text style={{color:T.muted,fontSize:9,fontWeight:'700',textAlign:'center',lineHeight:12}}>{l}</Text>
                  <View pointerEvents="none" style={{position:'absolute',top:0,left:0,right:0,bottom:0,borderRadius:16,borderWidth:StyleSheet.hairlineWidth,borderColor:`${c}20`}}/>
                </View>
              ))}
            </View>
          )}
  
     
  
          {/* ── LIST ── */}
          {loading ? (
            <ScrollView contentContainerStyle={{padding:EDGE}} showsVerticalScrollIndicator={false}>
              <Skeleton/>
            </ScrollView>
          ) : (
            <FlatList
              data={listItems}
              keyExtractor={keyExtractor}
              renderItem={renderItem}
              contentContainerStyle={{paddingHorizontal:EDGE,paddingBottom:120}}
              showsVerticalScrollIndicator={false}
              refreshControl={<RefreshControl refreshing={refreshing}
                onRefresh={()=>{setRefreshing(true);load();}} tintColor={GREEN}/>}
              ListEmptyComponent={
                <View style={{alignItems:'center',paddingTop:80,gap:14}}>
                  <View style={{width:84,height:84,borderRadius:42,backgroundColor:T.greenDim,
                    alignItems:'center',justifyContent:'center',borderWidth:1,borderColor:T.border}}>
                    <Ionicons name="notifications-outline" size={38} color="rgba(0,217,126,0.4)"/>
                  </View>
                  <Text style={{color:T.white,fontSize:17,fontWeight:'900',letterSpacing:-0.3}}>
                    Aucune notification
                  </Text>
                  <Text style={{color:T.muted,fontSize:13,textAlign:'center',lineHeight:20}}>
                    {filter==='all'
                      ?'Vos activités Eventure\napparaîtront ici en temps réel.'
                      :'Aucune notification dans cette catégorie.'}
                  </Text>
                </View>
              }
            />
          )}
        </SafeAreaView>
      </View>
    );
  }
  
  const ds = StyleSheet.create({
    nav    :{ flexDirection:'row', alignItems:'center', paddingHorizontal:EDGE, paddingVertical:12, paddingBottom:8 },
    greet  :{ color:T.muted, fontSize:11, fontWeight:'600', letterSpacing:0.2 },
    title  :{ color:T.white, fontSize:22, fontWeight:'900', letterSpacing:-0.5 },
    navBtn :{ width:38, height:38, borderRadius:12, alignItems:'center', justifyContent:'center',
      backgroundColor:T.surf, borderWidth:StyleSheet.hairlineWidth, borderColor:T.border },
    kpiRow :{ flexDirection:'row', gap:10 },
    kpiCard:{ flex:1, borderRadius:16, overflow:'hidden', padding:12, gap:5, alignItems:'center', backgroundColor:T.navy },
    chip   :{ flexDirection:'row', alignItems:'center', paddingHorizontal:13, paddingVertical:7,
      borderRadius:22, backgroundColor:T.surf, borderWidth:StyleSheet.hairlineWidth, borderColor:T.border },
    chipTxt:{ color:T.muted, fontSize:12, fontWeight:'600' },
  });