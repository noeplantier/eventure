/**
 * app/(organizer)/create-event.tsx — EVENTURE v2
 * Même ADN que dashboard.tsx : ParticleBg · Card · palette T
 *
 * Formulaire 4 étapes :
 *   1. Infos événement (titre, type, date, lieu, budget, jauge)
 *   2. Rôles & postes (ajout dynamique de lignes role/slots/tarif)
 *   3. Description & notes
 *   4. Récap + Publier
 *
 * On "Publier la mission" :
 *   → INSERT events (status='published')
 *   → INSERT event_roles (pour chaque rôle)
 *   → INSERT missions (une par poste, payment_status='pending')
 *   → navigate missions.tsx
 *
 * On "Sauvegarder brouillon" :
 *   → INSERT events (status='draft')
 *   → INSERT event_roles
 *   (pas de missions tant que non publié)
 */
import React, {
  memo, useCallback, useEffect, useRef, useState,
} from 'react';
import {
  ActivityIndicator, Animated, Dimensions, Easing,
  KeyboardAvoidingView, Platform, ScrollView, StyleSheet,
  Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons }       from '@expo/vector-icons';
import { SafeAreaView }   from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase }       from '@/lib/supabase';

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

/* ─── Constants ────────────────────────────────────────────────────────── */
const EVENT_TYPES = ['Gala','Festival','Conférence','Mariage','Séminaire','Soirée','Concert','Sport','Autre'];
const ROLE_PRESETS = [
  'Serveur·se','Barman / Barmaid','Agent de sécurité',
  "Hôte·sse d'accueil",'Coordinateur·rice','Runner',
  'Photographe','Vidéaste','Sommelier·ère','DJ','Animateur·rice',
];
const TYPE_COLOR: Record<string,string> = {
  'Gala':GOLD,'Festival':GREEN,'Conférence':T.blue,'Mariage':'#F472B6',
  'Séminaire':T.purple,'Soirée':T.amber,'Concert':T.red,'Sport':'#34D399',
};

/* ─── Types ────────────────────────────────────────────────────────────── */
interface RoleRow { id: string; role: string; slots: string; hourly_rate: string }
interface FormData {
  title       : string;
  type        : string;
  date_start  : string;
  date_end    : string;
  location    : string;
  budget      : string;
  guests_count: string;
  description : string;
  notes       : string;
  roles       : RoleRow[];
}

const newRole = (): RoleRow => ({
  id: Math.random().toString(36).slice(2),
  role: '', slots: '1', hourly_rate: '',
});

const EMPTY_FORM: FormData = {
  title:'', type:'', date_start:'', date_end:'',
  location:'', budget:'', guests_count:'',
  description:'', notes:'',
  roles:[newRole()],
};

/* ─── Particle Background (identique dashboard) ────────────────────────── */
const rnd=(a:number,b:number)=>a+Math.random()*(b-a);
const PCOLS=['#00D97E','rgba(0,217,126,0.4)','#F5C842','rgba(245,200,66,0.32)','rgba(255,255,255,0.16)'];
const PTS=Array.from({length:20},(_,i)=>({id:i,x:rnd(0,SW),y:rnd(0,SH),sz:rnd(0.8,2.6),col:PCOLS[i%PCOLS.length],op:0.04+(i%6)*0.03}));
const ParticleBg=memo(()=>(
  <View style={StyleSheet.absoluteFill} pointerEvents="none">
    <LinearGradient colors={[BG,'#041208',BG]} style={StyleSheet.absoluteFill}/>
    <View style={{position:'absolute',top:'7%',left:'10%',width:SW*.72,height:SW*.72,borderRadius:SW*.36,backgroundColor:'rgba(0,217,126,0.025)'}}/>
    <View style={{position:'absolute',bottom:'8%',right:'-18%',width:SW*.6,height:SW*.6,borderRadius:SW*.3,backgroundColor:'rgba(245,200,66,0.02)'}}/>
    {PTS.map(p=><View key={p.id} style={{position:'absolute',left:p.x,top:p.y,width:p.sz,height:p.sz,borderRadius:p.sz/2,backgroundColor:p.col,opacity:p.op}}/>)}
  </View>
));

/* ─── Card (identique dashboard) ──────────────────────────────────────── */
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

/* ─── Field wrapper ────────────────────────────────────────────────────── */
const Field=memo(({label,error,children}:{label:string;error?:string;children:React.ReactNode})=>(
  <View style={{gap:6}}>
    <Text style={{color:T.muted,fontSize:12,fontWeight:'700'}}>{label}</Text>
    {children}
    {error&&<Text style={{color:T.red,fontSize:11}}>{error}</Text>}
  </View>
));

/* ─── TextInput styled ─────────────────────────────────────────────────── */
const Input=memo(({value,onChangeText,placeholder,keyboardType,multiline,numberOfLines,maxLength,style}:any)=>(
  <View style={[inp.wrap,style]}>
    <TextInput
      style={[inp.input,multiline&&{minHeight:(numberOfLines??3)*20,textAlignVertical:'top'}]}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={T.faint}
      keyboardType={keyboardType??'default'}
      multiline={multiline}
      numberOfLines={numberOfLines}
      maxLength={maxLength}
    />
  </View>
));
const inp=StyleSheet.create({
  wrap :{backgroundColor:T.surf,borderRadius:14,paddingHorizontal:14,
    borderWidth:StyleSheet.hairlineWidth,borderColor:T.border},
  input:{color:T.white,fontSize:14,paddingVertical:14,lineHeight:20},
});

/* ─── Step indicator ───────────────────────────────────────────────────── */
const StepBar=memo(({step,total}:{step:number;total:number})=>{
  const anim=useRef(new Animated.Value(0)).current;
  useEffect(()=>{
    Animated.spring(anim,{toValue:step/total,tension:80,friction:14,useNativeDriver:false}).start();
  },[step]);
  return(
    <View style={{gap:8,paddingHorizontal:EDGE}}>
      <View style={{flexDirection:'row',justifyContent:'space-between'}}>
        <Text style={{color:T.muted,fontSize:11,fontWeight:'600'}}>Étape {step} sur {total}</Text>
        <Text style={{color:GREEN,fontSize:11,fontWeight:'700'}}>{Math.round(step/total*100)}%</Text>
      </View>
      <View style={{height:3,borderRadius:1.5,backgroundColor:T.faint,overflow:'hidden'}}>
        <Animated.View style={{
          position:'absolute',left:0,top:0,bottom:0,borderRadius:1.5,
          backgroundColor:GREEN,
          width:anim.interpolate({inputRange:[0,1],outputRange:['0%','100%']}),
        }}/>
      </View>
      {/* Step dots */}
      <View style={{flexDirection:'row',justifyContent:'space-between',paddingHorizontal:2}}>
        {Array.from({length:total},(_,i)=>(
          <View key={i} style={{alignItems:'center',gap:3}}>
            <View style={[sp.dot,
              i+1<step&&{backgroundColor:GREEN,borderColor:GREEN},
              i+1===step&&{backgroundColor:GREEN,borderColor:GREEN,transform:[{scale:1.25}]},
              i+1>step&&{backgroundColor:'transparent'},
            ]}>
              {i+1<step&&<Ionicons name="checkmark" size={9} color={BG}/>}
              {i+1===step&&<View style={{width:5,height:5,borderRadius:2.5,backgroundColor:BG}}/>}
            </View>
            <Text style={{color:i+1<=step?GREEN:T.faint,fontSize:8,fontWeight:'600',textAlign:'center'}}>
              {['Infos','Rôles','Détails','Publier'][i]}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
});
const sp=StyleSheet.create({
  dot:{width:18,height:18,borderRadius:9,borderWidth:1.5,borderColor:T.border,
    alignItems:'center',justifyContent:'center',backgroundColor:T.surf},
});

/* ─── Screen ───────────────────────────────────────────────────────────── */
export default function CreateEventScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{inviteStaffId?:string;inviteStaffName?:string}>();

  const [step,     setStep]     = useState(1);
  const [form,     setForm]     = useState<FormData>(EMPTY_FORM);
  const [errors,   setErrors]   = useState<Record<string,string>>({});
  const [saving,   setSaving]   = useState(false);
  const [showTypes,setShowTypes]= useState(false);
  const [showRoleMenu,setShowRoleMenu] = useState<string|null>(null); // role row id

  const upd=(k:keyof FormData,v:any)=>setForm(f=>({...f,[k]:v}));
  const updRole=(id:string,k:keyof RoleRow,v:string)=>
    setForm(f=>({...f,roles:f.roles.map(r=>r.id===id?{...r,[k]:v}:r)}));
  const addRole=()=>setForm(f=>({...f,roles:[...f.roles,newRole()]}));
  const removeRole=(id:string)=>setForm(f=>({...f,roles:f.roles.filter(r=>r.id!==id)}));

  /* ── Validation per step ── */
  const validate=(s:number):boolean=>{
    const e:Record<string,string>={};
    if(s===1){
      if(!form.title.trim())       e.title='Titre requis';
      if(!form.date_start.trim())  e.date_start='Date de début requise';
      if(!form.location.trim())    e.location='Lieu requis';
    }
    if(s===2){
      form.roles.forEach((r,i)=>{
        if(!r.role.trim())       e[`role_${r.id}`]=`Rôle ${i+1} : intitulé requis`;
        if(!r.hourly_rate.trim()||isNaN(Number(r.hourly_rate)))
          e[`rate_${r.id}`]=`Rôle ${i+1} : tarif invalide`;
        if(!r.slots.trim()||isNaN(Number(r.slots))||Number(r.slots)<1)
          e[`slots_${r.id}`]=`Rôle ${i+1} : nombre de postes invalide`;
      });
    }
    setErrors(e);
    return Object.keys(e).length===0;
  };

  const goNext=()=>{ if(validate(step)) setStep(s=>Math.min(s+1,4)); };
  const goPrev=()=>setStep(s=>Math.max(s-1,1));

  /* ── Submit ── */
  const submit=useCallback(async(status:'published'|'draft')=>{
    if(status==='published'&&!validate(step)) return;
    setSaving(true);
    try{
      const{data:{session}}=await supabase.auth.getSession();
      if(!session) throw new Error('Non authentifié');
      const uid=session.user.id;

      // 1) Insert event
      const{data:evtData,error:evtErr}=await supabase.from('events').insert({
        organizer_id : uid,
        title        : form.title.trim(),
        type         : form.type||null,
        date_start   : form.date_start||null,
        date_end     : form.date_end||null,
        location     : form.location.trim()||null,
        budget       : form.budget?Number(form.budget):null,
        guests_count : form.guests_count?Number(form.guests_count):null,
        description  : form.description.trim()||null,
        notes        : form.notes.trim()||null,
        status,
      }).select('id').single();
      if(evtErr) throw evtErr;
      const eventId=(evtData as any).id;

      // 2) Insert event_roles
      const roleInserts=form.roles.map(r=>({
        event_id   : eventId,
        role       : r.role.trim(),
        slots      : Number(r.slots),
        slots_filled: 0,
        hourly_rate: Number(r.hourly_rate),
      }));
      const{error:roleErr}=await supabase.from('event_roles').insert(roleInserts);
      if(roleErr) throw roleErr;

      // 3) Si publication → créer les missions (1 par poste)
      if(status==='published'){
        const missionInserts=form.roles.flatMap(r=>
          Array.from({length:Number(r.slots)},()=>({
            event_id      : eventId,
            staff_id      : null,      // à assigner lors de l'acceptation
            application_id: null,
            payment_status: 'pending' as const,
            amount_due    : null,      // calculé après check_in/out
          }))
        );
        if(missionInserts.length){
          const{error:mErr}=await supabase.from('missions').insert(missionInserts);
          if(mErr) throw mErr;
        }
        router.replace('/(organizer)/missions' as any);
      } else {
        router.replace('/(organizer)/missions' as any);
      }
    }catch(e){
      console.error('[create-event]',e);
      setErrors({submit:`Erreur lors de la sauvegarde. Vérifiez votre connexion.`});
    }finally{
      setSaving(false);
    }
  },[form,step]);

  const tc=form.type?TYPE_COLOR[form.type]??GREEN:GREEN;

  /* ── RENDER STEP CONTENT ── */
  const renderStep=()=>{
    switch(step){

      /* ───── STEP 1 : Infos événement ───── */
      case 1: return(
        <View style={{gap:14}}>
          <Card>
            <Text style={ds.cardTitle}>Informations principales</Text>
            <Field label="Titre de la mission *" error={errors.title}>
              <Input value={form.title} onChangeText={(v:string)=>upd('title',v)}
                placeholder="Ex : Gala de fin d'année TechCorp" maxLength={120}/>
            </Field>

            <Field label="Type d'événement">
              <TouchableOpacity
                style={[inp.wrap,{paddingVertical:14,paddingHorizontal:14,flexDirection:'row',alignItems:'center',justifyContent:'space-between'}]}
                onPress={()=>setShowTypes(v=>!v)} activeOpacity={0.78}>
                <Text style={{color:form.type?T.white:T.faint,fontSize:14}}>
                  {form.type||'Sélectionner…'}
                </Text>
                {form.type&&(
                  <View style={{width:9,height:9,borderRadius:4.5,backgroundColor:tc,marginRight:8}}/>
                )}
                <Ionicons name={showTypes?'chevron-up':'chevron-down'} size={14} color={T.muted}/>
              </TouchableOpacity>
              {showTypes&&(
                <View style={{backgroundColor:T.navy,borderRadius:14,borderWidth:StyleSheet.hairlineWidth,borderColor:T.border,overflow:'hidden'}}>
                  {EVENT_TYPES.map((t,i)=>(
                    <TouchableOpacity key={t}
                      style={{
                        flexDirection:'row',alignItems:'center',gap:10,
                        paddingHorizontal:16,paddingVertical:13,
                        borderBottomWidth:i<EVENT_TYPES.length-1?StyleSheet.hairlineWidth:0,
                        borderBottomColor:T.border,
                        backgroundColor:form.type===t?T.greenDim:'transparent',
                      }}
                      onPress={()=>{upd('type',t);setShowTypes(false);}}>
                      <View style={{width:8,height:8,borderRadius:4,backgroundColor:TYPE_COLOR[t]??T.muted}}/>
                      <Text style={{color:form.type===t?GREEN:T.muted,fontSize:13,fontWeight:form.type===t?'800':'500',flex:1}}>{t}</Text>
                      {form.type===t&&<Ionicons name="checkmark" size={13} color={GREEN}/>}
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </Field>
          </Card>

          <Card>
            <Text style={ds.cardTitle}>Date & Lieu</Text>
            <View style={{flexDirection:'row',gap:10}}>
              <View style={{flex:1}}>
                <Field label="Début *" error={errors.date_start}>
                  <Input value={form.date_start} onChangeText={(v:string)=>upd('date_start',v)}
                    placeholder="YYYY-MM-DD HH:MM" maxLength={16}/>
                </Field>
              </View>
              <View style={{flex:1}}>
                <Field label="Fin">
                  <Input value={form.date_end} onChangeText={(v:string)=>upd('date_end',v)}
                    placeholder="YYYY-MM-DD HH:MM" maxLength={16}/>
                </Field>
              </View>
            </View>
            <Field label="Lieu *" error={errors.location}>
              <Input value={form.location} onChangeText={(v:string)=>upd('location',v)}
                placeholder="Adresse, salle, ville" maxLength={200}/>
            </Field>
          </Card>

          <Card glow={GOLD}>
            <Text style={ds.cardTitle}>Budget & Jauge</Text>
            <View style={{flexDirection:'row',gap:10}}>
              <View style={{flex:1}}>
                <Field label="Budget total (€)">
                  <Input value={form.budget} onChangeText={(v:string)=>upd('budget',v)}
                    placeholder="Ex : 12000" keyboardType="numeric" maxLength={10}/>
                </Field>
              </View>
              <View style={{flex:1}}>
                <Field label="Nb. invités">
                  <Input value={form.guests_count} onChangeText={(v:string)=>upd('guests_count',v)}
                    placeholder="Ex : 300" keyboardType="numeric" maxLength={6}/>
                </Field>
              </View>
            </View>
          </Card>
        </View>
      );

      /* ───── STEP 2 : Rôles & postes ───── */
      case 2: return(
        <View style={{gap:14}}>
          <Card>
            <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center'}}>
              <Text style={ds.cardTitle}>Rôles recherchés</Text>
              <TouchableOpacity
                style={{flexDirection:'row',alignItems:'center',gap:5,paddingHorizontal:11,paddingVertical:6,
                  borderRadius:10,backgroundColor:T.greenDim,borderWidth:1,borderColor:T.borderHi}}
                onPress={addRole} activeOpacity={0.78}>
                <Ionicons name="add" size={14} color={GREEN}/>
                <Text style={{color:GREEN,fontSize:12,fontWeight:'700'}}>Ajouter</Text>
              </TouchableOpacity>
            </View>

            {form.roles.map((r,idx)=>(
              <View key={r.id} style={{gap:10,padding:14,borderRadius:16,
                backgroundColor:T.surf,borderWidth:StyleSheet.hairlineWidth,borderColor:T.border}}>
                {/* Role header */}
                <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between'}}>
                  <Text style={{color:GREEN,fontSize:11,fontWeight:'700'}}>Poste {idx+1}</Text>
                  {form.roles.length>1&&(
                    <TouchableOpacity onPress={()=>removeRole(r.id)} hitSlop={10}>
                      <Ionicons name="close-circle" size={18} color={T.faint}/>
                    </TouchableOpacity>
                  )}
                </View>

                {/* Role selector */}
                <Field label="Rôle" error={errors[`role_${r.id}`]}>
                  <TouchableOpacity
                    style={[inp.wrap,{paddingVertical:12,flexDirection:'row',alignItems:'center',justifyContent:'space-between'}]}
                    onPress={()=>setShowRoleMenu(showRoleMenu===r.id?null:r.id)} activeOpacity={0.78}>
                    <Text style={{color:r.role?T.white:T.faint,fontSize:14,flex:1}}>
                      {r.role||'Sélectionner un rôle…'}
                    </Text>
                    <Ionicons name={showRoleMenu===r.id?'chevron-up':'chevron-down'} size={13} color={T.muted}/>
                  </TouchableOpacity>
                  {showRoleMenu===r.id&&(
                    <View style={{backgroundColor:T.navy,borderRadius:12,borderWidth:StyleSheet.hairlineWidth,borderColor:T.border,overflow:'hidden',marginTop:4}}>
                      {ROLE_PRESETS.map((preset,i)=>(
                        <TouchableOpacity key={preset}
                          style={{
                            paddingHorizontal:14,paddingVertical:11,
                            borderBottomWidth:i<ROLE_PRESETS.length-1?StyleSheet.hairlineWidth:0,
                            borderBottomColor:T.border,
                            backgroundColor:r.role===preset?T.greenDim:'transparent',
                          }}
                          onPress={()=>{updRole(r.id,'role',preset);setShowRoleMenu(null);}}>
                          <Text style={{color:r.role===preset?GREEN:T.muted,fontSize:13,fontWeight:r.role===preset?'800':'400'}}>
                            {preset}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </Field>

                {/* Slots + Tarif */}
                <View style={{flexDirection:'row',gap:10}}>
                  <View style={{flex:1}}>
                    <Field label="Nb. postes" error={errors[`slots_${r.id}`]}>
                      <Input value={r.slots} onChangeText={(v:string)=>updRole(r.id,'slots',v)}
                        placeholder="1" keyboardType="numeric" maxLength={3}/>
                    </Field>
                  </View>
                  <View style={{flex:1}}>
                    <Field label="Tarif horaire (€)" error={errors[`rate_${r.id}`]}>
                      <Input value={r.hourly_rate} onChangeText={(v:string)=>updRole(r.id,'hourly_rate',v)}
                        placeholder="15.00" keyboardType="decimal-pad" maxLength={6}/>
                    </Field>
                  </View>
                </View>

                {/* Budget estimé pour ce rôle */}
                {r.slots&&r.hourly_rate&&!isNaN(Number(r.slots))&&!isNaN(Number(r.hourly_rate))&&(
                  <Text style={{color:T.muted,fontSize:10}}>
                    Estimation 8h : <Text style={{color:GOLD,fontWeight:'700'}}>
                      {(Number(r.slots)*Number(r.hourly_rate)*8).toLocaleString('fr-FR')}€
                    </Text>
                  </Text>
                )}
              </View>
            ))}
          </Card>

          {/* Récap postes */}
          {form.roles.some(r=>r.role&&r.slots)&&(
            <Card>
              <Text style={ds.cardTitle}>Récapitulatif des postes</Text>
              <View style={{gap:8}}>
                {form.roles.filter(r=>r.role&&r.slots).map(r=>(
                  <View key={r.id} style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center'}}>
                    <Text style={{color:T.muted,fontSize:12}}>{r.role}</Text>
                    <View style={{flexDirection:'row',alignItems:'center',gap:10}}>
                      <Text style={{color:T.white,fontSize:12,fontWeight:'700'}}>{r.slots} poste{Number(r.slots)>1?'s':''}</Text>
                      {r.hourly_rate&&<Text style={{color:GOLD,fontSize:12,fontWeight:'700'}}>{r.hourly_rate}€/h</Text>}
                    </View>
                  </View>
                ))}
                <View style={{height:StyleSheet.hairlineWidth,backgroundColor:T.border,marginVertical:4}}/>
                <View style={{flexDirection:'row',justifyContent:'space-between'}}>
                  <Text style={{color:T.muted,fontSize:12,fontWeight:'600'}}>Total postes</Text>
                  <Text style={{color:GREEN,fontSize:12,fontWeight:'800'}}>
                    {form.roles.reduce((s,r)=>s+Number(r.slots||0),0)} poste{form.roles.reduce((s,r)=>s+Number(r.slots||0),0)>1?'s':''}
                  </Text>
                </View>
              </View>
            </Card>
          )}
        </View>
      );

      /* ───── STEP 3 : Description ───── */
      case 3: return(
        <View style={{gap:14}}>
          <Card>
            <Text style={ds.cardTitle}>Description de la mission</Text>
            <Field label="Description publique">
              <Input value={form.description} onChangeText={(v:string)=>upd('description',v)}
                placeholder="Décrivez l'ambiance, les attentes, le dress code…"
                multiline numberOfLines={5} maxLength={1000}/>
              <Text style={{color:T.faint,fontSize:10,alignSelf:'flex-end',marginTop:4}}>
                {form.description.length}/1000
              </Text>
            </Field>
            <Field label="Notes internes (non visibles par le staff)">
              <Input value={form.notes} onChangeText={(v:string)=>upd('notes',v)}
                placeholder="Notes privées, budget interne, contacts…"
                multiline numberOfLines={3} maxLength={500}/>
            </Field>
          </Card>
        </View>
      );

      /* ───── STEP 4 : Récap + Publier ───── */
      case 4: return(
        <View style={{gap:14}}>
          {/* Recap event */}
          <Card>
            <View style={{flexDirection:'row',alignItems:'center',gap:12}}>
              <View style={{width:46,height:46,borderRadius:14,
                backgroundColor:`${tc}18`,borderWidth:1,borderColor:`${tc}28`,
                alignItems:'center',justifyContent:'center'}}>
                <Ionicons name="calendar-outline" size={20} color={tc}/>
              </View>
              <View style={{flex:1}}>
                <Text style={{color:T.white,fontSize:16,fontWeight:'900',letterSpacing:-0.3}}>
                  {form.title||'Sans titre'}
                </Text>
                {form.type&&<Text style={{color:tc,fontSize:11,fontWeight:'600',marginTop:2}}>{form.type}</Text>}
              </View>
            </View>
            <View style={{gap:8}}>
              {[
                {icon:'location-outline' as const, l:form.location||'—'},
                {icon:'calendar-outline' as const, l:form.date_start||(form.date_start?`${form.date_start} → ${form.date_end}`:form.date_start)||'—'},
                {icon:'cash-outline' as const, l:form.budget?`${Number(form.budget).toLocaleString('fr-FR')}€ budget`:'Pas de budget'},
                {icon:'people-outline' as const, l:form.guests_count?`${form.guests_count} invités`:'—'},
              ].map(({icon,l})=>(
                <View key={icon} style={{flexDirection:'row',alignItems:'center',gap:9}}>
                  <Ionicons name={icon} size={13} color={T.muted}/>
                  <Text style={{color:T.muted,fontSize:12}} numberOfLines={1}>{l}</Text>
                </View>
              ))}
            </View>
          </Card>

          {/* Recap rôles */}
          <Card>
            <Text style={ds.cardTitle}>
              {form.roles.length} rôle{form.roles.length>1?'s':''} ·{' '}
              {form.roles.reduce((s,r)=>s+Number(r.slots||0),0)} poste{form.roles.reduce((s,r)=>s+Number(r.slots||0),0)>1?'s':''}
            </Text>
            {form.roles.map(r=>(
              <View key={r.id} style={{flexDirection:'row',alignItems:'center',gap:10,
                padding:12,borderRadius:13,backgroundColor:T.surf,
                borderWidth:StyleSheet.hairlineWidth,borderColor:T.border}}>
                <View style={{flex:1}}>
                  <Text style={{color:T.white,fontSize:13,fontWeight:'700'}}>{r.role||'—'}</Text>
                  <Text style={{color:T.muted,fontSize:11,marginTop:1}}>
                    {r.slots} poste{Number(r.slots)>1?'s':''}
                  </Text>
                </View>
                <Text style={{color:GOLD,fontSize:14,fontWeight:'900'}}>{r.hourly_rate}€/h</Text>
              </View>
            ))}
          </Card>

          {/* Description preview */}
          {form.description&&(
            <Card>
              <Text style={ds.cardTitle}>Description</Text>
              <Text style={{color:T.muted,fontSize:13,lineHeight:20}}>{form.description}</Text>
            </Card>
          )}

          {errors.submit&&(
            <View style={{padding:12,borderRadius:12,backgroundColor:'rgba(239,68,68,0.10)',
              borderWidth:StyleSheet.hairlineWidth,borderColor:'rgba(239,68,68,0.25)'}}>
              <Text style={{color:T.red,fontSize:12}}>{errors.submit}</Text>
            </View>
          )}

          {/* CTA buttons */}
          <View style={{gap:10}}>
            {/* Publier — CTA principal */}
            <TouchableOpacity
              style={{borderRadius:16,overflow:'hidden',opacity:saving?0.7:1}}
              onPress={()=>submit('published')} disabled={saving} activeOpacity={0.85}>
              <LinearGradient colors={[GREEN,'#00A058']} style={ce.publishBtn}>
                {saving
                  ?<ActivityIndicator color={BG} size="small"/>
                  :<><Ionicons name="rocket-outline" size={18} color={BG}/>
                     <Text style={{color:BG,fontWeight:'900',fontSize:16}}>Publier la mission</Text></>
                }
              </LinearGradient>
            </TouchableOpacity>

            {/* Brouillon */}
            <TouchableOpacity
              style={[ce.draftBtn,{opacity:saving?0.6:1}]}
              onPress={()=>submit('draft')} disabled={saving} activeOpacity={0.78}>
              <Ionicons name="save-outline" size={15} color={T.muted}/>
              <Text style={{color:T.muted,fontWeight:'600',fontSize:14}}>Sauvegarder en brouillon</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }
    return null;
  };

  return(
    <View style={{flex:1,backgroundColor:BG}}>
      <ParticleBg/>
      <SafeAreaView edges={['top']} style={{flex:1}}>

        {/* ── NAV (identique dashboard) ── */}
        <View style={ds.nav}>
          <View style={{flexDirection:'row',alignItems:'center',gap:10}}>
            <TouchableOpacity onPress={()=>router.back()} style={ds.navBtn} activeOpacity={0.78}>
              <Ionicons name="arrow-back" size={18} color={T.muted}/>
            </TouchableOpacity>
            <View style={{gap:1}}>
              <Text style={ds.greet}>Création</Text>
              <Text style={ds.title}>Nouvelle mission</Text>
            </View>
          </View>
          {/* Close */}
          <TouchableOpacity onPress={()=>router.back()} style={ds.navBtn} activeOpacity={0.78}>
            <Ionicons name="close" size={18} color={T.muted}/>
          </TouchableOpacity>
        </View>

        {/* Step bar */}
        <View style={{marginBottom:16}}>
          <StepBar step={step} total={4}/>
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS==='ios'?'padding':undefined}
          style={{flex:1}}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{paddingHorizontal:EDGE,paddingBottom:140,gap:0}}
            keyboardShouldPersistTaps="handled">
            {renderStep()}
          </ScrollView>
        </KeyboardAvoidingView>

        {/* ── BOTTOM NAV BUTTONS ── */}
        {step<4&&(
          <View style={ce.bottomNav}>
            {step>1?(
              <TouchableOpacity style={ce.prevBtn} onPress={goPrev} activeOpacity={0.78}>
                <Ionicons name="arrow-back" size={16} color={T.muted}/>
                <Text style={{color:T.muted,fontWeight:'600',fontSize:14}}>Retour</Text>
              </TouchableOpacity>
            ):<View style={{flex:1}}/>}
            <TouchableOpacity style={ce.nextBtn} onPress={goNext} activeOpacity={0.85}>
              <LinearGradient colors={['rgba(0,217,126,0.28)','rgba(0,217,126,0.12)']} style={ce.nextGrad}>
                <Text style={{color:GREEN,fontWeight:'900',fontSize:15}}>
                  {step===3?'Récapitulatif':'Suivant'}
                </Text>
                <Ionicons name="arrow-forward" size={16} color={GREEN}/>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}

      </SafeAreaView>
    </View>
  );
}

/* ─── Styles ───────────────────────────────────────────────────────────── */
const ds=StyleSheet.create({
  nav      :{flexDirection:'row',justifyContent:'space-between',alignItems:'center',paddingHorizontal:EDGE,paddingVertical:12,paddingBottom:8},
  greet    :{color:T.muted,fontSize:11,fontWeight:'600'},
  title    :{color:T.white,fontSize:18,fontWeight:'900',letterSpacing:-0.3},
  navBtn   :{width:38,height:38,borderRadius:12,alignItems:'center',justifyContent:'center',backgroundColor:T.surf,borderWidth:StyleSheet.hairlineWidth,borderColor:T.border},
  cardTitle:{color:T.white,fontSize:14,fontWeight:'900',letterSpacing:-0.2},
});
const ce=StyleSheet.create({
  publishBtn:{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:10,height:56,borderRadius:16, marginBottom:80},
  draftBtn  :{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,height:50,borderRadius:14,backgroundColor:T.surf,borderWidth:StyleSheet.hairlineWidth,borderColor:T.border},
  bottomNav :{position:'absolute',bottom:80,left:0,right:0,
    flexDirection:'row',gap:12,paddingHorizontal:EDGE,paddingBottom:Platform.OS==='ios'?32:20,paddingTop:14,
    backgroundColor:`${BG}E8`,borderTopWidth:StyleSheet.hairlineWidth,borderTopColor:T.border},
  prevBtn   :{flex:1,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:7,
    height:52,borderRadius:14,backgroundColor:T.surf,borderWidth:StyleSheet.hairlineWidth,borderColor:T.border},
  nextBtn   :{flex:2,borderRadius:14,overflow:'hidden'},
  nextGrad  :{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,height:52},
});