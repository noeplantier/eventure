/**
 * app/(organizer)/staff-search.tsx — EVENTURE v2
 * Table: public.staff · Full-text search · Filters · Pagination · Realtime · Invite
 *
 * ─── BUG FIX (infinite re-render / "keeps moving") ───────────────────────────
 * ROOT CAUSE: load() was in useCallback([query,role,sort,avail,rateMax,...])
 *   → every filter change recreated load → useEffect([...filters]) re-fired load
 *   → new load reference → useEffect fired again → infinite loop.
 *
 * SOLUTION: All filter values stored in useRef. load() declared with stable []
 *   deps and reads refs directly. A single triggerLoad() state bump drives
 *   re-fetches. No circular dependency possible.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import React, {
  memo, useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import {
  ActivityIndicator, Animated, Dimensions, Easing, FlatList,
  Image, Keyboard, KeyboardAvoidingView, Modal, Platform,
  RefreshControl, ScrollView, StyleSheet, Text, TextInput,
  TouchableOpacity, View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons }       from '@expo/vector-icons';
import { SafeAreaView }   from 'react-native-safe-area-context';
import { useRouter }      from 'expo-router';
import { supabase }       from '@/lib/supabase';

/* ─── Dimensions & Palette ─────────────────────────────────────────────── */
const { width: SW, height: SH } = Dimensions.get('window');
const BG    = '#020A06';
const GREEN = '#00D97E';
const GOLD  = '#F5C842';
const EDGE  = 20;
const PAGE  = 15;

const T = {
  white   : '#FFFFFF',
  muted   : 'rgba(255,255,255,0.50)',
  faint   : 'rgba(255,255,255,0.16)',
  surf    : 'rgba(255,255,255,0.05)',
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
interface StaffProfile {
  id              : string;
  display_name    : string;
  avatar_url      : string | null;
  role            : string[];
  hourly_rate     : number;
  rating          : number;
  missions_count  : number;
  location        : string;
  latitude        : number | null;
  longitude       : number | null;
  is_available    : boolean;
  bio             : string | null;
  experience_years: number | null;
  verified        : boolean;
  languages       : string[] | null;
  response_time   : number | null;
  network         : string | null; // réseau / agence
  badge           : string | null; // 'top_rated' | 'rising' | 'veteran' | null
}

interface InvitePayload {
  staff    : StaffProfile;
  eventId ?: string;
}

/* ─── Filter state (all in refs to avoid stale closures) ───────────────── */
type SortKey = 'rating' | 'rate_asc' | 'rate_desc' | 'missions' | 'response';

const ROLE_FILTERS = [
  'Tous','Serveur·se','Barman / Barmaid','Agent de sécurité',
  "Hôte·sse d'accueil",'Coordinateur·rice','Runner','Photographe',
  'Vidéaste','Sommelier·ère','DJ','Animateur·rice','Technicien son',
];
const SORT_OPTIONS: { k: SortKey; l: string; icon: React.ComponentProps<typeof Ionicons>['name'] }[] = [
  { k:'rating',    l:'Mieux notés',  icon:'star-outline'          },
  { k:'rate_asc',  l:'Prix ↑',       icon:'trending-up-outline'   },
  { k:'rate_desc', l:'Prix ↓',       icon:'trending-down-outline' },
  { k:'missions',  l:'Expérience',   icon:'briefcase-outline'     },
  { k:'response',  l:'Réactivité',   icon:'flash-outline'         },
];
const RATE_PRESETS = [
  { l:'Tous',   v:null },
  { l:'≤ 15€',  v:15   },
  { l:'≤ 20€',  v:20   },
  { l:'≤ 30€',  v:30   },
  { l:'≤ 50€',  v:50   },
];
const NETWORKS = ['Tous','Agence Pro','Réseau Indé','École Hôtelière','Réseau Sécurité','Freelances'];
const BADGE_CFG: Record<string,{l:string;c:string;icon:React.ComponentProps<typeof Ionicons>['name']}> = {
  top_rated : { l:'Top Noté',   c:GOLD,     icon:'trophy-outline'   },
  rising    : { l:'Montant',    c:T.blue,   icon:'trending-up'      },
  veteran   : { l:'Vétéran',    c:T.purple, icon:'ribbon-outline'   },
  new       : { l:'Nouveau',    c:GREEN,    icon:'sparkles-outline' },
};

/* ─── Particle Background ──────────────────────────────────────────────── */
const rnd = (a:number, b:number) => a + Math.random()*(b-a);
const PCOLS = ['#00D97E','rgba(0,217,126,0.4)','#F5C842','rgba(245,200,66,0.35)','rgba(255,255,255,0.18)'];
const PTS = Array.from({length:24},(_,i)=>({
  id:i, x:rnd(0,SW), y:rnd(0,SH*1.2),
  sz:rnd(0.8,3), col:PCOLS[i%PCOLS.length], op:0.04+(i%6)*0.03,
}));
const ParticleBg = memo(()=>(
  <View style={StyleSheet.absoluteFill} pointerEvents="none">
    <LinearGradient colors={[BG,'#041208',BG]} style={StyleSheet.absoluteFill}/>
    <View style={{position:'absolute',top:'8%',left:'12%',width:SW*.68,height:SW*.68,borderRadius:SW*.34,backgroundColor:'rgba(0,217,126,0.03)'}}/>
    <View style={{position:'absolute',bottom:'6%',right:'-18%',width:SW*.6,height:SW*.6,borderRadius:SW*.3,backgroundColor:'rgba(245,200,66,0.025)'}}/>
    <View style={{position:'absolute',top:'42%',left:'-15%',width:SW*.5,height:SW*.5,borderRadius:SW*.25,backgroundColor:'rgba(0,217,126,0.02)'}}/>
    {PTS.map(p=><View key={p.id} style={{position:'absolute',left:p.x,top:p.y,width:p.sz,height:p.sz,borderRadius:p.sz/2,backgroundColor:p.col,opacity:p.op}}/>)}
  </View>
));

/* ─── Skeleton ─────────────────────────────────────────────────────────── */
const SkeletonCard = memo(()=>{
  const a = useRef(new Animated.Value(0)).current;
  useEffect(()=>{
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(a,{toValue:1,duration:880,useNativeDriver:true}),
      Animated.timing(a,{toValue:0,duration:880,useNativeDriver:true}),
    ]));
    loop.start(); return ()=>loop.stop();
  },[]);
  const op = a.interpolate({inputRange:[0,1],outputRange:[0.28,0.62]});
  return(
    <Animated.View style={[skl.card,{opacity:op}]}>
      <View style={{flexDirection:'row',gap:13}}>
        <View style={skl.avatar}/>
        <View style={{flex:1,gap:9}}>
          <View style={[skl.line,{width:'65%',height:14}]}/>
          <View style={[skl.line,{width:'42%',height:10}]}/>
          <View style={[skl.line,{width:'55%',height:9}]}/>
        </View>
        <View style={skl.rate}/>
      </View>
      <View style={{flexDirection:'row',gap:7,marginTop:10}}>
        <View style={[skl.line,{width:68,height:22,borderRadius:11}]}/>
        <View style={[skl.line,{width:88,height:22,borderRadius:11}]}/>
      </View>
      <View style={{flexDirection:'row',gap:10,marginTop:10}}>
        <View style={[skl.line,{flex:1,height:38,borderRadius:13}]}/>
        <View style={[skl.line,{flex:2,height:38,borderRadius:13}]}/>
      </View>
    </Animated.View>
  );
});
const skl = StyleSheet.create({
  card  :{borderRadius:20,padding:16,marginBottom:14,backgroundColor:T.navy,gap:0},
  avatar:{width:64,height:64,borderRadius:32,backgroundColor:T.surf},
  rate  :{width:46,height:46,borderRadius:9,backgroundColor:T.surf},
  line  :{backgroundColor:T.surf,borderRadius:6},
});

/* ─── Sort Modal ───────────────────────────────────────────────────────── */
const SortModal = memo(function SortModal({
  visible, sort, onSelect, onClose,
}:{visible:boolean;sort:SortKey;onSelect:(k:SortKey)=>void;onClose:()=>void}){
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(()=>{
    Animated.spring(anim,{toValue:visible?1:0,tension:80,friction:12,useNativeDriver:true}).start();
  },[visible]);
  if(!visible) return null;
  return(
    <TouchableOpacity
      style={{...StyleSheet.absoluteFillObject,zIndex:200}}
      onPress={onClose} activeOpacity={1}
    >
      <Animated.View style={{
        position:'absolute',top:162,right:EDGE,
        borderRadius:18,overflow:'hidden',width:215,
        transform:[{scale:anim.interpolate({inputRange:[0,1],outputRange:[0.87,1]})}],
        opacity:anim, elevation:12,
      }}>
        <LinearGradient colors={['#102A1A','#061610']} style={{borderWidth:1,borderColor:T.borderHi,borderRadius:18}}>
          {SORT_OPTIONS.map((o,i)=>(
            <TouchableOpacity
              key={o.k}
              style={{
                flexDirection:'row',alignItems:'center',gap:11,
                paddingHorizontal:16,paddingVertical:14,
                borderBottomWidth:i<SORT_OPTIONS.length-1?StyleSheet.hairlineWidth:0,
                borderBottomColor:T.border,
                backgroundColor:sort===o.k?'rgba(0,217,126,0.10)':'transparent',
              }}
              onPress={()=>{onSelect(o.k);onClose();}}
            >
              <Ionicons name={o.icon} size={15} color={sort===o.k?GREEN:T.muted}/>
              <Text style={{color:sort===o.k?GREEN:T.muted,fontSize:13,fontWeight:sort===o.k?'800':'500',flex:1}}>{o.l}</Text>
              {sort===o.k&&<Ionicons name="checkmark" size={14} color={GREEN}/>}
            </TouchableOpacity>
          ))}
        </LinearGradient>
      </Animated.View>
    </TouchableOpacity>
  );
});

/* ─── Invite Modal ─────────────────────────────────────────────────────── */
const InviteModal = memo(function InviteModal({
  payload, onClose,
}:{payload:InvitePayload|null;onClose:()=>void}){
  const slideY  = useRef(new Animated.Value(SH)).current;
  const bgOp    = useRef(new Animated.Value(0)).current;
  const [msg,   setMsg]   = useState('');
  const [busy,  setBusy]  = useState(false);
  const [sent,  setSent]  = useState(false);

  useEffect(()=>{
    if(payload){
      setMsg(''); setSent(false); setBusy(false);
      Animated.parallel([
        Animated.spring(slideY,{toValue:0,tension:68,friction:14,useNativeDriver:true}),
        Animated.timing(bgOp,{toValue:1,duration:220,useNativeDriver:true}),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideY,{toValue:SH,duration:260,useNativeDriver:true}),
        Animated.timing(bgOp,{toValue:0,duration:200,useNativeDriver:true}),
      ]).start();
    }
  },[payload]);

  const send = async()=>{
    if(!payload||busy) return;
    setBusy(true);
    try{
      const {data:{session}}=await supabase.auth.getSession();
      if(!session) throw new Error('Non authentifié');
      await supabase.from('invitations').insert({
        organizer_id:session.user.id,
        staff_id:payload.staff.id,
        event_id:payload.eventId??null,
        message:msg.trim()||null,
        status:'pending',
      });
      await supabase.from('messages').insert({
        sender_id:session.user.id,
        recipient_id:payload.staff.id,
        content:msg.trim()
          ?`[Invitation mission]\n${msg.trim()}`
          :`[Invitation mission] Bonjour ${payload.staff.display_name}, je souhaite vous inviter à une mission.`,
        type:'invitation',
      });
      setSent(true);
      setTimeout(onClose,1900);
    }catch(e){console.error('[invite]',e);}
    finally{setBusy(false);}
  };

  if(!payload) return null;
  const initials = payload.staff.display_name.trim().split(' ').map(n=>n[0]).join('').toUpperCase().slice(0,2);

  return(
    <Modal transparent visible={!!payload} animationType="none" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS==='ios'?'padding':undefined} style={{flex:1}}>
        <Animated.View style={{flex:1,backgroundColor:'rgba(2,10,6,0.75)',opacity:bgOp}}>
          <TouchableOpacity style={{flex:1}} activeOpacity={1} onPress={()=>{Keyboard.dismiss();onClose();}}/>
        </Animated.View>
        <Animated.View style={[inv.sheet,{transform:[{translateY:slideY}]}]}>
          <LinearGradient colors={['#0D2A1A','#041208']} style={StyleSheet.absoluteFillObject}/>
          <View style={inv.handle}/>
          {sent?(
            <View style={{alignItems:'center',paddingVertical:44,gap:16}}>
              <View style={{width:68,height:68,borderRadius:34,backgroundColor:'rgba(0,217,126,0.15)',alignItems:'center',justifyContent:'center',borderWidth:1,borderColor:T.borderHi}}>
                <Ionicons name="checkmark-circle" size={34} color={GREEN}/>
              </View>
              <Text style={{color:T.white,fontSize:19,fontWeight:'900'}}>Invitation envoyée !</Text>
              <Text style={{color:T.muted,fontSize:13,textAlign:'center',lineHeight:19}}>
                {payload.staff.display_name} sera notifié·e{'\n'}de votre invitation.
              </Text>
            </View>
          ):(
            <>
              <View style={inv.hdr}>
                <View style={{flex:1}}>
                  <Text style={inv.title}>Inviter à une mission</Text>
                  <Text style={inv.sub}>{payload.staff.display_name} · {(payload.staff.role??[])[0]}</Text>
                </View>
                <TouchableOpacity onPress={onClose} hitSlop={14}>
                  <Ionicons name="close" size={22} color={T.muted}/>
                </TouchableOpacity>
              </View>
              {/* Staff recap */}
              <View style={inv.staffRow}>
                <View style={[inv.avatarSm,{backgroundColor:'rgba(0,217,126,0.08)',borderWidth:1,borderColor:T.border,alignItems:'center',justifyContent:'center'}]}>
                  <Text style={{color:GREEN,fontWeight:'900',fontSize:17}}>{initials}</Text>
                </View>
                <View style={{flex:1,gap:2}}>
                  <Text style={{color:T.white,fontWeight:'800',fontSize:14}}>{payload.staff.display_name}</Text>
                  <Text style={{color:T.muted,fontSize:11}}>{payload.staff.location}</Text>
                </View>
                <View style={{alignItems:'flex-end'}}>
                  <Text style={{color:GOLD,fontWeight:'900',fontSize:20}}>{payload.staff.hourly_rate}€</Text>
                  <Text style={{color:T.muted,fontSize:9}}>/heure</Text>
                </View>
              </View>
              {/* Message */}
              <Text style={inv.label}>Message <Text style={{color:T.faint}}>(optionnel)</Text></Text>
              <View style={inv.taWrap}>
                <TextInput
                  style={inv.ta}
                  placeholder={`Bonjour ${payload.staff.display_name.split(' ')[0]}, je recherche un·e ${((payload.staff.role??[])[0]??'').toLowerCase()} pour…`}
                  placeholderTextColor={T.faint}
                  multiline numberOfLines={4}
                  value={msg} onChangeText={setMsg} maxLength={500}
                />
                <Text style={{color:T.faint,fontSize:10,alignSelf:'flex-end',marginTop:5}}>{msg.length}/500</Text>
              </View>
              {/* Buttons */}
              <View style={{flexDirection:'row',gap:12,marginTop:10}}>
                <TouchableOpacity style={inv.cancelBtn} onPress={onClose} activeOpacity={0.75}>
                  <Text style={{color:T.muted,fontWeight:'700',fontSize:14}}>Annuler</Text>
                </TouchableOpacity>
                <TouchableOpacity style={inv.sendBtn} onPress={send} activeOpacity={0.82} disabled={busy}>
                  <LinearGradient colors={[GREEN,'#00B868']} style={inv.sendGrad}>
                    {busy
                      ?<ActivityIndicator color={BG} size="small"/>
                      :<><Ionicons name="send" size={14} color={BG}/><Text style={{color:BG,fontWeight:'900',fontSize:14}}>Envoyer</Text></>
                    }
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </>
          )}
          <View style={{height:Platform.OS==='ios'?30:14}}/>
          <View pointerEvents="none" style={{position:'absolute',top:0,left:0,right:0,bottom:0,borderTopLeftRadius:28,borderTopRightRadius:28,borderWidth:StyleSheet.hairlineWidth,borderColor:T.border}}/>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
});
const inv = StyleSheet.create({
  sheet    :{borderTopLeftRadius:28,borderTopRightRadius:28,overflow:'hidden',paddingHorizontal:EDGE,paddingTop:14,backgroundColor:'#0D2A1A'},
  handle   :{width:40,height:4,borderRadius:2,backgroundColor:T.faint,alignSelf:'center',marginBottom:20},
  hdr      :{flexDirection:'row',alignItems:'flex-start',marginBottom:18},
  title    :{color:T.white,fontSize:19,fontWeight:'900'},
  sub      :{color:GREEN,fontSize:11,fontWeight:'600',marginTop:2},
  staffRow :{flexDirection:'row',alignItems:'center',gap:12,padding:14,borderRadius:16,backgroundColor:T.surf,borderWidth:StyleSheet.hairlineWidth,borderColor:T.border,marginBottom:18},
  avatarSm :{width:48,height:48,borderRadius:24},
  label    :{color:T.muted,fontSize:12,fontWeight:'700',marginBottom:8},
  taWrap   :{backgroundColor:T.surf,borderRadius:14,padding:14,borderWidth:StyleSheet.hairlineWidth,borderColor:T.border},
  ta       :{color:T.white,fontSize:13,lineHeight:19,minHeight:88,textAlignVertical:'top'},
  cancelBtn:{flex:1,alignItems:'center',justifyContent:'center',height:52,borderRadius:15,backgroundColor:T.surf,borderWidth:StyleSheet.hairlineWidth,borderColor:T.border},
  sendBtn  :{flex:2,borderRadius:15,overflow:'hidden'},
  sendGrad :{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,height:52},
});

/* ─── Stats Banner ─────────────────────────────────────────────────────── */
const StatsBanner = memo(({total,available,loading}:{total:number;available:number;loading:boolean})=>{
  if(loading&&total===0) return null;
  return(
    <View style={{flexDirection:'row',gap:9,marginHorizontal:EDGE,marginBottom:10}}>
      {[
        {l:'Talents', v:total,           c:T.white},
        {l:'Dispos',  v:available,       c:GREEN  },
        {l:'Occupés', v:total-available, c:T.amber},
      ].map(({l,v,c})=>(
        <View key={l} style={{flex:1,alignItems:'center',paddingVertical:10,borderRadius:14,backgroundColor:T.surf,borderWidth:StyleSheet.hairlineWidth,borderColor:T.border}}>
          <Text style={{color:c,fontSize:19,fontWeight:'900'}}>{v}</Text>
          <Text style={{color:T.faint,fontSize:9,fontWeight:'700',letterSpacing:0.3}}>{l}</Text>
        </View>
      ))}
    </View>
  );
});

/* ─── Staff Card ───────────────────────────────────────────────────────── */
const StaffCard = memo(function StaffCard({
  s, index, onInvite, onChat, onProfile, onFavorite, isFavorite,
}:{
  s:StaffProfile; index:number;
  onInvite:()=>void; onChat:()=>void; onProfile:()=>void;
  onFavorite:()=>void; isFavorite:boolean;
}){
  const [imgErr, setImgErr] = useState(false);
  const enter  = useRef(new Animated.Value(0)).current;
  const press  = useRef(new Animated.Value(1)).current;
  const favA   = useRef(new Animated.Value(isFavorite?1:0)).current;

  useEffect(()=>{
    Animated.timing(enter,{
      toValue:1,duration:330,
      delay:Math.min(index*50,350),
      easing:Easing.out(Easing.cubic),
      useNativeDriver:true,
    }).start();
  },[]);

  const onPressIn  = ()=>Animated.spring(press,{toValue:.974,tension:300,friction:8,useNativeDriver:true}).start();
  const onPressOut = ()=>Animated.spring(press,{toValue:1,  tension:200,friction:10,useNativeDriver:true}).start();
  const tapFav     = ()=>{
    onFavorite();
    Animated.sequence([
      Animated.spring(favA,{toValue:isFavorite?0:1.4,tension:400,friction:5,useNativeDriver:true}),
      Animated.spring(favA,{toValue:isFavorite?0:1,  tension:300,friction:8,useNativeDriver:true}),
    ]).start();
  };

  const roles    = Array.isArray(s.role)?s.role:[];
  const primary  = roles[0]??'—';
  const extra    = roles.slice(1,3);
  const initials = s.display_name.trim().split(' ').map(n=>n[0]).join('').toUpperCase().slice(0,2);
  const stars    = Math.round(s.rating);
  const respStr  = s.response_time!=null
    ? s.response_time<60?`${s.response_time}min`:`${Math.round(s.response_time/60)}h`
    : null;
  const badge    = s.badge ? BADGE_CFG[s.badge] : null;

  return(
    <Animated.View style={{
      opacity:enter,
      transform:[
        {translateY:enter.interpolate({inputRange:[0,1],outputRange:[22,0]})},
        {scale:press},
      ],
    }}>
      <TouchableOpacity
        style={card.wrap}
        onPress={onProfile}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        activeOpacity={1}
      >
        <LinearGradient colors={['rgba(0,217,126,0.07)','rgba(0,217,126,0.015)']} style={StyleSheet.absoluteFillObject}/>

        {/* Top row: avatar + info + rate */}
        <View style={card.topRow}>
          {/* Avatar */}
          <TouchableOpacity onPress={onProfile} activeOpacity={0.85}>
            <View style={{position:'relative'}}>
              {s.avatar_url&&!imgErr
                ?<Image source={{uri:s.avatar_url}} style={card.avatar} resizeMode="cover" onError={()=>setImgErr(true)}/>
                :<View style={[card.avatar,card.avatarFb]}><Text style={card.initials}>{initials}</Text></View>
              }
              <View style={[card.dot,{backgroundColor:s.is_available?GREEN:T.amber}]}/>
            </View>
          </TouchableOpacity>

          {/* Info block */}
          <View style={{flex:1,gap:2}}>
            {/* Name + verified + status */}
            <View style={{flexDirection:'row',alignItems:'center',gap:5,flexWrap:'wrap'}}>
              <Text style={card.name} numberOfLines={1}>{s.display_name}</Text>
              {s.verified&&<Ionicons name="shield-checkmark" size={12} color={GREEN}/>}
              {s.is_available
                ?<View style={card.availBadge}><View style={{width:5,height:5,borderRadius:2.5,backgroundColor:GREEN}}/><Text style={card.availTxt}>Dispo</Text></View>
                :<View style={card.busyBadge}><Text style={card.busyTxt}>Occupé</Text></View>
              }
            </View>

            {/* Primary role */}
            <Text style={card.primary}>{primary}</Text>

            {/* Location + response time */}
            <View style={{flexDirection:'row',alignItems:'center',gap:7,marginTop:1,flexWrap:'wrap'}}>
              {s.location?(
                <View style={{flexDirection:'row',alignItems:'center',gap:3}}>
                  <Ionicons name="location-outline" size={10} color={T.muted}/>
                  <Text style={{color:T.muted,fontSize:10}} numberOfLines={1}>{s.location}</Text>
                </View>
              ):null}
              {respStr&&(
                <View style={{flexDirection:'row',alignItems:'center',gap:3}}>
                  <Ionicons name="flash-outline" size={9} color={GREEN}/>
                  <Text style={{color:GREEN,fontSize:9,fontWeight:'700'}}>{respStr}</Text>
                </View>
              )}
              {s.network&&(
                <View style={{flexDirection:'row',alignItems:'center',gap:3}}>
                  <Ionicons name="git-network-outline" size={9} color={T.purple}/>
                  <Text style={{color:T.purple,fontSize:9,fontWeight:'600'}}>{s.network}</Text>
                </View>
              )}
            </View>

            {/* Stars + rating + missions + exp */}
            <View style={{flexDirection:'row',alignItems:'center',gap:6,marginTop:3}}>
              <View style={{flexDirection:'row',gap:1.5}}>
                {[1,2,3,4,5].map(i=>(
                  <Ionicons key={i} name={i<=stars?'star':'star-outline'} size={10} color={i<=stars?GOLD:T.faint}/>
                ))}
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

          {/* Rate + fav */}
          <View style={{alignItems:'flex-end',gap:6}}>
            <View style={{alignItems:'flex-end'}}>
              <Text style={card.rate}>{s.hourly_rate}<Text style={{fontSize:12,fontWeight:'600',color:T.muted}}>€</Text></Text>
              <Text style={{color:T.muted,fontSize:9}}>/heure</Text>
            </View>
            <TouchableOpacity onPress={tapFav} hitSlop={10} activeOpacity={0.72}>
              <Animated.View style={{transform:[{scale:favA.interpolate({inputRange:[0,1],outputRange:[1,1]})}]}}>
                <Ionicons name={isFavorite?'heart':'heart-outline'} size={18} color={isFavorite?'#EF4444':T.faint}/>
              </Animated.View>
            </TouchableOpacity>
          </View>
        </View>

        {/* Secondary roles + badge + languages */}
        <View style={{gap:6}}>
          <View style={{flexDirection:'row',gap:6,flexWrap:'wrap',alignItems:'center'}}>
            {extra.map(r=>(
              <View key={r} style={card.rolePill}><Text style={card.roleTxt}>{r}</Text></View>
            ))}
            {roles.length>3&&<View style={card.rolePill}><Text style={card.roleTxt}>+{roles.length-3}</Text></View>}
            {badge&&(
              <View style={[card.badgePill,{backgroundColor:`${badge.c}14`,borderColor:`${badge.c}30`}]}>
                <Ionicons name={badge.icon} size={9} color={badge.c}/>
                <Text style={[card.badgeTxt,{color:badge.c}]}>{badge.l}</Text>
              </View>
            )}
          </View>
          {s.languages&&s.languages.length>0&&(
            <View style={{flexDirection:'row',alignItems:'center',gap:5}}>
              <Ionicons name="language-outline" size={10} color={T.muted}/>
              <Text style={{color:T.muted,fontSize:10}}>{s.languages.join(' · ')}</Text>
            </View>
          )}
          {s.bio&&<Text style={card.bio} numberOfLines={2}>{s.bio}</Text>}
        </View>

        {/* Actions */}
        <View style={card.actions}>
          <TouchableOpacity style={card.chatBtn} onPress={onChat} activeOpacity={0.78}>
            <Ionicons name="chatbubble-outline" size={14} color={T.muted}/>
            <Text style={{color:T.muted,fontSize:12,fontWeight:'600'}}>Message</Text>
          </TouchableOpacity>
          <TouchableOpacity style={card.inviteBtn} onPress={onInvite} activeOpacity={0.82}>
            <LinearGradient colors={['rgba(0,217,126,0.32)','rgba(0,217,126,0.15)']} style={card.inviteGrad}>
              <Ionicons name="send-outline" size={13} color={GREEN}/>
              <Text style={{color:GREEN,fontSize:12,fontWeight:'900'}}>Inviter à une mission</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        <View pointerEvents="none" style={{position:'absolute',top:0,left:0,right:0,bottom:0,borderRadius:20,borderWidth:StyleSheet.hairlineWidth,borderColor:T.border}}/>
      </TouchableOpacity>
    </Animated.View>
  );
});
const card = StyleSheet.create({
  wrap      :{borderRadius:20,overflow:'hidden',marginBottom:14,padding:16,gap:12,backgroundColor:T.navy},
  topRow    :{flexDirection:'row',alignItems:'flex-start',gap:13},
  avatar    :{width:64,height:64,borderRadius:32,backgroundColor:T.navy},
  avatarFb  :{alignItems:'center',justifyContent:'center',borderWidth:1.5,borderColor:T.border,backgroundColor:'rgba(0,217,126,0.08)'},
  initials  :{color:GREEN,fontSize:21,fontWeight:'900'},
  dot       :{position:'absolute',bottom:1,right:1,width:13,height:13,borderRadius:6.5,borderWidth:2.5,borderColor:BG},
  availBadge:{flexDirection:'row',alignItems:'center',gap:4,paddingHorizontal:7,paddingVertical:3,borderRadius:10,backgroundColor:'rgba(0,217,126,0.15)',borderWidth:StyleSheet.hairlineWidth,borderColor:'rgba(0,217,126,0.30)'},
  availTxt  :{color:GREEN,fontSize:8,fontWeight:'800'},
  busyBadge :{paddingHorizontal:7,paddingVertical:3,borderRadius:10,backgroundColor:'rgba(245,158,11,0.12)'},
  busyTxt   :{color:T.amber,fontSize:8,fontWeight:'700'},
  name      :{color:T.white,fontSize:15,fontWeight:'900',letterSpacing:-0.3,flexShrink:1},
  primary   :{color:GREEN,fontSize:11,fontWeight:'700'},
  rate      :{color:GOLD,fontSize:22,fontWeight:'900',letterSpacing:-0.5},
  rolePill  :{paddingHorizontal:9,paddingVertical:4,borderRadius:18,backgroundColor:'rgba(0,217,126,0.09)',borderWidth:StyleSheet.hairlineWidth,borderColor:T.border},
  roleTxt   :{color:GREEN,fontSize:10,fontWeight:'600'},
  badgePill :{flexDirection:'row',alignItems:'center',gap:4,paddingHorizontal:8,paddingVertical:4,borderRadius:12,borderWidth:StyleSheet.hairlineWidth},
  badgeTxt  :{fontSize:9,fontWeight:'800'},
  bio       :{color:T.muted,fontSize:11,lineHeight:15,fontStyle:'italic'},
  actions   :{flexDirection:'row',gap:10,marginTop:2},
  chatBtn   :{flexDirection:'row',alignItems:'center',gap:6,paddingHorizontal:14,paddingVertical:10,borderRadius:13,backgroundColor:T.surf,borderWidth:StyleSheet.hairlineWidth,borderColor:T.border},
  inviteBtn :{flex:1,borderRadius:13,overflow:'hidden',borderWidth:1,borderColor:'rgba(0,217,126,0.28)'},
  inviteGrad:{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:7,paddingVertical:10},
});

/* ─── Realtime Dot ─────────────────────────────────────────────────────── */
const LiveDot = memo(()=>{
  const p = useRef(new Animated.Value(1)).current;
  useEffect(()=>{
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(p,{toValue:1.9,duration:900,useNativeDriver:true}),
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
      <Text style={{color:GREEN,fontSize:9,fontWeight:'700'}}>LIVE</Text>
    </View>
  );
});

/* ─── Screen ───────────────────────────────────────────────────────────── */
export default function StaffSearchScreen() {
  const router = useRouter();

  /* ── UI state ── */
  const [staff,        setStaff]        = useState<StaffProfile[]>([]);
  const [totalCount,   setTotalCount]   = useState(0);
  const [loading,      setLoading]      = useState(true);
  const [loadingMore,  setLoadingMore]  = useState(false);
  const [refreshing,   setRefreshing]   = useState(false);
  const [hasMore,      setHasMore]      = useState(true);
  const [showSort,     setShowSort]     = useState(false);
  const [favorites,    setFavorites]    = useState<Set<string>>(new Set());
  const [invitePayload,setInvitePayload]= useState<InvitePayload|null>(null);

  /* ── Filter state (UI) ── */
  const [query,   setQuery]   = useState('');
  const [role,    setRole]    = useState('Tous');
  const [sort,    setSort]    = useState<SortKey>('rating');
  const [avail,   setAvail]   = useState<boolean|null>(null);
  const [rateMax, setRateMax] = useState<number|null>(null);
  const [network, setNetwork] = useState('Tous');

  /* ── Filter refs (read inside stable load()) ── */
  const queryRef   = useRef(query);
  const roleRef    = useRef(role);
  const sortRef    = useRef(sort);
  const availRef   = useRef(avail);
  const rateRef    = useRef(rateMax);
  const networkRef = useRef(network);
  const pageRef    = useRef(0);
  const staffRef   = useRef<StaffProfile[]>([]);

  /* Sync refs with state */
  useEffect(()=>{ queryRef.current   = query;   },[query]);
  useEffect(()=>{ roleRef.current    = role;    },[role]);
  useEffect(()=>{ sortRef.current    = sort;    },[sort]);
  useEffect(()=>{ availRef.current   = avail;   },[avail]);
  useEffect(()=>{ rateRef.current    = rateMax; },[rateMax]);
  useEffect(()=>{ networkRef.current = network; },[network]);
  useEffect(()=>{ staffRef.current   = staff;   },[staff]);

  /* ── Trigger counter: bump to re-fetch (avoids useEffect dep on load) ── */
  const [trigger, setTrigger] = useState(0);
  const triggerReset = useCallback(()=>{ pageRef.current=0; setTrigger(t=>t+1); },[]);

  const debounceRef = useRef<ReturnType<typeof setTimeout>|null>(null);

  /* ── Debounced search trigger ── */
  useEffect(()=>{
    if(debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(triggerReset, 380);
    return()=>{ if(debounceRef.current) clearTimeout(debounceRef.current); };
  },[query]);

  /* ── Instant filter triggers ── */
  useEffect(()=>{ triggerReset(); },[role, sort, avail, rateMax, network]);

  /* ── STABLE load() — reads only refs, zero dependency array ── */
  const load = useCallback(async(reset=false)=>{
    const offset = reset ? 0 : pageRef.current * PAGE;

    if(reset){
      setLoading(true);
      setStaff([]);
      staffRef.current = [];
    }

    try{
      let q = supabase
        .from('staff')
        .select(
          'id,display_name,avatar_url,role,hourly_rate,rating,missions_count,location,latitude,longitude,is_available,bio,experience_years,verified,languages,response_time,network,badge',
          {count:'exact'},
        );

      // Full-text search against search_vector
      const sq = queryRef.current.trim();
      if(sq){
        q = q.textSearch(
          'search_vector',
          sq.split(/\s+/).filter(Boolean).map(w=>`${w}:*`).join(' & '),
          {type:'websearch', config:'french'},
        );
      }

      const r = roleRef.current;
      if(r!=='Tous') q = q.contains('role',[r]);

      const av = availRef.current;
      if(av!==null) q = q.eq('is_available',av);

      const rm = rateRef.current;
      if(rm) q = q.lte('hourly_rate',rm);

      const nw = networkRef.current;
      if(nw!=='Tous') q = q.eq('network',nw);

      switch(sortRef.current){
        case 'rating'   : q=q.order('rating',        {ascending:false}); break;
        case 'rate_asc' : q=q.order('hourly_rate',   {ascending:true});  break;
        case 'rate_desc': q=q.order('hourly_rate',   {ascending:false}); break;
        case 'missions' : q=q.order('missions_count',{ascending:false}); break;
        case 'response' : q=q.order('response_time', {ascending:true,nullsFirst:false}); break;
      }

      q = q.range(offset, offset+PAGE-1);

      const {data,error,count} = await q;
      if(error) throw error;

      const items = (data??[]) as StaffProfile[];

      if(reset){
        setStaff(items);
      } else {
        const ids = new Set(staffRef.current.map(p=>p.id));
        setStaff(prev=>[...prev,...items.filter(i=>!ids.has(i.id))]);
      }
      setTotalCount(count??0);
      setHasMore((count??0)>(offset+PAGE));
      if(!reset) pageRef.current += 1;

    }catch(e){
      console.error('[staff-search]',e);
    }finally{
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  },[]); // ← stable: no deps, reads refs

  /* ── Trigger → load ── */
  useEffect(()=>{
    load(true);
  },[trigger]);

  /* ── Realtime: staff availability — unique channel per mount ── */
  useEffect(()=>{
    let mounted = true;
    const ch = supabase
      .channel(`staff_avail_${Date.now()}`)
      .on('postgres_changes',{event:'UPDATE',schema:'public',table:'staff'},
        ({new:row})=>{
          if(!mounted) return;
          setStaff(prev=>prev.map(s=>s.id===(row as any).id?{...s,...(row as any)}:s));
        })
      .subscribe();
    return()=>{ mounted=false; supabase.removeChannel(ch); };
  },[]);

  /* ── Load more ── */
  const loadMore = useCallback(()=>{
    if(loadingMore||!hasMore||loading) return;
    setLoadingMore(true);
    load(false);
  },[loadingMore,hasMore,loading,load]);

  /* ── Actions ── */
  const handleInvite  = useCallback((s:StaffProfile)=>setInvitePayload({staff:s}),[]);
  const handleChat    = useCallback((s:StaffProfile)=>router.push({pathname:'/(shared)/chat/[id]',params:{id:s.id,name:s.display_name}} as any),[router]);
  const handleProfile = useCallback((s:StaffProfile)=>router.push({pathname:'/(staff)/profile',params:{id:s.id}} as any),[router]);
  const handleFav     = useCallback((id:string)=>{
    setFavorites(prev=>{const n=new Set(prev);n.has(id)?n.delete(id):n.add(id);return n;});
  },[]);
  const resetFilters  = useCallback(()=>{setQuery('');setRole('Tous');setAvail(null);setRateMax(null);setNetwork('Tous');},[]);

  /* ── Derived ── */
  const availCount = useMemo(()=>staff.filter(s=>s.is_available).length,[staff]);
  const sortLabel  = SORT_OPTIONS.find(o=>o.k===sort)?.l??'Trier';

  /* ── Render item ── */
  const renderItem = useCallback(({item,index}:{item:StaffProfile;index:number})=>(
    <StaffCard
      s={item} index={index}
      isFavorite={favorites.has(item.id)}
      onInvite={()=>handleInvite(item)}
      onChat={()=>handleChat(item)}
      onProfile={()=>handleProfile(item)}
      onFavorite={()=>handleFav(item.id)}
    />
  ),[favorites,handleInvite,handleChat,handleProfile,handleFav]);

  const keyExtractor = useCallback((i:StaffProfile)=>`stf_${i.id}`,[]);

  /* ── Render ── */
  return(
    <View style={{flex:1,backgroundColor:BG}}>
      <ParticleBg/>

      {showSort&&(
        <SortModal visible={showSort} sort={sort} onSelect={setSort} onClose={()=>setShowSort(false)}/>
      )}
      <InviteModal payload={invitePayload} onClose={()=>setInvitePayload(null)}/>

      <SafeAreaView edges={['top']} style={{flex:1}}>

        {/* ── Header ── */}
        <View style={ss.header}>
          <View style={{flex:1,gap:2}}>
            <Text style={ss.title}>Catalogue Talents</Text>
            <View style={{flexDirection:'row',alignItems:'center',gap:10}}>
              <Text style={ss.sub}>
                {loading&&staff.length===0?'Chargement…':`${totalCount} profils · ${availCount} dispo`}
              </Text>
              <LiveDot/>
            </View>
          </View>
          <TouchableOpacity
            style={[ss.sortBtn,showSort&&ss.sortBtnOn]}
            onPress={()=>setShowSort(v=>!v)}
            activeOpacity={0.75}
          >
            <Ionicons name="options-outline" size={14} color={showSort?GREEN:T.muted}/>
            <Text style={[ss.sortTxt,showSort&&{color:GREEN}]}>{sortLabel}</Text>
          </TouchableOpacity>
        </View>

        {/* ── Search ── */}
        <View style={ss.searchRow}>
          <Ionicons name="search-outline" size={16} color={T.muted}/>
          <TextInput
            style={ss.input}
            placeholder="Nom, compétence, ville, réseau…"
            placeholderTextColor={T.faint}
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="none"
          />
          {query.length>0&&(
            <TouchableOpacity onPress={()=>setQuery('')} hitSlop={10}>
              <Ionicons name="close-circle" size={16} color={T.muted}/>
            </TouchableOpacity>
          )}
        </View>

        {/* ── Stats ── */}
        <StatsBanner total={totalCount} available={availCount} loading={loading}/>

        {/* ── Availability ── */}
        <View style={{flexDirection:'row',gap:7,paddingHorizontal:EDGE,marginBottom:8}}>
          {([{k:null,l:'Tous'},{k:true,l:'Disponibles',dot:GREEN},{k:false,l:'Occupés',dot:T.amber}] as const).map(f=>(
            <TouchableOpacity
              key={String(f.k)}
              style={[ss.pill,avail===f.k&&ss.pillOn]}
              onPress={()=>setAvail(f.k)}
              activeOpacity={0.75}
            >
              {'dot' in f&&f.dot&&<View style={{width:7,height:7,borderRadius:3.5,backgroundColor:f.dot}}/>}
              <Text style={[ss.pillTxt,avail===f.k&&ss.pillTxtOn]}>{f.l}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Rate ── */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={{paddingHorizontal:EDGE,paddingBottom:8,gap:7}}>
          {RATE_PRESETS.map(p=>(
            <TouchableOpacity key={String(p.v)}
              style={[ss.ratePill,rateMax===p.v&&ss.ratePillOn]}
              onPress={()=>setRateMax(p.v)} activeOpacity={0.75}>
              <Text style={[ss.ratePillTxt,rateMax===p.v&&ss.ratePillTxtOn]}>{p.l}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* ── Network ── */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={{paddingHorizontal:EDGE,paddingBottom:8,gap:7}}>
          {NETWORKS.map(n=>(
            <TouchableOpacity key={n}
              style={[ss.netPill,network===n&&ss.netPillOn]}
              onPress={()=>setNetwork(n)} activeOpacity={0.75}>
              {network===n&&<Ionicons name="git-network-outline" size={10} color={T.purple}/>}
              <Text style={[ss.netPillTxt,network===n&&ss.netPillTxtOn]}>{n}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* ── Role ── */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={{paddingHorizontal:EDGE,paddingBottom:10,gap:8}}>
          {ROLE_FILTERS.map(r=>(
            <TouchableOpacity key={r}
              style={[ss.rolePill,role===r&&ss.rolePillOn]}
              onPress={()=>setRole(r)} activeOpacity={0.75}>
              <Text style={[ss.rolePillTxt,role===r&&ss.rolePillTxtOn]}>{r}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* ── List ── */}
        {loading&&staff.length===0?(
          <ScrollView contentContainerStyle={{padding:EDGE,paddingBottom:120}} showsVerticalScrollIndicator={false}>
            {[0,1,2,3].map(i=><SkeletonCard key={i}/>)}
          </ScrollView>
        ):(
          <FlatList
            data={staff}
            keyExtractor={keyExtractor}
            renderItem={renderItem}
            contentContainerStyle={{padding:EDGE,paddingBottom:130}}
            showsVerticalScrollIndicator={false}
            onEndReached={loadMore}
            onEndReachedThreshold={0.35}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={()=>{setRefreshing(true);triggerReset();}}
                tintColor={GREEN}
              />
            }
            ListFooterComponent={
              loadingMore
                ?<ActivityIndicator color={GREEN} style={{marginVertical:24}}/>
                :!hasMore&&staff.length>0
                  ?<Text style={{color:T.faint,fontSize:11,textAlign:'center',marginVertical:24}}>— Fin des résultats —</Text>
                  :null
            }
            ListEmptyComponent={
              <View style={{alignItems:'center',paddingTop:70,gap:14}}>
                <View style={{width:84,height:84,borderRadius:42,backgroundColor:'rgba(0,217,126,0.07)',alignItems:'center',justifyContent:'center',borderWidth:1,borderColor:T.border}}>
                  <Ionicons name="people-outline" size={38} color="rgba(0,217,126,0.40)"/>
                </View>
                <Text style={{color:T.white,fontSize:16,fontWeight:'800'}}>Aucun talent trouvé</Text>
                <Text style={{color:T.muted,fontSize:12,textAlign:'center',lineHeight:18}}>
                  Essayez d'autres filtres{'\n'}ou revenez plus tard.
                </Text>
                <TouchableOpacity
                  style={{marginTop:4,paddingHorizontal:20,paddingVertical:10,borderRadius:14,backgroundColor:T.greenDim,borderWidth:1,borderColor:T.borderHi}}
                  onPress={resetFilters}
                >
                  <Text style={{color:GREEN,fontWeight:'800',fontSize:13}}>Réinitialiser les filtres</Text>
                </TouchableOpacity>
              </View>
            }
          />
        )}
      </SafeAreaView>
    </View>
  );
}

/* ─── Screen Styles ────────────────────────────────────────────────────── */
const ss = StyleSheet.create({
  header     :{flexDirection:'row',alignItems:'center',paddingHorizontal:EDGE,paddingVertical:12,gap:12},
  title      :{color:T.white,fontSize:22,fontWeight:'900',letterSpacing:-0.4},
  sub        :{color:T.muted,fontSize:12},
  sortBtn    :{flexDirection:'row',alignItems:'center',gap:5,paddingHorizontal:12,paddingVertical:8,borderRadius:12,backgroundColor:T.surf,borderWidth:StyleSheet.hairlineWidth,borderColor:T.border},
  sortBtnOn  :{backgroundColor:T.greenDim,borderColor:T.borderHi},
  sortTxt    :{color:T.muted,fontSize:12,fontWeight:'600'},
  searchRow  :{flexDirection:'row',alignItems:'center',gap:10,marginHorizontal:EDGE,marginBottom:10,paddingHorizontal:14,height:46,borderRadius:16,backgroundColor:T.surf,borderWidth:StyleSheet.hairlineWidth,borderColor:T.border},
  input      :{flex:1,color:T.white,fontSize:14},
  pill       :{flexDirection:'row',alignItems:'center',gap:5,paddingHorizontal:12,paddingVertical:6,borderRadius:20,backgroundColor:T.surf,borderWidth:StyleSheet.hairlineWidth,borderColor:T.border},
  pillOn     :{backgroundColor:T.greenDim,borderColor:T.borderHi},
  pillTxt    :{color:T.muted,fontSize:11,fontWeight:'600'},
  pillTxtOn  :{color:GREEN,fontWeight:'800'},
  ratePill   :{paddingHorizontal:12,paddingVertical:6,borderRadius:20,backgroundColor:T.surf,borderWidth:StyleSheet.hairlineWidth,borderColor:T.border},
  ratePillOn :{backgroundColor:T.goldDim,borderColor:'rgba(245,200,66,0.35)'},
  ratePillTxt:{color:T.muted,fontSize:11,fontWeight:'600'},
  ratePillTxtOn:{color:GOLD,fontWeight:'800'},
  netPill    :{flexDirection:'row',alignItems:'center',gap:5,paddingHorizontal:12,paddingVertical:6,borderRadius:20,backgroundColor:T.surf,borderWidth:StyleSheet.hairlineWidth,borderColor:T.border},
  netPillOn  :{backgroundColor:'rgba(167,139,250,0.12)',borderColor:'rgba(167,139,250,0.30)'},
  netPillTxt :{color:T.muted,fontSize:11,fontWeight:'600'},
  netPillTxtOn:{color:T.purple,fontWeight:'800'},
  rolePill   :{paddingHorizontal:14,paddingVertical:7,borderRadius:20,backgroundColor:T.surf,borderWidth:StyleSheet.hairlineWidth,borderColor:T.border},
  rolePillOn :{backgroundColor:T.greenDim,borderColor:T.borderHi},
  rolePillTxt:{color:T.muted,fontSize:12,fontWeight:'600'},
  rolePillTxtOn:{color:GREEN,fontWeight:'800'},
});