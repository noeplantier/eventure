/**
 * app/(organizer)/edit-profile.tsx — EVENTURE v2
 * ADN dashboard + profile · Édition profil organisateur
 *
 * TABLES:
 *   public.organizers  → UPDATE (contact_name, company_name, bio, avatar_url,
 *                                location, website, phone, specialties)
 *   public.profiles    → UPSERT fallback (display_name, company_name, ...)
 *   supabase.storage   → bucket 'avatars' pour upload photo
 *
 * INTERACTION avec profile.tsx :
 *   → Lit les données depuis organizers + profiles (même fallback que profile.tsx)
 *   → Après save : router.back() → profile.tsx se rafraîchit via Realtime
 *     (channel 'profile_rt' déjà souscrit côté profile.tsx)
 *
 * UX : 3 sections accordéon (Identité · Agence · Spécialités)
 *   + Photo picker (camera/galerie) + prévisualisation live
 *   + Validation inline + compteurs de caractères
 *   + Toast de confirmation animé
 */
import React, {
    memo, useCallback, useEffect, useRef, useState,
  } from 'react';
  import {
    ActionSheetIOS, ActivityIndicator, Alert, Animated,
    Dimensions, Easing, Image, KeyboardAvoidingView,
    Linking, Platform, Pressable, ScrollView, StyleSheet,
    Text, TextInput, TouchableOpacity, View,
  } from 'react-native';
  import { LinearGradient }   from 'expo-linear-gradient';
  import { Ionicons }         from '@expo/vector-icons';
  import { SafeAreaView }     from 'react-native-safe-area-context';
  import { useRouter }        from 'expo-router';
  import * as ImagePicker     from 'expo-image-picker';
  import { supabase }         from '@/lib/supabase';
  import { getCurrentOrganizerId } from '@/services/api';
  import { AURA }             from '@/constants/aura-theme';
  import Aura                 from '@/components/Aura';
  
  /* ─── Palette & Layout (Aura — dark, futuristic, professionnel) ────────── */
  const { width: SW } = Dimensions.get('window');
  const BG    = AURA.bg;
  const GREEN = AURA.primary;
  const GOLD  = AURA.warning;
  const EDGE  = 20;
  
  const T = {
    white   : AURA.text,
    offWhite: AURA.text,
    muted   : AURA.textSub,
    faint   : AURA.textMuted,
    surf    : AURA.surfaceAlt,
    surfHi  : AURA.surface,
    border  : AURA.border,
    borderHi: AURA.primaryBorder,
    greenDim: AURA.primaryGhost,
    goldDim : AURA.warningGhost,
    goldBd  : 'rgba(251,191,36,0.30)',
    navy    : AURA.surface,
    amber   : AURA.warning,
    red     : AURA.danger,
    blue    : AURA.cyan,
    purple  : AURA.secondary,
  } as const;
  
  /* ─── Form state ───────────────────────────────────────────────────────── */
  interface FormState {
    display_name : string;   // contact_name dans organizers
    company_name : string;
    bio          : string;
    location     : string;
    website      : string;
    phone        : string;
    instagram    : string;
    linkedin     : string;
    avatar_url   : string;
    specialties  : string[]; // tags libres
    event_types  : string[]; // types d'événements gérés
  }
  
  const EMPTY: FormState = {
    display_name:'', company_name:'', bio:'', location:'',
    website:'', phone:'', instagram:'', linkedin:'',
    avatar_url:'', specialties:[], event_types:[],
  };
  
  const EVENT_TYPES_OPTIONS = [
    'Gala','Festival','Conférence','Mariage','Séminaire',
    'Soirée','Concert','Sport','Lancement produit','Team building',
  ];
  
  const SPECIALTY_PRESETS = [
    'Luxury Events','Corporate','Wedding Planner','Festival',
    'Gastronomie','VIP','International','Sport Events',
    'Culture & Arts','Tech Events',
  ];
  
  /* ─── Particle background (identique dashboard) ────────────────────────── */
  const rnd = (a: number, b: number) => a + Math.random() * (b - a);
  const PCOLS = [AURA.primary,'rgba(129,140,248,0.4)',AURA.warning,'rgba(251,191,36,0.32)','rgba(255,255,255,0.16)'];
  const PTS   = Array.from({length:18},(_,i)=>({
    id:i, x:rnd(0,SW), y:rnd(0,900),
    sz:rnd(0.8,2.4), col:PCOLS[i%PCOLS.length], op:0.04+(i%6)*0.03,
  }));
  const ParticleBg = memo(() => (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient colors={[BG,AURA.bgElevated,BG]} style={StyleSheet.absoluteFill}/>
      <View style={{position:'absolute',top:'6%',left:'12%',width:SW*.7,height:SW*.7,borderRadius:SW*.35,backgroundColor:'rgba(129,140,248,0.05)'}}/>
      <View style={{position:'absolute',bottom:'8%',right:'-18%',width:SW*.6,height:SW*.6,borderRadius:SW*.3,backgroundColor:'rgba(251,191,36,0.04)'}}/>
      {PTS.map(p=><View key={p.id} style={{position:'absolute',left:p.x,top:p.y,width:p.sz,height:p.sz,borderRadius:p.sz/2,backgroundColor:p.col,opacity:p.op}}/>)}
    </View>
  ));
  
  /* ─── Card shell (identique dashboard) ─────────────────────────────────── */
  const Card = memo(({children,style,glow=GREEN}:{children:React.ReactNode;style?:any;glow?:string}) => (
    <View style={[cds.card, style]}>
      <LinearGradient colors={[`${glow}0B`,`${glow}03`]} style={StyleSheet.absoluteFillObject}/>
      {children}
      <View pointerEvents="none" style={cds.border}/>
    </View>
  ));
  const cds = StyleSheet.create({
    card  : { borderRadius:20, overflow:'hidden', padding:18, gap:14, backgroundColor:T.navy },
    border: { position:'absolute',top:0,left:0,right:0,bottom:0,borderRadius:20,borderWidth:StyleSheet.hairlineWidth,borderColor:T.border },
  });
  
  /* ─── Section header (accordéon simplifié) ──────────────────────────────── */
  const SectionHeader = memo(({
    icon, title, subtitle, open, onToggle, accent=GREEN,
  }:{
    icon:React.ComponentProps<typeof Ionicons>['name'];
    title:string; subtitle?:string; open:boolean;
    onToggle:()=>void; accent?:string;
  }) => {
    const rot = useRef(new Animated.Value(open?1:0)).current;
    useEffect(() => {
      Animated.spring(rot,{toValue:open?1:0,tension:100,friction:10,useNativeDriver:true}).start();
    },[open]);
    return(
      <TouchableOpacity onPress={onToggle} activeOpacity={0.80}
        style={{flexDirection:'row',alignItems:'center',gap:12,marginBottom:open?16:0}}>
        <View style={{width:38,height:38,borderRadius:12,
          backgroundColor:open?`${accent}18`:T.surf,
          borderWidth:1,borderColor:open?`${accent}30`:T.border,
          alignItems:'center',justifyContent:'center'}}>
          <Ionicons name={icon} size={17} color={open?accent:T.muted}/>
        </View>
        <View style={{flex:1}}>
          <Text style={{color:open?T.white:T.offWhite,fontSize:14,fontWeight:'800',letterSpacing:-0.2}}>
            {title}
          </Text>
          {subtitle&&<Text style={{color:T.muted,fontSize:10,marginTop:1}}>{subtitle}</Text>}
        </View>
        <Animated.View style={{transform:[{rotate:rot.interpolate({inputRange:[0,1],outputRange:['0deg','90deg']})}]}}>
          <Ionicons name="chevron-forward" size={16} color={T.muted}/>
        </Animated.View>
      </TouchableOpacity>
    );
  });
  
  /* ─── Styled TextInput ──────────────────────────────────────────────────── */
  const Field = memo(({
    label, value, onChangeText, placeholder, maxLength,
    keyboardType, multiline, numberOfLines, prefix, suffix,
    error, hint,
  }:{
    label:string; value:string; onChangeText:(v:string)=>void;
    placeholder?:string; maxLength?:number; keyboardType?:any;
    multiline?:boolean; numberOfLines?:number;
    prefix?:string; suffix?:string; error?:string; hint?:string;
  }) => {
    const [focused, setFocused] = useState(false);
    const focusAnim = useRef(new Animated.Value(0)).current;
    const onFocus = () => {
      setFocused(true);
      Animated.timing(focusAnim,{toValue:1,duration:200,useNativeDriver:false}).start();
    };
    const onBlur = () => {
      setFocused(false);
      Animated.timing(focusAnim,{toValue:0,duration:200,useNativeDriver:false}).start();
    };
    const borderColor = focusAnim.interpolate({
      inputRange:[0,1],
      outputRange:[error?T.red:T.border, error?T.red:T.borderHi],
    });
    return(
      <View style={{gap:6}}>
        <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center'}}>
          <Text style={{color:T.muted,fontSize:11,fontWeight:'700',letterSpacing:0.3}}>{label}</Text>
          {maxLength&&(
            <Text style={{color:value.length>maxLength*0.85?T.amber:T.faint,fontSize:10}}>
              {value.length}/{maxLength}
            </Text>
          )}
        </View>
        <Animated.View style={{
          flexDirection:'row',alignItems:multiline?'flex-start':'center',
          backgroundColor:T.surf,borderRadius:14,
          borderWidth:1,borderColor,
          paddingHorizontal:14,
          paddingVertical:multiline?12:0,
          minHeight:multiline?(numberOfLines??3)*22+24:48,
        }}>
          {prefix&&(
            <Text style={{color:T.muted,fontSize:14,marginRight:6,paddingTop:multiline?2:0}}>{prefix}</Text>
          )}
          <TextInput
            style={{
              flex:1, color:T.white, fontSize:14,
              paddingVertical:multiline?0:14,
              lineHeight:multiline?22:undefined,
              textAlignVertical:multiline?'top':undefined,
            }}
            value={value}
            onChangeText={onChangeText}
            onFocus={onFocus}
            onBlur={onBlur}
            placeholder={placeholder}
            placeholderTextColor={T.faint}
            keyboardType={keyboardType??'default'}
            multiline={multiline}
            numberOfLines={numberOfLines}
            maxLength={maxLength}
            autoCorrect={false}
            autoCapitalize={keyboardType==='email-address'?'none':undefined}
          />
          {suffix&&(
            <Text style={{color:T.muted,fontSize:12,paddingTop:multiline?2:0}}>{suffix}</Text>
          )}
        </Animated.View>
        {error&&(
          <View style={{flexDirection:'row',alignItems:'center',gap:5}}>
            <Ionicons name="alert-circle-outline" size={12} color={T.red}/>
            <Text style={{color:T.red,fontSize:11}}>{error}</Text>
          </View>
        )}
        {hint&&!error&&(
          <Text style={{color:T.faint,fontSize:10,lineHeight:14}}>{hint}</Text>
        )}
      </View>
    );
  });
  
  /* ─── Tag toggle pill ───────────────────────────────────────────────────── */
  const TagPill = memo(({label,active,onToggle,color=GREEN}:{
    label:string;active:boolean;onToggle:()=>void;color?:string;
  }) => (
    <TouchableOpacity
      onPress={onToggle}
      activeOpacity={0.75}
      style={{
        paddingHorizontal:13,paddingVertical:7,borderRadius:22,
        backgroundColor:active?`${color}18`:T.surf,
        borderWidth:StyleSheet.hairlineWidth,
        borderColor:active?`${color}35`:T.border,
      }}>
      {active&&(
        <View style={{position:'absolute',top:5,right:5,width:5,height:5,borderRadius:2.5,backgroundColor:color}}/>
      )}
      <Text style={{color:active?color:T.muted,fontSize:12,fontWeight:active?'800':'500'}}>
        {label}
      </Text>
    </TouchableOpacity>
  ));
  
  /* ─── Avatar picker ─────────────────────────────────────────────────────── */
  const AvatarPicker = memo(({
    avatarUrl, displayName, uploading, onPickImage,
  }:{
    avatarUrl:string; displayName:string; uploading:boolean;
    onPickImage:()=>void;
  }) => {
    const [imgErr, setImgErr] = useState(false);
    const pulse = useRef(new Animated.Value(1)).current;
    useEffect(()=>{
      if(uploading){
        Animated.loop(Animated.sequence([
          Animated.timing(pulse,{toValue:0.85,duration:700,useNativeDriver:true}),
          Animated.timing(pulse,{toValue:1,  duration:700,useNativeDriver:true}),
        ])).start();
      } else {
        pulse.setValue(1);
      }
    },[uploading]);
  
    const init = displayName.trim().split(/\s+/).map(n=>n[0]).join('').toUpperCase().slice(0,2) || 'EV';
  
    return(
      <View style={{alignItems:'center',gap:12}}>
        <TouchableOpacity onPress={onPickImage} activeOpacity={0.85} disabled={uploading}>
          <Animated.View style={{
            width:110,height:110,borderRadius:55,
            transform:[{scale:pulse}],
            shadowColor:GREEN,shadowOpacity:0.25,shadowRadius:20,
          }}>
            {/* Outer ring */}
            <View style={{position:'absolute',top:-3,left:-3,right:-3,bottom:-3,
              borderRadius:58,borderWidth:1.5,borderColor:'rgba(129,140,248,0.45)'}}/>
            {avatarUrl&&!imgErr
              ?<Image source={{uri:avatarUrl}} style={{width:110,height:110,borderRadius:55}}
                  resizeMode="cover" onError={()=>setImgErr(true)}/>
              :<View style={{width:110,height:110,borderRadius:55,
                  backgroundColor:'rgba(129,140,248,0.12)',
                  borderWidth:1.5,borderColor:T.border,
                  alignItems:'center',justifyContent:'center'}}>
                 <Text style={{color:GREEN,fontSize:34,fontWeight:'900'}}>{init}</Text>
               </View>
            }
            {/* Camera overlay */}
            <View style={{position:'absolute',bottom:0,left:0,right:0,height:36,
              borderBottomLeftRadius:55,borderBottomRightRadius:55,
              backgroundColor:'rgba(2,10,6,0.72)',alignItems:'center',justifyContent:'center'}}>
              {uploading
                ?<ActivityIndicator color={GREEN} size="small"/>
                :<Ionicons name="camera" size={18} color={T.white}/>
              }
            </View>
          </Animated.View>
        </TouchableOpacity>
        <TouchableOpacity onPress={onPickImage} disabled={uploading} activeOpacity={0.75}
          style={{paddingHorizontal:16,paddingVertical:7,borderRadius:12,
            backgroundColor:T.greenDim,borderWidth:1,borderColor:T.borderHi}}>
          <Text style={{color:GREEN,fontSize:12,fontWeight:'700'}}>
            {uploading?'Upload en cours…':'Changer la photo'}
          </Text>
        </TouchableOpacity>
      </View>
    );
  });
  
  /* ─── Toast notification ────────────────────────────────────────────────── */
  const Toast = memo(({visible,success,message}:{visible:boolean;success:boolean;message:string}) => {
    const anim = useRef(new Animated.Value(0)).current;
    useEffect(()=>{
      if(visible){
        Animated.spring(anim,{toValue:1,tension:80,friction:10,useNativeDriver:true}).start();
      } else {
        Animated.timing(anim,{toValue:0,duration:200,useNativeDriver:true}).start();
      }
    },[visible]);
    return(
      <Animated.View style={{
        position:'absolute',top:0,left:EDGE,right:EDGE,zIndex:999,
        opacity:anim,transform:[{translateY:anim.interpolate({inputRange:[0,1],outputRange:[-60,0]})}],
      }}>
        <SafeAreaView edges={['top']}>
          <View style={{
            flexDirection:'row',alignItems:'center',gap:10,
            paddingHorizontal:16,paddingVertical:13,marginTop:8,
            borderRadius:16,
            backgroundColor:success?'rgba(129,140,248,0.20)':AURA.dangerGhost,
            borderWidth:1,borderColor:success?T.borderHi:'rgba(248,113,113,0.40)',
          }}>
            <Ionicons name={success?'checkmark-circle':'close-circle'} size={18}
              color={success?GREEN:T.red}/>
            <Text style={{color:T.white,fontSize:13,fontWeight:'700',flex:1}}>{message}</Text>
          </View>
        </SafeAreaView>
      </Animated.View>
    );
  });
  
  /* ─── Progress indicator ────────────────────────────────────────────────── */
  const ProfileStrength = memo(({form}:{form:FormState}) => {
    const fields = [
      form.display_name.trim(),
      form.company_name.trim(),
      form.bio.trim(),
      form.location.trim(),
      form.phone.trim(),
      form.website.trim(),
      form.avatar_url,
      form.specialties.length > 0 ? 'ok' : '',
      form.event_types.length > 0 ? 'ok' : '',
    ];
    const filled  = fields.filter(Boolean).length;
    const pct     = Math.round(filled / fields.length * 100);
    const color   = pct >= 80 ? GREEN : pct >= 50 ? T.amber : T.red;
    const label   = pct >= 80 ? 'Profil complet' : pct >= 50 ? 'Bon début' : 'Incomplet';
    const animV   = useRef(new Animated.Value(0)).current;
    useEffect(()=>{
      Animated.timing(animV,{toValue:pct/100,duration:800,easing:Easing.out(Easing.cubic),useNativeDriver:false}).start();
    },[pct]);
    return(
      <View style={{gap:6}}>
        <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center'}}>
          <Text style={{color:T.muted,fontSize:11,fontWeight:'600'}}>Complétude du profil</Text>
          <View style={{flexDirection:'row',alignItems:'center',gap:6}}>
            <Text style={{color,fontSize:11,fontWeight:'800'}}>{label}</Text>
            <Text style={{color,fontSize:13,fontWeight:'900'}}>{pct}%</Text>
          </View>
        </View>
        <View style={{height:5,borderRadius:2.5,backgroundColor:T.faint,overflow:'hidden'}}>
          <Animated.View style={{
            height:'100%',borderRadius:2.5,backgroundColor:color,
            width:animV.interpolate({inputRange:[0,1],outputRange:['0%','100%']}),
          }}/>
        </View>
        <Text style={{color:T.faint,fontSize:10}}>
          {9-filled} champ{9-filled>1?'s':''} manquant{9-filled>1?'s':''}
        </Text>
      </View>
    );
  });
  
  /* ─── Screen ───────────────────────────────────────────────────────────── */
  export default function EditProfileScreen() {
    const router = useRouter();
  
    const [form,       setForm]       = useState<FormState>(EMPTY);
    const [errors,     setErrors]     = useState<Record<string,string>>({});
    const [saving,     setSaving]     = useState(false);
    const [uploading,  setUploading]  = useState(false);
    const [loading,    setLoading]    = useState(true);
    const [toast,      setToast]      = useState<{visible:boolean;success:boolean;msg:string}>({visible:false,success:true,msg:''});
    const [openSec,    setOpenSec]    = useState<{id:boolean;agency:boolean;specialties:boolean}>({id:true,agency:true,specialties:false});
  
    // upd helpers
    const upd  = useCallback((k:keyof FormState, v:any) => setForm(f=>({...f,[k]:v})), []);
    const clrE = useCallback((k:string) => setErrors(e=>{const n={...e};delete n[k];return n;}), []);
  
    const showToast = (success:boolean, msg:string) => {
      setToast({visible:true,success,msg});
      setTimeout(()=>setToast(t=>({...t,visible:false})),2800);
    };
  
    /* ── Load existing profile (même logique que profile.tsx) ── */
    useEffect(() => {
      (async () => {
        try{
          const uid = await getCurrentOrganizerId();
          if(!uid) return;

          const { data: org } = await supabase
            .from('organizers')
            .select('contact_name,company_name,bio,avatar_url,location,website,phone,is_pro,verified,specialties,event_types,instagram,linkedin')
            .eq('id', uid)
            .single();

          if(org) {
            setForm({
              display_name : (org as any).contact_name ?? '',
              company_name : (org as any).company_name ?? '',
              bio          : (org as any).bio ?? '',
              location     : (org as any).location ?? '',
              website      : (org as any).website ?? '',
              phone        : (org as any).phone ?? '',
              instagram    : (org as any).instagram ?? '',
              linkedin     : (org as any).linkedin ?? '',
              avatar_url   : (org as any).avatar_url ?? '',
              specialties  : (org as any).specialties ?? [],
              event_types  : (org as any).event_types ?? [],
            });
          }
        } catch(e) {
          console.error('[edit-profile load]', e);
        } finally {
          setLoading(false);
        }
      })();
    }, []);
  
    /* ── Image picker + upload Supabase Storage ── */
    const pickImage = useCallback(async () => {
      const pick = async (source: 'camera'|'library') => {
        const fn = source === 'camera'
          ? ImagePicker.launchCameraAsync
          : ImagePicker.launchImageLibraryAsync;
        const res = await fn({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [1,1],
          quality: 0.85,
        });
        if(res.canceled || !res.assets?.[0]) return;
        const asset = res.assets[0];
        setUploading(true);
        try{
          const uid = await getCurrentOrganizerId();
          if(!uid) throw new Error('Aucun profil organisateur lié à cet appareil');
          const ext    = asset.uri.split('.').pop() ?? 'jpg';
          const path   = `organizers/${uid}/avatar.${ext}`;
          const blob   = await (await fetch(asset.uri)).blob();
          const { error: upErr } = await supabase.storage
            .from('avatars')
            .upload(path, blob, { upsert:true, contentType:`image/${ext}` });
          if(upErr) throw upErr;
          const { data:{ publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path);
          upd('avatar_url', `${publicUrl}?t=${Date.now()}`);
          showToast(true, 'Photo mise à jour !');
        } catch(e:any) {
          console.error('[avatar upload]', e);
          showToast(false, e?.message ?? 'Erreur upload');
        } finally {
          setUploading(false);
        }
      };
  
      if(Platform.OS === 'ios') {
        ActionSheetIOS.showActionSheetWithOptions({
          options:['Annuler','Prendre une photo','Choisir depuis la galerie'],
          cancelButtonIndex:0,
        }, (i)=>{ if(i===1) pick('camera'); if(i===2) pick('library'); });
      } else {
        Alert.alert('Photo de profil','',[
          {text:'Annuler',style:'cancel'},
          {text:'Caméra',onPress:()=>pick('camera')},
          {text:'Galerie',onPress:()=>pick('library')},
        ]);
      }
    }, [upd]);
  
    /* ── Validate ── */
    const validate = (): boolean => {
      const e: Record<string,string> = {};
      if(!form.display_name.trim())       e.display_name = 'Nom de contact requis';
      if(!form.company_name.trim())       e.company_name = 'Nom d\'agence requis';
      if(form.bio.length > 500)           e.bio = 'Bio trop longue (max 500)';
      if(form.website && !/^https?:\/\//.test(form.website))
                                          e.website = 'URL invalide (commencer par https://)';
      if(form.phone && !/^[+\d\s\-().]{6,20}$/.test(form.phone))
                                          e.phone = 'Numéro invalide';
      setErrors(e);
      return Object.keys(e).length === 0;
    };
  
    /* ── Save ── */
    const save = useCallback(async () => {
      if(!validate()) {
        showToast(false, 'Corrigez les erreurs avant de sauvegarder');
        return;
      }
      setSaving(true);
      try{
        const uid = await getCurrentOrganizerId();
        if(!uid) throw new Error('Aucun profil organisateur lié à cet appareil');
  
        const payload = {
          contact_name : form.display_name.trim(),
          company_name : form.company_name.trim(),
          bio          : form.bio.trim() || null,
          location     : form.location.trim() || null,
          website      : form.website.trim() || null,
          phone        : form.phone.trim() || null,
          instagram    : form.instagram.trim() || null,
          linkedin     : form.linkedin.trim() || null,
          avatar_url   : form.avatar_url || null,
          specialties  : form.specialties,
          event_types  : form.event_types,
          updated_at   : new Date().toISOString(),
        };
  
        const { error: orgErr } = await supabase
          .from('organizers')
          .update(payload)
          .eq('id', uid);
        if(orgErr) throw orgErr;
  
        showToast(true, 'Profil mis à jour avec succès');
        // Laisse le toast apparaître puis retourne
        // profile.tsx se rafraîchit via Realtime 'profile_rt'
        setTimeout(() => router.back(), 1400);
  
      } catch(e:any) {
        console.error('[edit-profile save]', e);
        showToast(false, e?.message ?? 'Erreur lors de la sauvegarde');
      } finally {
        setSaving(false);
      }
    }, [form, router]);
  
    const toggleSpecialty = useCallback((s:string) => {
      setForm(f=>({...f, specialties: f.specialties.includes(s)
        ? f.specialties.filter(x=>x!==s)
        : [...f.specialties,s],
      }));
    },[]);
  
    const toggleEventType = useCallback((t:string) => {
      setForm(f=>({...f, event_types: f.event_types.includes(t)
        ? f.event_types.filter(x=>x!==t)
        : [...f.event_types,t],
      }));
    },[]);
  
    if(loading) return(
      <View style={{flex:1,backgroundColor:BG,alignItems:'center',justifyContent:'center'}}>
        <ActivityIndicator color={GREEN} size="large"/>
        <Text style={{color:T.muted,marginTop:12,fontSize:13}}>Chargement du profil…</Text>
      </View>
    );
  
    return(
      <View style={{flex:1,backgroundColor:BG}}>
        <ParticleBg/>
  
        {/* Toast */}
        <Toast visible={toast.visible} success={toast.success} message={toast.msg}/>
  
        <SafeAreaView edges={['top']} style={{flex:1}}>
  
          {/* ── HEADER ── */}
          <View style={s.header}>
            <TouchableOpacity style={s.backBtn} onPress={()=>router.back()} activeOpacity={0.78}>
              <Ionicons name="arrow-back" size={18} color={T.muted}/>
            </TouchableOpacity>
            <View style={{flex:1}}>
              <Text style={s.navLabel}>Mon compte</Text>
              <Text style={s.navTitle}>Modifier le profil</Text>
            </View>
            {/* Save button in header */}
            <TouchableOpacity
              style={[s.saveBtn, saving && {opacity:0.6}]}
              onPress={save} disabled={saving} activeOpacity={0.85}>
              {saving
                ?<ActivityIndicator color={BG} size="small"/>
                :<>
                  <Ionicons name="checkmark" size={15} color={BG}/>
                  <Text style={{color:BG,fontWeight:'900',fontSize:13}}>Enregistrer</Text>
                </>
              }
            </TouchableOpacity>
          </View>
  
          <KeyboardAvoidingView
            behavior={Platform.OS==='ios'?'padding':undefined}
            style={{flex:1}}>
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{paddingHorizontal:EDGE,paddingBottom:140,gap:14}}
              keyboardShouldPersistTaps="handled"
            >
  
              {/* ── AVATAR ── */}
              <Card>
                <AvatarPicker
                  avatarUrl={form.avatar_url}
                  displayName={form.company_name||form.display_name}
                  uploading={uploading}
                  onPickImage={pickImage}
                />
              </Card>
  
              {/* ── PROFILE STRENGTH ── */}
              <Card>
                <ProfileStrength form={form}/>
              </Card>
  
              {/* ── SECTION 1 : IDENTITÉ ── */}
              <Card>
                <SectionHeader
                  icon="person-outline"
                  title="Identité"
                  subtitle="Nom, contact, bio"
                  open={openSec.id}
                  onToggle={()=>setOpenSec(s=>({...s,id:!s.id}))}
                />
                {openSec.id&&(
                  <View style={{gap:14}}>
                    <Field
                      label="NOM DE CONTACT *"
                      value={form.display_name}
                      onChangeText={v=>{upd('display_name',v);clrE('display_name');}}
                      placeholder="Prénom Nom"
                      maxLength={80}
                      error={errors.display_name}
                      hint="Votre nom affiché aux talents lors de l'invitation"
                    />
                    <Field
                      label="NOM DE L'AGENCE / SOCIÉTÉ *"
                      value={form.company_name}
                      onChangeText={v=>{upd('company_name',v);clrE('company_name');}}
                      placeholder="Ex : Morin Events Agency"
                      maxLength={100}
                      error={errors.company_name}
                    />
                    <Field
                      label="BIO / PRÉSENTATION"
                      value={form.bio}
                      onChangeText={v=>{upd('bio',v);clrE('bio');}}
                      placeholder="Décrivez votre activité, votre expertise événementielle, votre style…"
                      multiline
                      numberOfLines={4}
                      maxLength={500}
                      error={errors.bio}
                    />
                    <Field
                      label="LOCALISATION"
                      value={form.location}
                      onChangeText={v=>upd('location',v)}
                      placeholder="Paris, France"
                      maxLength={100}
                      prefix="📍"
                    />
                  </View>
                )}
              </Card>
  
              {/* ── SECTION 2 : AGENCE ── */}
              <Card>
                <SectionHeader
                  icon="business-outline"
                  title="Coordonnées"
                  subtitle="Web, téléphone, réseaux sociaux"
                  open={openSec.agency}
                  onToggle={()=>setOpenSec(s=>({...s,agency:!s.agency}))}
                  accent={T.blue}
                />
                {openSec.agency&&(
                  <View style={{gap:14}}>
                    <Field
                      label="SITE WEB"
                      value={form.website}
                      onChangeText={v=>{upd('website',v);clrE('website');}}
                      placeholder="https://monagence.fr"
                      keyboardType="url"
                      maxLength={200}
                      prefix="🌐"
                      error={errors.website}
                    />
                    <Field
                      label="TÉLÉPHONE"
                      value={form.phone}
                      onChangeText={v=>{upd('phone',v);clrE('phone');}}
                      placeholder="+33 6 12 34 56 78"
                      keyboardType="phone-pad"
                      maxLength={20}
                      prefix="📞"
                      error={errors.phone}
                    />
                    {/* Réseaux sociaux */}
                    <View style={{gap:6}}>
                      <Text style={{color:T.muted,fontSize:11,fontWeight:'700',letterSpacing:0.3}}>INSTAGRAM</Text>
                      <View style={{flexDirection:'row',alignItems:'center',backgroundColor:T.surf,borderRadius:14,paddingHorizontal:14,height:48,borderWidth:StyleSheet.hairlineWidth,borderColor:T.border,gap:8}}>
                        <Ionicons name="logo-instagram" size={16} color={T.purple}/>
                        <TextInput
                          style={{flex:1,color:T.white,fontSize:14}}
                          value={form.instagram}
                          onChangeText={v=>upd('instagram',v)}
                          placeholder="@votre_compte"
                          placeholderTextColor={T.faint}
                          autoCorrect={false}
                          autoCapitalize="none"
                          maxLength={60}
                        />
                      </View>
                    </View>
                    <View style={{gap:6}}>
                      <Text style={{color:T.muted,fontSize:11,fontWeight:'700',letterSpacing:0.3}}>LINKEDIN</Text>
                      <View style={{flexDirection:'row',alignItems:'center',backgroundColor:T.surf,borderRadius:14,paddingHorizontal:14,height:48,borderWidth:StyleSheet.hairlineWidth,borderColor:T.border,gap:8}}>
                        <Ionicons name="logo-linkedin" size={16} color={T.blue}/>
                        <TextInput
                          style={{flex:1,color:T.white,fontSize:14}}
                          value={form.linkedin}
                          onChangeText={v=>upd('linkedin',v)}
                          placeholder="linkedin.com/in/votre-profil"
                          placeholderTextColor={T.faint}
                          autoCorrect={false}
                          autoCapitalize="none"
                          maxLength={100}
                        />
                      </View>
                    </View>
                  </View>
                )}
              </Card>
  
              {/* ── SECTION 3 : SPÉCIALITÉS ── */}
              <Card>
                <SectionHeader
                  icon="sparkles-outline"
                  title="Spécialités & Types d'événements"
                  subtitle={`${form.specialties.length + form.event_types.length} sélectionnés`}
                  open={openSec.specialties}
                  onToggle={()=>setOpenSec(s=>({...s,specialties:!s.specialties}))}
                  accent={GOLD}
                />
                {openSec.specialties&&(
                  <View style={{gap:18}}>
                    {/* Spécialités agence */}
                    <View style={{gap:10}}>
                      <Text style={{color:T.muted,fontSize:11,fontWeight:'700',letterSpacing:0.3}}>
                        POSITIONNEMENT AGENCE
                      </Text>
                      <View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}>
                        {SPECIALTY_PRESETS.map(sp=>(
                          <TagPill
                            key={sp} label={sp}
                            active={form.specialties.includes(sp)}
                            onToggle={()=>toggleSpecialty(sp)}
                            color={GREEN}
                          />
                        ))}
                      </View>
                    </View>
                    {/* Types d'événements */}
                    <View style={{gap:10}}>
                      <Text style={{color:T.muted,fontSize:11,fontWeight:'700',letterSpacing:0.3}}>
                        TYPES D'ÉVÉNEMENTS GÉRÉS
                      </Text>
                      <View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}>
                        {EVENT_TYPES_OPTIONS.map(et=>(
                          <TagPill
                            key={et} label={et}
                            active={form.event_types.includes(et)}
                            onToggle={()=>toggleEventType(et)}
                            color={GOLD}
                          />
                        ))}
                      </View>
                    </View>
                  </View>
                )}
              </Card>
  
              {/* ── DANGER ZONE ── */}
              <View style={{gap:10,paddingTop:4}}>
                <TouchableOpacity
                  style={{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,
                    paddingVertical:13,borderRadius:14,backgroundColor:AURA.dangerGhost,
                    borderWidth:StyleSheet.hairlineWidth,borderColor:'rgba(248,113,113,0.30)'}}
                  onPress={()=>Alert.alert(
                    'Déconnexion',
                    'Voulez-vous vous déconnecter ?',
                    [{text:'Annuler',style:'cancel'},{text:'Déconnecter',style:'destructive',onPress:async()=>{
                      await supabase.auth.signOut();
                      router.replace('/(auth)/login' as any);
                    }}]
                  )}
                  activeOpacity={0.78}>
                  <Ionicons name="log-out-outline" size={15} color={T.red}/>
                  <Text style={{color:T.red,fontSize:13,fontWeight:'700'}}>Se déconnecter</Text>
                </TouchableOpacity>
              </View>
  
            </ScrollView>
          </KeyboardAvoidingView>
  
          {/* ── STICKY FOOTER CTA ── */}
          <View style={s.footer}>
            <TouchableOpacity
              style={[s.footerCancelBtn]}
              onPress={()=>router.back()} activeOpacity={0.78}>
              <Text style={{color:T.muted,fontWeight:'600',fontSize:14}}>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.footerSaveBtn, saving&&{opacity:0.6}]}
              onPress={save} disabled={saving} activeOpacity={0.85}>
              <LinearGradient colors={[GREEN,AURA.primaryDeep]} style={s.footerSaveGrad}>
                {saving
                  ?<ActivityIndicator color={BG} size="small"/>
                  :<>
                    <Ionicons name="checkmark-circle" size={17} color={BG}/>
                    <Text style={{color:BG,fontWeight:'900',fontSize:15}}>Enregistrer le profil</Text>
                  </>
                }
              </LinearGradient>
            </TouchableOpacity>
          </View>
  
        </SafeAreaView>
      </View>
    );
  }
  
  /* ─── Styles ───────────────────────────────────────────────────────────── */
  const s = StyleSheet.create({
    header        : { flexDirection:'row', alignItems:'center', paddingHorizontal:EDGE,
      paddingTop:8, paddingBottom:12, gap:12 },
    backBtn       : { width:38, height:38, borderRadius:12, alignItems:'center', justifyContent:'center',
      backgroundColor:T.surf, borderWidth:StyleSheet.hairlineWidth, borderColor:T.border },
    navLabel      : { color:T.muted, fontSize:11, fontWeight:'600', letterSpacing:0.2 },
    navTitle      : { color:T.white, fontSize:18, fontWeight:'900', letterSpacing:-0.3 },
    saveBtn       : { flexDirection:'row', alignItems:'center', gap:6, paddingHorizontal:14,
      paddingVertical:9, borderRadius:12, backgroundColor:GREEN },
    footer        : { position:'absolute', bottom:0, left:0, right:0, flexDirection:'row',
      gap:12, paddingHorizontal:EDGE, paddingBottom:Platform.OS==='ios'?34:20, paddingTop:14,
      backgroundColor:`${BG}EE`, borderTopWidth:StyleSheet.hairlineWidth, borderTopColor:T.border },
    footerCancelBtn:{ flex:1, height:52, borderRadius:14, alignItems:'center', justifyContent:'center',
      backgroundColor:T.surf, borderWidth:StyleSheet.hairlineWidth, borderColor:T.border },
    footerSaveBtn : { flex:2, borderRadius:14, overflow:'hidden' },
    footerSaveGrad: { flexDirection:'row', alignItems:'center', justifyContent:'center', gap:9, height:52 },
  });