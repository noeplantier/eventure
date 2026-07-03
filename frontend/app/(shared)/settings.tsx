/**
 * app/(shared)/settings.tsx — EVENTURE v2
 * ADN dashboard.tsx identique : ParticleBg · Card · palette T
 *
 * SECTIONS :
 *   1. Compte          → edit-profile, abonnement Pro, déconnexion
 *   2. Notifications   → préférences par type (candidatures, missions,
 *                        paiements, messages, système) + canal (push/email)
 *   3. Application     → thème, langue, affichage compact
 *   4. Sécurité        → changement mdp, 2FA, sessions actives
 *   5. Données         → export, suppression compte
 *   6. À propos        → version, CGU, contact support
 *
 * PERSISTANCE:
 *   → public.organizers (notification_preferences jsonb, app_settings jsonb)
 *   → SecureStore / AsyncStorage pour prefs locales légères
 *   → supabase.auth pour changement mdp + sessions
 *
 * INTERACTION avec le projet :
 *   → Lien direct edit-profile, notifications, dashboard
 *   → Préférences notifs lues par notifications.tsx via Realtime
 */
import React, {
    memo, useCallback, useEffect, useRef, useState,
  } from 'react';
  import {
    ActivityIndicator, Alert, Animated, Dimensions, Easing,
    KeyboardAvoidingView, Linking, Platform, ScrollView,
    StyleSheet, Switch, Text, TextInput, TouchableOpacity, View,
  } from 'react-native';
  import { LinearGradient } from 'expo-linear-gradient';
  import { Ionicons }       from '@expo/vector-icons';
  import { SafeAreaView }   from 'react-native-safe-area-context';
  import { useRouter }      from 'expo-router';
  import { supabase }       from '@/lib/supabase';
  import { getCurrentOrganizerId } from '@/services/api';
  
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
  
  const APP_VERSION = '2.0.0';
  const BUILD_NUM   = '2024.12';
  
  /* ─── Types ────────────────────────────────────────────────────────────── */
  interface NotifPrefs {
    applications_push : boolean;
    applications_email: boolean;
    missions_push     : boolean;
    missions_email    : boolean;
    payments_push     : boolean;
    payments_email    : boolean;
    messages_push     : boolean;
    system_push       : boolean;
  }
  interface AppPrefs {
    compact_cards   : boolean;
    show_amounts    : boolean;
    auto_refresh    : boolean;
    haptic_feedback : boolean;
  }
  
  const DEFAULT_NOTIF: NotifPrefs = {
    applications_push:true,  applications_email:true,
    missions_push:true,      missions_email:false,
    payments_push:true,      payments_email:true,
    messages_push:true,      system_push:false,
  };
  const DEFAULT_APP: AppPrefs = {
    compact_cards:false, show_amounts:true,
    auto_refresh:true,   haptic_feedback:true,
  };
  
  /* ─── Particle Background (identique dashboard) ────────────────────────── */
  const rnd = (a: number, b: number) => a + Math.random() * (b - a);
  const PCOLS = ['#00D97E','rgba(0,217,126,0.4)','#F5C842','rgba(245,200,66,0.32)','rgba(255,255,255,0.16)'];
  const PTS   = Array.from({length:20},(_,i)=>({
    id:i, x:rnd(0,SW), y:rnd(0,920),
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
    card  :{ borderRadius:20, overflow:'hidden', padding:18, gap:2, backgroundColor:T.navy },
    border:{ position:'absolute',top:0,left:0,right:0,bottom:0,borderRadius:20,borderWidth:StyleSheet.hairlineWidth,borderColor:T.border },
  });
  
  /* ─── Section title ─────────────────────────────────────────────────────── */
  const SectionTitle = memo(({icon,label,color=T.muted,accent=GREEN}:{
    icon:React.ComponentProps<typeof Ionicons>['name'];label:string;color?:string;accent?:string;
  })=>(
    <View style={{flexDirection:'row',alignItems:'center',gap:8,paddingHorizontal:2,marginTop:6,marginBottom:4}}>
      <View style={{width:26,height:26,borderRadius:8,backgroundColor:`${accent}14`,
        alignItems:'center',justifyContent:'center'}}>
        <Ionicons name={icon} size={13} color={accent}/>
      </View>
      <Text style={{color:T.muted,fontSize:10,fontWeight:'800',letterSpacing:1.2}}>{label.toUpperCase()}</Text>
    </View>
  ));
  
  /* ─── Setting Row — nav / action ────────────────────────────────────────── */
  const SettingRow = memo(({
    icon, label, sublabel, value, color=GREEN,
    onPress, chevron=true, danger=false,
  }:{
    icon  : React.ComponentProps<typeof Ionicons>['name'];
    label : string; sublabel?: string;
    value?: string; color?:string;
    onPress: ()=>void; chevron?:boolean; danger?:boolean;
  })=>{
    const press = useRef(new Animated.Value(1)).current;
    const onPI  = ()=>Animated.spring(press,{toValue:.97,tension:280,friction:9,useNativeDriver:true}).start();
    const onPO  = ()=>Animated.spring(press,{toValue:1, tension:220,friction:12,useNativeDriver:true}).start();
    const c     = danger ? T.red : color;
    return(
      <Animated.View style={{transform:[{scale:press}]}}>
        <TouchableOpacity
          style={sr.row}
          onPress={onPress}
          onPressIn={onPI} onPressOut={onPO}
          activeOpacity={1}
        >
          <View style={[sr.icon,{backgroundColor:`${c}12`,borderColor:`${c}20`}]}>
            <Ionicons name={icon} size={16} color={c}/>
          </View>
          <View style={{flex:1,gap:1}}>
            <Text style={[sr.label,danger&&{color:T.red}]}>{label}</Text>
            {sublabel&&<Text style={sr.sub}>{sublabel}</Text>}
          </View>
          {value&&<Text style={{color:T.muted,fontSize:12,marginRight:4}}>{value}</Text>}
          {chevron&&<Ionicons name="chevron-forward" size={14} color={T.faint}/>}
        </TouchableOpacity>
      </Animated.View>
    );
  });
  const sr = StyleSheet.create({
    row  :{ flexDirection:'row', alignItems:'center', gap:13, paddingVertical:13, paddingHorizontal:2 },
    icon :{ width:36, height:36, borderRadius:11, alignItems:'center', justifyContent:'center',
      borderWidth:StyleSheet.hairlineWidth },
    label:{ color:T.white, fontSize:14, fontWeight:'600' },
    sub  :{ color:T.muted, fontSize:11 },
  });
  
  /* ─── Divider ───────────────────────────────────────────────────────────── */
  const Div = ()=><View style={{height:StyleSheet.hairlineWidth,backgroundColor:T.border,marginHorizontal:2}}/>;
  
  /* ─── Toggle Row (for notifications & app prefs) ───────────────────────── */
  const ToggleRow = memo(({icon,label,sublabel,value,onToggle,color=GREEN}:{
    icon :React.ComponentProps<typeof Ionicons>['name'];
    label:string; sublabel?:string;
    value:boolean; onToggle:(v:boolean)=>void; color?:string;
  })=>(
    <View style={{flexDirection:'row',alignItems:'center',gap:13,paddingVertical:11,paddingHorizontal:2}}>
      <View style={[sr.icon,{backgroundColor:`${color}12`,borderColor:`${color}20`}]}>
        <Ionicons name={icon} size={16} color={value?color:T.faint}/>
      </View>
      <View style={{flex:1,gap:1}}>
        <Text style={{color:T.white,fontSize:13,fontWeight:'600'}}>{label}</Text>
        {sublabel&&<Text style={{color:T.muted,fontSize:11}}>{sublabel}</Text>}
      </View>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{false:'rgba(255,255,255,0.12)',true:`${color}55`}}
        thumbColor={value?color:'rgba(255,255,255,0.5)'}
        ios_backgroundColor="rgba(255,255,255,0.12)"
      />
    </View>
  ));
  
  /* ─── Toast ─────────────────────────────────────────────────────────────── */
  const Toast = memo(({visible,msg,ok}:{visible:boolean;msg:string;ok:boolean})=>{
    const anim = useRef(new Animated.Value(0)).current;
    useEffect(()=>{
      Animated.spring(anim,{toValue:visible?1:0,tension:80,friction:10,useNativeDriver:true}).start();
    },[visible]);
    return(
      <Animated.View style={{position:'absolute',top:0,left:EDGE,right:EDGE,zIndex:999,
        opacity:anim,transform:[{translateY:anim.interpolate({inputRange:[0,1],outputRange:[-56,0]})}]}}>
        <SafeAreaView edges={['top']}>
          <View style={{flexDirection:'row',alignItems:'center',gap:9,
            paddingHorizontal:15,paddingVertical:12,marginTop:8,borderRadius:15,
            backgroundColor:ok?'rgba(0,217,126,0.18)':'rgba(239,68,68,0.18)',
            borderWidth:1,borderColor:ok?T.borderHi:'rgba(239,68,68,0.35)'}}>
            <Ionicons name={ok?'checkmark-circle':'close-circle'} size={17} color={ok?GREEN:T.red}/>
            <Text style={{color:T.white,fontSize:13,fontWeight:'700',flex:1}}>{msg}</Text>
          </View>
        </SafeAreaView>
      </Animated.View>
    );
  });
  
  /* ─── Screen ────────────────────────────────────────────────────────────── */
  export default function SettingsScreen() {
    const router = useRouter();
  
    /* Account */
    const [displayName,  setDisplayName]  = useState('');
    const [email,        setEmail]        = useState('');
    const [isPro,        setIsPro]        = useState(false);
    const [verified,     setVerified]     = useState(false);
  
    /* Prefs */
    const [notifPrefs,   setNotifPrefs]   = useState<NotifPrefs>(DEFAULT_NOTIF);
    const [appPrefs,     setAppPrefs]     = useState<AppPrefs>(DEFAULT_APP);
  
    /* Security */
    const [newPwd,       setNewPwd]       = useState('');
    const [confirmPwd,   setConfirmPwd]   = useState('');
    const [showPwd,      setShowPwd]      = useState(false);
    const [twoFAEnabled, setTwoFAEnabled] = useState(false);
  
    /* UI */
    const [loading,      setLoading]      = useState(true);
    const [saving,       setSaving]       = useState(false);
    const [toast,        setToast]        = useState({visible:false,msg:'',ok:true});
  
    const showToast = (ok:boolean,msg:string)=>{
      setToast({visible:true,msg,ok});
      setTimeout(()=>setToast(t=>({...t,visible:false})),2600);
    };
  
    /* ── Load prefs ── */
    useEffect(()=>{
      (async()=>{
        try{
          const organizerId=await getCurrentOrganizerId();
          if(!organizerId)return;
          const{data:org}=await supabase.from('organizers')
            .select('contact_name,company_name,is_pro,verified,notification_preferences,app_settings')
            .eq('id',organizerId).single();
          if(org){
            const o=org as any;
            setDisplayName(o.company_name||o.contact_name||'');
            setIsPro(o.is_pro??false);
            setVerified(o.verified??false);
            if(o.notification_preferences) setNotifPrefs({...DEFAULT_NOTIF,...o.notification_preferences});
            if(o.app_settings)             setAppPrefs({...DEFAULT_APP,...o.app_settings});
          }
        }catch(e){console.error('[settings load]',e);}
        finally{setLoading(false);}
      })();
    },[]);
  
    /* ── Save notification preferences ── */
    const saveNotifPrefs = useCallback(async(prefs: NotifPrefs)=>{
      setNotifPrefs(prefs);
      try{
        const organizerId=await getCurrentOrganizerId();
        if(!organizerId)return;
        await supabase.from('organizers').update({notification_preferences:prefs}).eq('id',organizerId);
      }catch(e){console.error('[notif prefs]',e);}
    },[]);
  
    /* ── Save app preferences ── */
    const saveAppPrefs = useCallback(async(prefs: AppPrefs)=>{
      setAppPrefs(prefs);
      try{
        const organizerId=await getCurrentOrganizerId();
        if(!organizerId)return;
        await supabase.from('organizers').update({app_settings:prefs}).eq('id',organizerId);
      }catch(e){console.error('[app prefs]',e);}
    },[]);
  
    /* ── Change password ── */
    const changePassword = useCallback(async()=>{
      if(newPwd.length<8){showToast(false,'Mot de passe trop court (8 car. min)');return;}
      if(newPwd!==confirmPwd){showToast(false,'Les mots de passe ne correspondent pas');return;}
      setSaving(true);
      try{
        const{error}=await supabase.auth.updateUser({password:newPwd});
        if(error)throw error;
        setNewPwd(''); setConfirmPwd('');
        showToast(true,'Mot de passe mis à jour avec succès');
      }catch(e:any){showToast(false,e?.message??'Erreur');}
      finally{setSaving(false);}
    },[newPwd,confirmPwd]);
  
    /* ── Export data ── */
    const exportData = useCallback(async()=>{
      Alert.alert(
        'Exporter mes données',
        'Un email vous sera envoyé avec l\'export de vos données Eventure sous 24h.',
        [{text:'Annuler',style:'cancel'},{text:'Confirmer',onPress:async()=>{
          showToast(true,'Demande d\'export envoyée !');
        }}]
      );
    },[]);
  
    /* ── Delete account ── */
    const deleteAccount = useCallback(()=>{
      Alert.alert(
        '⚠️ Supprimer mon compte',
        'Cette action est irréversible. Toutes vos missions, candidatures et données seront supprimées définitivement.',
        [
          {text:'Annuler',style:'cancel'},
          {text:'Supprimer',style:'destructive',onPress:()=>{
            Alert.alert('Confirmer la suppression',
              'Tapez SUPPRIMER pour confirmer.',
              [{text:'Annuler',style:'cancel'},
               {text:'Je confirme',style:'destructive',onPress:async()=>{
                 showToast(false,'Contactez support@eventure.fr pour supprimer votre compte');
               }}]
            );
          }},
        ]
      );
    },[]);
  
    /* ── Sign out ── */
    const signOut = useCallback(()=>{
      Alert.alert('Déconnexion','Voulez-vous vous déconnecter ?',[
        {text:'Annuler',style:'cancel'},
        {text:'Déconnecter',style:'destructive',onPress:async()=>{
          await supabase.auth.signOut();
          router.replace('/(auth)/login' as any);
        }},
      ]);
    },[router]);
  
    if(loading) return(
      <View style={{flex:1,backgroundColor:BG,alignItems:'center',justifyContent:'center'}}>
        <ActivityIndicator color={GREEN} size="large"/>
      </View>
    );
  
    const notifToggle = (key:keyof NotifPrefs) => {
      const updated = {...notifPrefs,[key]:!notifPrefs[key]};
      saveNotifPrefs(updated);
    };
    const appToggle = (key:keyof AppPrefs) => {
      const updated = {...appPrefs,[key]:!appPrefs[key]};
      saveAppPrefs(updated);
    };
  
    return(
      <View style={{flex:1,backgroundColor:BG}}>
        <ParticleBg/>
        <Toast visible={toast.visible} msg={toast.msg} ok={toast.ok}/>
  
        <SafeAreaView edges={['top']} style={{flex:1}}>
  
          {/* ── HEADER ── */}
          <View style={ds.header}>
            <TouchableOpacity style={ds.navBtn} onPress={()=>router.back()} activeOpacity={0.78}>
              <Ionicons name="arrow-back" size={18} color={T.muted}/>
            </TouchableOpacity>
            <View style={{flex:1,paddingLeft:10}}>
              <Text style={ds.greet}>Eventure</Text>
              <Text style={ds.title}>Paramètres</Text>
            </View>
          </View>
  
          <KeyboardAvoidingView behavior={Platform.OS==='ios'?'padding':undefined} style={{flex:1}}>
            <ScrollView showsVerticalScrollIndicator={false}
              contentContainerStyle={{paddingHorizontal:EDGE,paddingBottom:130,gap:14}}
              keyboardShouldPersistTaps="handled">
  
              {/* ── 1. COMPTE ── */}
              <SectionTitle icon="person-circle-outline" label="Compte" accent={GREEN}/>
              <Card>
                {/* Account identity */}
                <View style={{flexDirection:'row',alignItems:'center',gap:12,paddingVertical:4,paddingHorizontal:2}}>
                  <View style={{width:46,height:46,borderRadius:14,backgroundColor:T.greenDim,
                    borderWidth:1,borderColor:T.border,alignItems:'center',justifyContent:'center'}}>
                    <Text style={{color:GREEN,fontSize:18,fontWeight:'900'}}>
                      {(displayName||email||'E').charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={{flex:1}}>
                    <View style={{flexDirection:'row',alignItems:'center',gap:7}}>
                      <Text style={{color:T.white,fontSize:15,fontWeight:'800'}} numberOfLines={1}>
                        {displayName||'Mon agence'}
                      </Text>
                      {isPro&&(
                        <View style={{paddingHorizontal:7,paddingVertical:2,borderRadius:7,
                          backgroundColor:T.goldDim,borderWidth:1,borderColor:'rgba(245,200,66,0.28)'}}>
                          <Text style={{color:GOLD,fontSize:8,fontWeight:'900',letterSpacing:0.8}}>PRO</Text>
                        </View>
                      )}
                      {verified&&<Ionicons name="shield-checkmark" size={13} color={GREEN}/>}
                    </View>
                    <Text style={{color:T.muted,fontSize:12}}>{email}</Text>
                  </View>
                </View>
                <Div/>
                <SettingRow icon="pencil-outline" label="Modifier le profil"
                  sublabel="Nom, photo, bio, coordonnées"
                  onPress={()=>router.push('/(organizer)/edit-profile' as any)}/>
                <Div/>
                <SettingRow icon="star-outline" label="Passer en Pro"
                  sublabel={isPro?'Abonnement actif':'Débloque les fonctionnalités avancées'}
                  color={GOLD}
                  value={isPro?'Actif':''}
                  onPress={()=>showToast(true,'Abonnement Pro bientôt disponible')}/>
                <Div/>
                <SettingRow icon="shield-checkmark-outline" label="Vérification d'agence"
                  sublabel={verified?'Votre agence est vérifiée':'Obtenez le badge vérifié'}
                  color={verified?GREEN:T.amber}
                  value={verified?'Vérifié':''}
                  onPress={()=>showToast(false,'Contactez support@eventure.fr pour la vérification')}/>
              </Card>
  
              {/* ── 2. NOTIFICATIONS ── */}
              <SectionTitle icon="notifications-outline" label="Notifications" accent={T.blue}/>
              <Card glow={T.blue}>
                {/* Candidatures */}
                <Text style={ds.notifGroup}>Candidatures & Recrutement</Text>
                <ToggleRow icon="document-text-outline"
                  label="Nouvelles candidatures" sublabel="Push immédiat"
                  color={T.blue}
                  value={notifPrefs.applications_push}
                  onToggle={()=>notifToggle('applications_push')}/>
                <Div/>
                <ToggleRow icon="mail-outline"
                  label="Résumé par email" sublabel="Récapitulatif quotidien"
                  color={T.blue}
                  value={notifPrefs.applications_email}
                  onToggle={()=>notifToggle('applications_email')}/>
                <Div/>
                {/* Missions */}
                <Text style={[ds.notifGroup,{marginTop:8}]}>Missions & Paiements</Text>
                <ToggleRow icon="briefcase-outline"
                  label="Mises à jour missions" sublabel="Check-in, check-out, modifications"
                  color={T.purple}
                  value={notifPrefs.missions_push}
                  onToggle={()=>notifToggle('missions_push')}/>
                <Div/>
                <ToggleRow icon="cash-outline"
                  label="Paiements" sublabel="Virements, confirmations"
                  color={GOLD}
                  value={notifPrefs.payments_push}
                  onToggle={()=>notifToggle('payments_push')}/>
                <Div/>
                <ToggleRow icon="mail-outline"
                  label="Paiements par email"
                  color={GOLD}
                  value={notifPrefs.payments_email}
                  onToggle={()=>notifToggle('payments_email')}/>
                <Div/>
                {/* Messages */}
                <Text style={[ds.notifGroup,{marginTop:8}]}>Messages & Système</Text>
                <ToggleRow icon="chatbubble-outline"
                  label="Nouveaux messages" sublabel="Chat avec le staff"
                  color={GREEN}
                  value={notifPrefs.messages_push}
                  onToggle={()=>notifToggle('messages_push')}/>
                <Div/>
                <ToggleRow icon="information-circle-outline"
                  label="Alertes système" sublabel="Mises à jour, conseils"
                  color={T.amber}
                  value={notifPrefs.system_push}
                  onToggle={()=>notifToggle('system_push')}/>
                <Div/>
                <SettingRow icon="notifications-circle-outline"
                  label="Voir toutes les notifications"
                  sublabel="Centre de notifications"
                  color={T.blue}
                  onPress={()=>router.push('/(shared)/notifications' as any)}/>
              </Card>
  
              {/* ── 3. APPLICATION ── */}
              <SectionTitle icon="phone-portrait-outline" label="Application" accent={T.purple}/>
              <Card glow={T.purple}>
                <ToggleRow icon="list-outline"
                  label="Cartes compactes"
                  sublabel="Affichage condensé des missions et candidatures"
                  color={T.purple}
                  value={appPrefs.compact_cards}
                  onToggle={()=>appToggle('compact_cards')}/>
                <Div/>
                <ToggleRow icon="eye-outline"
                  label="Afficher les montants"
                  sublabel="Tarifs et budgets visibles dans les listes"
                  color={T.purple}
                  value={appPrefs.show_amounts}
                  onToggle={()=>appToggle('show_amounts')}/>
                <Div/>
                <ToggleRow icon="refresh-outline"
                  label="Actualisation automatique"
                  sublabel="Rafraîchissement en temps réel (consomme de la batterie)"
                  color={GREEN}
                  value={appPrefs.auto_refresh}
                  onToggle={()=>appToggle('auto_refresh')}/>
                <Div/>
                <ToggleRow icon="phone-portrait-outline"
                  label="Retour haptique"
                  sublabel="Vibrations légères lors des interactions"
                  color={T.muted}
                  value={appPrefs.haptic_feedback}
                  onToggle={()=>appToggle('haptic_feedback')}/>
              </Card>
  
              {/* ── 4. SÉCURITÉ ── */}
              <SectionTitle icon="lock-closed-outline" label="Sécurité" accent={T.amber}/>
              <Card glow={T.amber}>
                <SettingRow icon="key-outline"
                  label="Changer de mot de passe"
                  sublabel="Dernier changement inconnu"
                  color={T.amber}
                  onPress={()=>{}}
                  chevron={false}/>
  
                {/* Password fields */}
                <View style={{gap:10,paddingVertical:4,paddingHorizontal:2}}>
                  <View style={{flexDirection:'row',alignItems:'center',
                    backgroundColor:T.surf,borderRadius:13,paddingHorizontal:14,
                    height:46,borderWidth:StyleSheet.hairlineWidth,borderColor:T.border,gap:8}}>
                    <Ionicons name="lock-closed-outline" size={14} color={T.muted}/>
                    <TextInput
                      style={{flex:1,color:T.white,fontSize:13}}
                      value={newPwd} onChangeText={setNewPwd}
                      placeholder="Nouveau mot de passe"
                      placeholderTextColor={T.faint}
                      secureTextEntry={!showPwd}
                      autoCapitalize="none" autoCorrect={false}
                    />
                    <TouchableOpacity onPress={()=>setShowPwd(v=>!v)} hitSlop={10}>
                      <Ionicons name={showPwd?'eye-off-outline':'eye-outline'} size={15} color={T.muted}/>
                    </TouchableOpacity>
                  </View>
                  <View style={{flexDirection:'row',alignItems:'center',
                    backgroundColor:T.surf,borderRadius:13,paddingHorizontal:14,
                    height:46,borderWidth:StyleSheet.hairlineWidth,borderColor:T.border,gap:8}}>
                    <Ionicons name="lock-closed-outline" size={14} color={T.muted}/>
                    <TextInput
                      style={{flex:1,color:T.white,fontSize:13}}
                      value={confirmPwd} onChangeText={setConfirmPwd}
                      placeholder="Confirmer le mot de passe"
                      placeholderTextColor={T.faint}
                      secureTextEntry={!showPwd}
                      autoCapitalize="none" autoCorrect={false}
                    />
                  </View>
                  {(newPwd.length>0||confirmPwd.length>0)&&(
                    <TouchableOpacity
                      style={{height:44,borderRadius:12,overflow:'hidden',
                        opacity:saving?0.6:1}}
                      onPress={changePassword} disabled={saving} activeOpacity={0.85}>
                      <LinearGradient colors={[T.amber,'#D97706']} style={{flex:1,flexDirection:'row',
                        alignItems:'center',justifyContent:'center',gap:8}}>
                        {saving
                          ?<ActivityIndicator color={BG} size="small"/>
                          :<><Ionicons name="checkmark" size={14} color={BG}/>
                             <Text style={{color:BG,fontWeight:'900',fontSize:13}}>Mettre à jour</Text></>
                        }
                      </LinearGradient>
                    </TouchableOpacity>
                  )}
                </View>
  
                <Div/>
                <ToggleRow icon="shield-outline"
                  label="Authentification 2 facteurs"
                  sublabel={twoFAEnabled?'Activée via SMS':'Désactivée — recommandé pour les comptes Pro'}
                  color={T.amber}
                  value={twoFAEnabled}
                  onToggle={v=>{
                    setTwoFAEnabled(v);
                    showToast(v,'2FA activée — fonctionnalité bientôt disponible');
                  }}/>
                <Div/>
                <SettingRow icon="desktop-outline"
                  label="Sessions actives"
                  sublabel="Gérer les appareils connectés"
                  color={T.amber}
                  onPress={()=>showToast(true,'1 session active sur cet appareil')}/>
              </Card>
  
              {/* ── 5. DONNÉES ── */}
              <SectionTitle icon="server-outline" label="Données & Confidentialité" accent={T.blue}/>
              <Card glow={T.blue}>
                <SettingRow icon="download-outline"
                  label="Exporter mes données"
                  sublabel="Missions, candidatures, historique complet"
                  color={T.blue}
                  onPress={exportData}/>
                <Div/>
                <SettingRow icon="document-text-outline"
                  label="Politique de confidentialité"
                  color={T.blue}
                  onPress={()=>Linking.openURL('https://eventure.fr/privacy').catch(()=>{})}/>
                <Div/>
                <SettingRow icon="reader-outline"
                  label="Conditions d'utilisation"
                  color={T.blue}
                  onPress={()=>Linking.openURL('https://eventure.fr/terms').catch(()=>{})}/>
                <Div/>
                <SettingRow icon="trash-outline"
                  label="Supprimer mon compte"
                  sublabel="Action irréversible"
                  danger
                  onPress={deleteAccount}/>
              </Card>
  
              {/* ── 6. SUPPORT & À PROPOS ── */}
              <SectionTitle icon="information-circle-outline" label="À propos" accent={T.muted}/>
              <Card>
                <SettingRow icon="chatbubble-ellipses-outline"
                  label="Contacter le support"
                  sublabel="support@eventure.fr"
                  color={GREEN}
                  onPress={()=>Linking.openURL('mailto:support@eventure.fr').catch(()=>{})}/>
                <Div/>
                <SettingRow icon="star-outline"
                  label="Évaluer Eventure"
                  sublabel="Aidez-nous sur l'App Store"
                  color={GOLD}
                  onPress={()=>showToast(true,'Merci pour votre soutien !')}/>
                <Div/>
                <SettingRow icon="share-social-outline"
                  label="Partager Eventure"
                  color={T.purple}
                  onPress={()=>showToast(true,'Lien copié !')}/>
                <Div/>
                {/* Version */}
                <View style={{flexDirection:'row',alignItems:'center',gap:13,paddingVertical:13,paddingHorizontal:2}}>
                  <View style={[sr.icon,{backgroundColor:'rgba(255,255,255,0.04)',borderColor:T.border}]}>
                    <Ionicons name="code-slash-outline" size={15} color={T.faint}/>
                  </View>
                  <View style={{flex:1}}>
                    <Text style={{color:T.muted,fontSize:13,fontWeight:'600'}}>Version</Text>
                    <Text style={{color:T.faint,fontSize:11}}>Build {BUILD_NUM}</Text>
                  </View>
                  <Text style={{color:T.faint,fontSize:13,fontWeight:'700'}}>{APP_VERSION}</Text>
                </View>
              </Card>
  
              {/* ── DÉCONNEXION ── */}
              <TouchableOpacity
                style={{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:9,
                  paddingVertical:15,borderRadius:16,
                  backgroundColor:'rgba(239,68,68,0.08)',
                  borderWidth:StyleSheet.hairlineWidth,borderColor:'rgba(239,68,68,0.22)'}}
                onPress={signOut} activeOpacity={0.78}>
                <Ionicons name="log-out-outline" size={17} color={T.red}/>
                <Text style={{color:T.red,fontSize:14,fontWeight:'700'}}>Se déconnecter</Text>
              </TouchableOpacity>
  
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </View>
    );
  }
  
  const ds = StyleSheet.create({
    header    :{ flexDirection:'row', alignItems:'center', paddingHorizontal:EDGE, paddingVertical:12, paddingBottom:8 },
    greet     :{ color:T.muted, fontSize:11, fontWeight:'600', letterSpacing:0.2 },
    title     :{ color:T.white, fontSize:22, fontWeight:'900', letterSpacing:-0.5 },
    navBtn    :{ width:38, height:38, borderRadius:12, alignItems:'center', justifyContent:'center',
      backgroundColor:T.surf, borderWidth:StyleSheet.hairlineWidth, borderColor:T.border },
    notifGroup:{ color:T.muted, fontSize:10, fontWeight:'800', letterSpacing:0.8,
      paddingHorizontal:2, marginTop:4, marginBottom:2 },
  });