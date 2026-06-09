/**
 * app/(organizer)/dashboard.tsx — EVENTURE v2
 * Tables: public.events · public.organizers · public.invitations · public.staff
 *
 * Architecture:
 *  - fetchDashboard() stable useCallback([]) — reads session internally
 *  - Realtime unique channel per mount — no "cannot add callbacks" error
 *  - SVG charts built inline (no react-native-svg dep issues on web)
 *  - Pull-to-refresh + auto-refresh on realtime events/invitations changes
 *  - Smart alerts derived client-side from fetched data
 */
import React, {
  memo, useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import {
  ActivityIndicator, Animated, Dimensions, Easing,
  RefreshControl, ScrollView, StyleSheet, Text,
  TouchableOpacity, View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons }       from '@expo/vector-icons';
import { SafeAreaView }   from 'react-native-safe-area-context';
import { useRouter }      from 'expo-router';
import Svg, {
  Defs, G, Line, LinearGradient as SvgGrad,
  Path, Polyline, Rect, Stop, Text as SvgText,
} from 'react-native-svg';
import { supabase } from '@/lib/supabase';

/* ─── Palette & Layout ─────────────────────────────────────────────────── */
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

/* ─── Types ─────────────────────────────────────────────────────────────── */
interface OrgProfile {
  display_name : string;
  company_name : string | null;
  avatar_url   : string | null;
  verified     : boolean;
  events_count : number;
  rating       : number;
}

interface DashEvent {
  id        : string;
  title     : string;
  date_start: string;
  location  : string;
  status    : string;
  type      : string | null;
  budget    : number;
}

interface KPIs {
  total_events    : number;
  active_events   : number;
  draft_events    : number;
  done_events     : number;
  budget_total    : number;
  invites_sent    : number;
  invites_accepted: number;
  invites_pending : number;
  acceptance_rate : number;       // 0–100
  events_this_week: number;
  events_last_week: number;
}

interface WeekBar { day: string; count: number; budget: number; }
interface AlertItem { id: string; type: 'warning' | 'info' | 'success'; msg: string; }

const EMPTY_KPIS: KPIs = {
  total_events:0, active_events:0, draft_events:0, done_events:0,
  budget_total:0, invites_sent:0, invites_accepted:0, invites_pending:0,
  acceptance_rate:0, events_this_week:0, events_last_week:0,
};

/* ─── Particle Background ───────────────────────────────────────────────── */
const rnd = (a:number, b:number) => a + Math.random()*(b-a);
const PCOLS = ['#00D97E','rgba(0,217,126,0.4)','#F5C842','rgba(245,200,66,0.32)','rgba(255,255,255,0.16)'];
const PTS = Array.from({length:20},(_,i)=>({
  id:i, x:rnd(0,SW), y:rnd(0,850),
  sz:rnd(0.8,2.6), col:PCOLS[i%PCOLS.length], op:0.04+(i%6)*0.03,
}));
const ParticleBg = memo(()=>(
  <View style={StyleSheet.absoluteFill} pointerEvents="none">
    <LinearGradient colors={[BG,'#041208',BG]} style={StyleSheet.absoluteFill}/>
    <View style={{position:'absolute',top:'7%',left:'10%',width:SW*.72,height:SW*.72,borderRadius:SW*.36,backgroundColor:'rgba(0,217,126,0.025)'}}/>
    <View style={{position:'absolute',bottom:'8%',right:'-18%',width:SW*.6,height:SW*.6,borderRadius:SW*.3,backgroundColor:'rgba(245,200,66,0.02)'}}/>
    {PTS.map(p=><View key={p.id} style={{position:'absolute',left:p.x,top:p.y,width:p.sz,height:p.sz,borderRadius:p.sz/2,backgroundColor:p.col,opacity:p.op}}/>)}
  </View>
));

/* ─── Animated Counter ──────────────────────────────────────────────────── */
const Counter = memo(({value,prefix='',suffix='',decimals=0,color=T.white,size=26}:{
  value:number;prefix?:string;suffix?:string;decimals?:number;color?:string;size?:number;
})=>{
  const anim = useRef(new Animated.Value(0)).current;
  const [txt, setTxt] = useState(`${prefix}0${suffix}`);
  useEffect(()=>{
    anim.setValue(0);
    const l = anim.addListener(({value:v})=>setTxt(`${prefix}${v.toFixed(decimals)}${suffix}`));
    Animated.timing(anim,{toValue:value,duration:850,easing:Easing.out(Easing.cubic),useNativeDriver:false}).start();
    return()=>anim.removeListener(l);
  },[value]);
  return <Text style={{color,fontSize:size,fontWeight:'900',letterSpacing:-0.5}}>{txt}</Text>;
});

/* ─── Arc Gauge ─────────────────────────────────────────────────────────── */
const ArcGauge = memo(({value,max=100,color=GREEN,size=108,label,sub}:{
  value:number;max?:number;color?:string;size?:number;label:string;sub?:string;
})=>{
  const animV = useRef(new Animated.Value(0)).current;
  const [arc, setArc] = useState(0);
  const R=size/2-11, CX=size/2, CY=size/2+6;
  const SA=215, SPAN=290;

  useEffect(()=>{
    animV.setValue(0);
    const l=animV.addListener(({value:v})=>setArc(v));
    Animated.timing(animV,{toValue:Math.min(value/max,1),duration:1050,delay:180,easing:Easing.out(Easing.cubic),useNativeDriver:false}).start();
    return()=>animV.removeListener(l);
  },[value,max]);

  const toXY=(deg:number,r:number)=>{
    const rad=((deg-90)*Math.PI)/180;
    return{x:CX+r*Math.cos(rad),y:CY+r*Math.sin(rad)};
  };
  const arc2path=(s:number,e:number,r:number)=>{
    const p1=toXY(s,r),p2=toXY(e,r);
    return`M ${p1.x} ${p1.y} A ${r} ${r} 0 ${e-s>180?1:0} 1 ${p2.x} ${p2.y}`;
  };
  const endA=SA+arc*SPAN;
  const gId=`g_${label.replace(/\s/g,'')}`;

  return(
    <View style={{alignItems:'center',gap:3}}>
      <Svg width={size} height={size*.82}>
        <Defs>
          <SvgGrad id={gId} x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={color} stopOpacity="0.35"/>
            <Stop offset="1" stopColor={color} stopOpacity="1"/>
          </SvgGrad>
        </Defs>
        <Path d={arc2path(SA,SA+SPAN,R)} fill="none" stroke={T.faint} strokeWidth={6.5} strokeLinecap="round"/>
        {arc>0.01&&<Path d={arc2path(SA,endA,R)} fill="none" stroke={`url(#${gId})`} strokeWidth={6.5} strokeLinecap="round"/>}
        <SvgText x={CX} y={CY+5} textAnchor="middle" fill={color} fontSize={size*.19} fontWeight="900">
          {Math.round(arc*max)}
        </SvgText>
        {sub&&<SvgText x={CX} y={CY+17} textAnchor="middle" fill={T.muted} fontSize={8} fontWeight="600">{sub}</SvgText>}
      </Svg>
      <Text style={{color:T.muted,fontSize:10,fontWeight:'700',textAlign:'center'}}>{label}</Text>
    </View>
  );
});

/* ─── Bar Chart (weekly) ────────────────────────────────────────────────── */
const WeekBarChart = memo(({data}:{data:WeekBar[]})=>{
  const W=SW-EDGE*2-36, H=96, PAD=20;
  const animV = useRef(new Animated.Value(0)).current;
  const [prog,setProg] = useState(0);

  useEffect(()=>{
    animV.setValue(0);
    const l=animV.addListener(({value:v})=>setProg(v));
    Animated.timing(animV,{toValue:1,duration:780,delay:250,easing:Easing.out(Easing.cubic),useNativeDriver:false}).start();
    return()=>animV.removeListener(l);
  },[data]);

  if(!data.length) return null;
  const maxV=Math.max(...data.map(d=>d.count),1);
  const n=data.length;
  const slotW=W/n;
  const bW=Math.max(Math.floor(slotW*0.52),8);

  return(
    <Svg width={W} height={H+PAD}>
      <Defs>
        <SvgGrad id="wbar" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={GREEN} stopOpacity="0.92"/>
          <Stop offset="1" stopColor={GREEN} stopOpacity="0.22"/>
        </SvgGrad>
      </Defs>
      {[0.33,0.66,1].map(f=>{
        const y=H-f*H;
        return<Line key={f} x1={0} y1={y} x2={W} y2={y} stroke={T.faint} strokeWidth={0.5} strokeDasharray="3 3"/>;
      })}
      {data.map((d,i)=>{
        const cx=i*slotW+slotW/2;
        const h=(d.count/maxV)*H*prog;
        const x=cx-bW/2;
        return(
          <G key={i}>
            <Rect x={x} y={H-h} width={bW} height={Math.max(h,1)} rx={4} fill="url(#wbar)"/>
            <SvgText x={cx} y={H+14} textAnchor="middle" fill={T.muted} fontSize={9} fontWeight="600">{d.day}</SvgText>
            {d.count>0&&prog>0.8&&(
              <SvgText x={cx} y={H-h-5} textAnchor="middle" fill={GREEN} fontSize={8} fontWeight="800">{d.count}</SvgText>
            )}
          </G>
        );
      })}
    </Svg>
  );
});

/* ─── Progress Bar ──────────────────────────────────────────────────────── */
const ProgBar = memo(({value,max,color=GREEN,label,right}:{
  value:number;max:number;color?:string;label:string;right:string;
})=>{
  const animV=useRef(new Animated.Value(0)).current;
  const pct=max>0?Math.min(value/max,1):0;
  useEffect(()=>{
    animV.setValue(0);
    Animated.timing(animV,{toValue:pct,duration:880,delay:120,easing:Easing.out(Easing.cubic),useNativeDriver:false}).start();
  },[pct]);
  return(
    <View style={{gap:5}}>
      <View style={{flexDirection:'row',justifyContent:'space-between'}}>
        <Text style={{color:T.muted,fontSize:12,fontWeight:'600'}}>{label}</Text>
        <Text style={{color,fontSize:12,fontWeight:'800'}}>{right}</Text>
      </View>
      <View style={{height:5,borderRadius:2.5,backgroundColor:T.faint,overflow:'hidden'}}>
        <Animated.View style={{
          position:'absolute',top:0,left:0,bottom:0,borderRadius:2.5,
          backgroundColor:color,
          width:animV.interpolate({inputRange:[0,1],outputRange:['0%','100%']}),
        }}/>
      </View>
    </View>
  );
});

/* ─── Funnel Bar ────────────────────────────────────────────────────────── */
const FunnelRow = memo(({label,value,total,color}:{label:string;value:number;total:number;color:string})=>{
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

/* ─── Trend Badge ───────────────────────────────────────────────────────── */
const TrendBadge = memo(({curr,prev}:{curr:number;prev:number})=>{
  if(prev===0||curr===prev) return null;
  const pct=Math.round(((curr-prev)/prev)*100);
  const up=pct>0;
  return(
    <View style={{flexDirection:'row',alignItems:'center',gap:3,paddingHorizontal:7,paddingVertical:2,borderRadius:8,
      backgroundColor:up?'rgba(0,217,126,0.12)':'rgba(239,68,68,0.12)'}}>
      <Ionicons name={up?'trending-up':'trending-down'} size={10} color={up?GREEN:T.red}/>
      <Text style={{color:up?GREEN:T.red,fontSize:9,fontWeight:'800'}}>{up?'+':''}{pct}%</Text>
    </View>
  );
});

/* ─── Pulse dot (LIVE) ──────────────────────────────────────────────────── */
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

/* ─── Card Shell ────────────────────────────────────────────────────────── */
const Card = memo(({children,style,glow=GREEN}:{children:React.ReactNode;style?:any;glow?:string})=>(
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

/* ─── Alert Bar ─────────────────────────────────────────────────────────── */
const AlertBar = memo(({alerts}:{alerts:AlertItem[]})=>{
  if(!alerts.length) return null;
  const cfg:Record<string,{c:string;icon:string}>={
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

/* ─── Skeleton ──────────────────────────────────────────────────────────── */
const Skeleton = memo(()=>{
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
    <View style={{gap:14}}>
      {/* KPI row */}
      <View style={{flexDirection:'row',gap:10}}>
        {[0,1,2,3].map(i=>(
          <Animated.View key={i} style={{flex:1,height:88,borderRadius:16,backgroundColor:T.navy,opacity:op}}/>
        ))}
      </View>
      {/* Gauge card */}
      <Animated.View style={{height:140,borderRadius:20,backgroundColor:T.navy,opacity:op}}/>
      {/* Chart card */}
      <Animated.View style={{height:170,borderRadius:20,backgroundColor:T.navy,opacity:op}}/>
      {/* Two halves */}
      <View style={{flexDirection:'row',gap:14}}>
        <Animated.View style={{flex:1,height:200,borderRadius:20,backgroundColor:T.navy,opacity:op}}/>
        <Animated.View style={{flex:1,height:200,borderRadius:20,backgroundColor:T.navy,opacity:op}}/>
      </View>
    </View>
  );
});

/* ─── EVENT TYPE colors ─────────────────────────────────────────────────── */
const TYPE_COLOR:Record<string,string>={
  'Gala':GOLD,'Festival':GREEN,'Conférence':T.blue,'Mariage':'#F472B6',
  'Séminaire':T.purple,'Soirée':T.amber,'Concert':T.red,'Sport':'#34D399',
};
const typeColor=(t:string|null)=>TYPE_COLOR[t??'']??T.muted;

/* ─── STATUS badge ──────────────────────────────────────────────────────── */
const StatusBadge = memo(({status}:{status:string})=>{
  const cfg:{[k:string]:{c:string;l:string}}={
    published:{c:GREEN,l:'En ligne'},
    draft    :{c:T.amber,l:'Brouillon'},
    done     :{c:T.faint,l:'Terminé'},
    cancelled:{c:T.red,l:'Annulé'},
  };
  const{c,l}=cfg[status]??{c:T.muted,l:status};
  return(
    <View style={{paddingHorizontal:7,paddingVertical:3,borderRadius:8,backgroundColor:`${c}18`,borderWidth:StyleSheet.hairlineWidth,borderColor:`${c}35`}}>
      <Text style={{color:c,fontSize:9,fontWeight:'800'}}>{l}</Text>
    </View>
  );
});

/* ─── SCREEN ────────────────────────────────────────────────────────────── */
export default function Dashboard() {
  const router = useRouter();

  const [org,         setOrg]         = useState<OrgProfile|null>(null);
  const [kpis,        setKpis]        = useState<KPIs>(EMPTY_KPIS);
  const [weekly,      setWeekly]      = useState<WeekBar[]>([]);
  const [recentEvts,  setRecentEvts]  = useState<DashEvent[]>([]);
  const [upcomingEvts,setUpcomingEvts]= useState<DashEvent[]>([]);
  const [alerts,      setAlerts]      = useState<AlertItem[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);
  const [lastUpdated, setLastUpdated] = useState(new Date());

  /* ── Fetch ─────────────────────────────────────────────────────────── */
  const fetchDashboard = useCallback(async()=>{
    try{
      const{data:{session}}=await supabase.auth.getSession();
      if(!session) return;
      const uid=session.user.id;

      const[orgRes,eventsRes,invitesRes]=await Promise.all([
        // Organizer profile
        supabase.from('organizers')
          .select('display_name,company_name,avatar_url,verified,events_count,rating')
          .eq('id',uid).single(),

        // All events for this organizer
        supabase.from('events')
          .select('id,title,date_start,date_end,location,status,type,budget')
          .eq('organizer_id',uid)
          .order('date_start',{ascending:false})
          .limit(60),

        // Invitations
        supabase.from('invitations')
          .select('id,status,created_at')
          .eq('organizer_id',uid)
          .gte('created_at',new Date(Date.now()-30*86400000).toISOString()),
      ]);

      const events  =(eventsRes.data ??[]) as DashEvent[];
      const invites =(invitesRes.data??[]) as any[];

      if(orgRes.data) setOrg(orgRes.data as OrgProfile);

      /* ── KPIs ── */
      const now   = new Date();
      const active= events.filter(e=>e.status==='published').length;
      const draft = events.filter(e=>e.status==='draft').length;
      const done  = events.filter(e=>e.status==='done').length;
      const budgetTotal=events.reduce((s,e)=>s+(e.budget??0),0);

      const inv_sent     =invites.length;
      const inv_accepted =invites.filter((i:any)=>i.status==='accepted').length;
      const inv_pending  =invites.filter((i:any)=>i.status==='pending').length;
      const acc_rate     =inv_sent>0?Math.round((inv_accepted/inv_sent)*100):0;

      // This week vs last (events created)
      const monday=(d:Date)=>{const c=new Date(d);c.setDate(c.getDate()-((c.getDay()+6)%7));c.setHours(0,0,0,0);return c;};
      const thisMonday=monday(now);
      const lastMonday=new Date(thisMonday);lastMonday.setDate(thisMonday.getDate()-7);
      const evtThisWeek=events.filter(e=>new Date(e.date_start)>=thisMonday).length;
      const evtLastWeek=events.filter(e=>{const d=new Date(e.date_start);return d>=lastMonday&&d<thisMonday;}).length;

      setKpis({
        total_events:events.length, active_events:active,
        draft_events:draft, done_events:done, budget_total:budgetTotal,
        invites_sent:inv_sent, invites_accepted:inv_accepted, invites_pending:inv_pending,
        acceptance_rate:acc_rate, events_this_week:evtThisWeek, events_last_week:evtLastWeek,
      });

      /* ── Weekly chart (last 7 days) ── */
      const DAYS=['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'];
      const bars:WeekBar[]=DAYS.map(d=>({day:d,count:0,budget:0}));
      events.forEach(e=>{
        const d=new Date(e.date_start);
        const idx=(d.getDay()+6)%7; // 0=Mon
        if(idx<7){bars[idx].count++;bars[idx].budget+=e.budget??0;}
      });
      setWeekly(bars);

      /* ── Recent & upcoming ── */
      const upcoming=events
        .filter(e=>new Date(e.date_start)>now&&e.status==='published')
        .slice(0,4);
      const recent=events
        .filter(e=>e.status!=='cancelled')
        .slice(0,5);
      setUpcomingEvts(upcoming);
      setRecentEvts(recent);

      /* ── Smart alerts ── */
      const al:AlertItem[]=[];
      if(inv_pending>0) al.push({id:'a1',type:'warning',msg:`${inv_pending} invitation${inv_pending>1?'s':''} en attente — relancez vos talents.`});
      if(active===0&&draft>0) al.push({id:'a2',type:'info',msg:`${draft} brouillon${draft>1?'s':''}  non publié${draft>1?'s':''}. Publiez pour recruter dès maintenant !`});
      if(acc_rate>0&&acc_rate<40&&inv_sent>=5) al.push({id:'a3',type:'info',msg:`Taux d'acceptation de ${acc_rate}% — personnalisez vos messages d'invitation.`});
      if(acc_rate>=75&&inv_sent>5) al.push({id:'a4',type:'success',msg:`Excellent taux d'acceptation (${acc_rate}%) — continuez comme ça !`});
      const soonEvent=upcoming.find(e=>{
        const diff=(new Date(e.date_start).getTime()-now.getTime())/86400000;
        return diff<3&&diff>0;
      });
      if(soonEvent) al.push({id:'a5',type:'warning',msg:`Événement "${soonEvent.title}" dans moins de 3 jours — vérifiez vos équipes !`});
      setAlerts(al);

      setLastUpdated(new Date());
    }catch(e){
      console.error('[dashboard]',e);
    }finally{
      setLoading(false);
      setRefreshing(false);
    }
  },[]); // stable — reads session internally

  useEffect(()=>{ fetchDashboard(); },[]);

  /* ── Realtime — unique channel per mount ── */
  useEffect(()=>{
    let mounted=true;
    const ch=supabase
      .channel(`dash_rt_${Date.now()}`)
      .on('postgres_changes',{event:'*',schema:'public',table:'events'},
        ()=>{ if(mounted) fetchDashboard(); })
      .on('postgres_changes',{event:'*',schema:'public',table:'invitations'},
        ()=>{ if(mounted) fetchDashboard(); })
      .subscribe();
    return()=>{ mounted=false; supabase.removeChannel(ch); };
  },[fetchDashboard]);

  /* ── Derived ── */
  const hour   = new Date().getHours();
  const greet  = hour<12?'Bonjour':hour<18?'Bon après-midi':'Bonsoir';
  const fname  = (org?.display_name??'').split(' ')[0];
  const budgetK= (kpis.budget_total/1000).toFixed(kpis.budget_total<10000?1:0);
  const lastStr= lastUpdated.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'});

  /* ── Render ── */
  return(
    <View style={{flex:1,backgroundColor:BG}}>
      <ParticleBg/>

      <SafeAreaView edges={['top']} style={{flex:1}}>

        {/* ── NAV ── */}
        <View style={ds.nav}>
          <View style={{flex:1,gap:2}}>
            <Text style={ds.greet}>{greet}{fname?`, ${fname}`:''} 👋</Text>
            <View style={{flexDirection:'row',alignItems:'center',gap:10}}>
              <Text style={ds.title}>Tableau de bord</Text>
              <LiveDot/>
            </View>
          </View>
          <View style={{flexDirection:'row',gap:9}}>
            <TouchableOpacity style={ds.navBtn} onPress={()=>router.push('/(organizer)/staff-search' as any)} activeOpacity={0.78}>
              <Ionicons name="people-outline" size={18} color={GREEN}/>
            </TouchableOpacity>
            <TouchableOpacity style={[ds.navBtn,{backgroundColor:'rgba(0,217,126,0.15)',borderColor:T.borderHi}]}
              onPress={()=>router.push('/(organizer)/create-event' as any)} activeOpacity={0.82}>
              <Ionicons name="add" size={20} color={GREEN}/>
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{paddingBottom:130,paddingHorizontal:EDGE,gap:14}}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>{setRefreshing(true);fetchDashboard();}} tintColor={GREEN}/>}
        >
          {/* Timestamp */}
          <Text style={{color:T.faint,fontSize:9,fontWeight:'600',textAlign:'right',letterSpacing:0.3}}>
            Mis à jour à {lastStr}
          </Text>

          {loading ? <Skeleton/> : (
            <>
              {/* ── Alerts ── */}
              {alerts.length>0&&<AlertBar alerts={alerts}/>}

              {/* ── KPI STRIP ── */}
              <View style={ds.kpiRow}>
                {[
                  {l:'Missions\nactives',   v:kpis.active_events,    c:GREEN,    icon:'calendar-outline' as const},
                  {l:'En\nbrouillon',       v:kpis.draft_events,     c:T.amber,  icon:'create-outline'   as const},
                  {l:'Invitations\nenvoyées',v:kpis.invites_sent,    c:T.blue,   icon:'send-outline'     as const},
                  {l:'Budget\ntotal',       v:kpis.budget_total,     c:GOLD,     icon:'cash-outline'     as const, suffix:'€', big:true},
                ].map(({l,v,c,icon,suffix,big})=>(
                  <View key={l} style={[ds.kpiCard,{borderColor:`${c}20`}]}>
                    <LinearGradient colors={[`${c}12`,`${c}04`]} style={StyleSheet.absoluteFillObject}/>
                    <Ionicons name={icon} size={15} color={c}/>
                    {big
                      ?<Text style={{color:c,fontSize:16,fontWeight:'900',letterSpacing:-0.5}}>
                          {kpis.budget_total>=1000?`${budgetK}K`:kpis.budget_total}€
                        </Text>
                      :<Counter value={v} color={c} size={22}/>
                    }
                    <Text style={{color:T.muted,fontSize:9,fontWeight:'700',textAlign:'center',lineHeight:12}}>{l}</Text>
                    <View pointerEvents="none" style={{position:'absolute',top:0,left:0,right:0,bottom:0,borderRadius:16,borderWidth:StyleSheet.hairlineWidth,borderColor:`${c}20`}}/>
                  </View>
                ))}
              </View>

              {/* ── ORG PROFILE STRIP ── */}
              {org&&(
                <Card>
                  <View style={{flexDirection:'row',alignItems:'center',gap:14}}>
                    <View style={{width:46,height:46,borderRadius:14,backgroundColor:'rgba(0,217,126,0.12)',alignItems:'center',justifyContent:'center',borderWidth:1,borderColor:T.border}}>
                      <Text style={{color:GREEN,fontSize:18,fontWeight:'900'}}>
                        {(org.display_name??'?').charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View style={{flex:1,gap:2}}>
                      <View style={{flexDirection:'row',alignItems:'center',gap:6}}>
                        <Text style={{color:T.white,fontSize:15,fontWeight:'900'}}>{org.display_name}</Text>
                        {org.verified&&<Ionicons name="shield-checkmark" size={13} color={GREEN}/>}
                      </View>
                      {org.company_name&&<Text style={{color:T.muted,fontSize:11}}>{org.company_name}</Text>}
                    </View>
                    <View style={{alignItems:'flex-end',gap:4}}>
                      <View style={{flexDirection:'row',alignItems:'center',gap:4}}>
                        <Ionicons name="star" size={11} color={GOLD}/>
                        <Text style={{color:GOLD,fontWeight:'900',fontSize:13}}>{(org.rating??0).toFixed(1)}</Text>
                      </View>
                      <Text style={{color:T.muted,fontSize:9}}>{org.events_count} événements</Text>
                    </View>
                  </View>
                  {/* Mini stats */}
                  <View style={{flexDirection:'row',gap:0,borderTopWidth:StyleSheet.hairlineWidth,borderTopColor:T.border,paddingTop:12}}>
                    {[
                      {l:'Publiées', v:kpis.active_events, c:GREEN},
                      {l:'Brouillons',v:kpis.draft_events, c:T.amber},
                      {l:'Terminées', v:kpis.done_events,  c:T.muted},
                      {l:'Total',     v:kpis.total_events, c:T.white},
                    ].map(({l,v,c},i,arr)=>(
                      <React.Fragment key={l}>
                        <View style={{flex:1,alignItems:'center',gap:2}}>
                          <Text style={{color:c,fontSize:17,fontWeight:'900'}}>{v}</Text>
                          <Text style={{color:T.faint,fontSize:9,fontWeight:'600'}}>{l}</Text>
                        </View>
                        {i<arr.length-1&&<View style={{width:StyleSheet.hairlineWidth,backgroundColor:T.border}}/>}
                      </React.Fragment>
                    ))}
                  </View>
                </Card>
              )}


              {/* ── WEEKLY CHART ── */}
              <Card>
                <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center'}}>
                  <Text style={ds.cardTitle}>Répartition des missions</Text>
                  <View style={{flexDirection:'row',alignItems:'center',gap:5}}>
                    <View style={{width:7,height:7,borderRadius:2,backgroundColor:GREEN}}/>
                    <Text style={{color:T.muted,fontSize:10}}>par jour</Text>
                  </View>
                </View>
                {weekly.some(b=>b.count>0)
                  ?<WeekBarChart data={weekly}/>
                  :<View style={{alignItems:'center',paddingVertical:20,gap:8}}>
                    <Ionicons name="bar-chart-outline" size={28} color="rgba(0,217,126,0.25)"/>
                    <Text style={{color:T.muted,fontSize:12}}>Aucune donnée sur 7 jours</Text>
                  </View>
                }
              </Card>

              {/* ── INVITATION FUNNEL + BUDGET ── */}
              <View style={{flexDirection:'row',gap:14}}>
                {/* Funnel */}
                <Card style={{flex:1}}>
                  <Text style={ds.cardTitle}>Invitations</Text>
                  <View style={{gap:10,flex:1,justifyContent:'center'}}>
                    <FunnelRow label="Envoyées"  value={kpis.invites_sent}     total={Math.max(kpis.invites_sent,1)} color={T.blue}/>
                    <FunnelRow label="En attente"value={kpis.invites_pending}  total={Math.max(kpis.invites_sent,1)} color={T.amber}/>
                    <FunnelRow label="Acceptées" value={kpis.invites_accepted} total={Math.max(kpis.invites_sent,1)} color={GREEN}/>
                  </View>
                  <View style={{alignItems:'center',paddingTop:10,borderTopWidth:StyleSheet.hairlineWidth,borderTopColor:T.border}}>
                    <Counter value={kpis.acceptance_rate} suffix="%" color={GREEN} size={26}/>
                    <Text style={{color:T.muted,fontSize:9,fontWeight:'700',marginTop:2}}>TAUX D'ACCEPTATION</Text>
                  </View>
                </Card>

                {/* Budget */}
                <Card style={{flex:1}} glow={GOLD}>
                  <Text style={ds.cardTitle}>Budget</Text>
                  <View style={{flex:1,justifyContent:'center',gap:14}}>
                    <View style={{alignItems:'center',gap:2}}>
                      <Counter value={kpis.budget_total} suffix="€" color={GOLD} size={24}/>
                      <Text style={{color:T.muted,fontSize:9,fontWeight:'700'}}>TOTAL ALLOUÉ</Text>
                    </View>
                    <ProgBar
                      value={kpis.active_events}
                      max={Math.max(kpis.total_events,1)}
                      color={GREEN}
                      label="Missions actives"
                      right={`${kpis.active_events}/${kpis.total_events}`}
                    />
                    <ProgBar
                      value={kpis.done_events}
                      max={Math.max(kpis.total_events,1)}
                      color={T.muted}
                      label="Terminées"
                      right={`${kpis.done_events}`}
                    />
                  </View>
                </Card>
              </View>

              {/* ── UPCOMING EVENTS ── */}
              {upcomingEvts.length>0&&(
                <Card>
                  <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center'}}>
                    <Text style={ds.cardTitle}>Prochaines missions</Text>
                    <TouchableOpacity onPress={()=>router.push('/(organizer)/events' as any)} activeOpacity={0.75}>
                      <Text style={{color:GREEN,fontSize:11,fontWeight:'700'}}>Tout voir →</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={{gap:10}}>
                    {upcomingEvts.map(e=>{
                      const daysLeft=Math.ceil((new Date(e.date_start).getTime()-Date.now())/86400000);
                      const tc=typeColor(e.type);
                      return(
                        <TouchableOpacity
                          key={e.id}
                          style={ds.evtRow}
                          onPress={()=>router.push({pathname:'/(organizer)/event/[id]',params:{id:e.id}} as any)}
                          activeOpacity={0.82}
                        >
                          <View style={[ds.evtIcon,{backgroundColor:`${tc}18`,borderColor:`${tc}30`}]}>
                            <Ionicons name="calendar-outline" size={14} color={tc}/>
                          </View>
                          <View style={{flex:1,gap:3}}>
                            <Text style={{color:T.white,fontSize:13,fontWeight:'800'}} numberOfLines={1}>{e.title}</Text>
                            <View style={{flexDirection:'row',alignItems:'center',gap:8}}>
                              <Text style={{color:T.muted,fontSize:10}}>
                                {new Date(e.date_start).toLocaleDateString('fr-FR',{day:'numeric',month:'short'})}
                              </Text>
                              <Text style={{color:T.faint,fontSize:10}}>· {(e.location??'').split(',')[0]}</Text>
                            </View>
                          </View>
                          <View style={{alignItems:'flex-end',gap:3}}>
                            <View style={[ds.daysChip,{backgroundColor:daysLeft<=2?'rgba(239,68,68,0.15)':daysLeft<=7?'rgba(245,158,11,0.12)':'rgba(0,217,126,0.10)'}]}>
                              <Text style={{color:daysLeft<=2?T.red:daysLeft<=7?T.amber:GREEN,fontSize:9,fontWeight:'800'}}>
                                {daysLeft<=0?'Aujourdhui':`J-${daysLeft}`}
                              </Text>
                            </View>
                            {e.type&&<Text style={{color:tc,fontSize:9,fontWeight:'600'}}>{e.type}</Text>}
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </Card>
              )}

              {/* ── RECENT EVENTS ── */}
              {recentEvts.length>0&&(
                <Card>
                  <Text style={ds.cardTitle}>Activité récente</Text>
                  <View style={{gap:9}}>
                    {recentEvts.map(e=>(
                      <TouchableOpacity
                        key={e.id}
                        style={{flexDirection:'row',alignItems:'center',gap:12}}
                        onPress={()=>router.push({pathname:'/(organizer)/event/[id]',params:{id:e.id}} as any)}
                        activeOpacity={0.80}
                      >
                        <View style={{width:36,height:36,borderRadius:10,backgroundColor:`${typeColor(e.type)}14`,alignItems:'center',justifyContent:'center',borderWidth:StyleSheet.hairlineWidth,borderColor:`${typeColor(e.type)}28`}}>
                          <Ionicons name="calendar-outline" size={15} color={typeColor(e.type)}/>
                        </View>
                        <View style={{flex:1,gap:2}}>
                          <Text style={{color:T.white,fontSize:13,fontWeight:'700'}} numberOfLines={1}>{e.title}</Text>
                          <Text style={{color:T.muted,fontSize:10}}>
                            {new Date(e.date_start).toLocaleDateString('fr-FR',{day:'numeric',month:'short',year:'numeric'})}
                            {e.budget?`  ·  ${e.budget.toLocaleString('fr-FR')}€`:''}
                          </Text>
                        </View>
                        <StatusBadge status={e.status}/>
                      </TouchableOpacity>
                    ))}
                  </View>
                </Card>
              )}

              {/* ── QUICK ACTIONS ── */}
              <Card>
                <Text style={ds.cardTitle}>Actions rapides</Text>
                <View style={{flexDirection:'row',flexWrap:'wrap',gap:10}}>
                  {[
                    {l:'Créer une mission',  icon:'add-circle-outline' as const,  route:'/(organizer)/create-event', c:GREEN },
                    {l:'Trouver du staff',   icon:'search-outline'      as const,  route:'/(organizer)/staff-search', c:GOLD  },
                    {l:'Candidatures',       icon:'mail-outline'         as const,  route:'/(organizer)/applications', c:T.blue},
                    {l:'Mes missions',       icon:'briefcase-outline'    as const,  route:'/(organizer)/events',       c:T.amber},
                  ].map(({l,icon,route,c})=>(
                    <TouchableOpacity
                      key={l}
                      style={[ds.qbtn,{borderColor:`${c}22`,backgroundColor:`${c}0A`}]}
                      onPress={()=>router.push(route as any)}
                      activeOpacity={0.78}
                    >
                      <Ionicons name={icon} size={17} color={c}/>
                      <Text style={{color:T.muted,fontSize:11,fontWeight:'600',textAlign:'center',lineHeight:14}}>{l}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </Card>

              {/* ── EMPTY STATE ── */}
              {kpis.total_events===0&&(
                <View style={{alignItems:'center',paddingVertical:44,gap:14}}>
                  <View style={{width:80,height:80,borderRadius:40,backgroundColor:T.greenDim,alignItems:'center',justifyContent:'center',borderWidth:1,borderColor:T.border}}>
                    <Ionicons name="rocket-outline" size={36} color="rgba(0,217,126,0.55)"/>
                  </View>
                  <Text style={{color:T.white,fontSize:17,fontWeight:'900',textAlign:'center'}}>
                    Lancez votre première{'\n'}mission Eventure
                  </Text>
                  <Text style={{color:T.muted,fontSize:12,textAlign:'center',lineHeight:18}}>
                    Créez un événement, publiez-le{'\n'}et recrutez votre équipe en 5 minutes.
                  </Text>
                  <TouchableOpacity
                    style={{paddingHorizontal:28,paddingVertical:13,borderRadius:16,backgroundColor:T.greenDim,borderWidth:1,borderColor:T.borderHi}}
                    onPress={()=>router.push('/(organizer)/create-event' as any)}
                  >
                    <Text style={{color:GREEN,fontWeight:'900',fontSize:14}}>+ Créer un événement</Text>
                  </TouchableOpacity>
                </View>
              )}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

/* ─── Styles ─────────────────────────────────────────────────────────────── */
const ds=StyleSheet.create({
  nav     :{flexDirection:'row',justifyContent:'space-between',alignItems:'center',paddingHorizontal:EDGE,paddingVertical:12,paddingBottom:8},
  greet   :{color:T.muted,fontSize:12,fontWeight:'600'},
  title   :{color:T.white,fontSize:20,fontWeight:'900',letterSpacing:-0.4},
  navBtn  :{width:38,height:38,borderRadius:12,alignItems:'center',justifyContent:'center',backgroundColor:T.surf,borderWidth:StyleSheet.hairlineWidth,borderColor:T.border},
  kpiRow  :{flexDirection:'row',gap:10},
  kpiCard :{flex:1,borderRadius:16,overflow:'hidden',padding:13,gap:6,alignItems:'center',backgroundColor:T.navy},
  cardTitle:{color:T.white,fontSize:14,fontWeight:'900',letterSpacing:-0.2},
  evtRow  :{flexDirection:'row',alignItems:'center',gap:12,padding:11,borderRadius:14,backgroundColor:T.surf,borderWidth:StyleSheet.hairlineWidth,borderColor:T.border},
  evtIcon :{width:34,height:34,borderRadius:10,alignItems:'center',justifyContent:'center',borderWidth:1},
  daysChip:{paddingHorizontal:7,paddingVertical:3,borderRadius:8},
  qbtn    :{flex:1,minWidth:'45%',alignItems:'center',gap:8,padding:14,borderRadius:14,borderWidth:StyleSheet.hairlineWidth},
});