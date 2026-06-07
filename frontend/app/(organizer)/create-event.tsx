/**
 * app/(organizer)/create-event.tsx — EVENTURE v2
 * 100% Supabase · Animations spring · Budget live · Publication complète
 */
import React, {
  memo, useCallback, useEffect, useRef, useState,
} from 'react';
import {
  ActivityIndicator, Alert, Animated, Dimensions, Easing,
  KeyboardAvoidingView, Platform, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons }       from '@expo/vector-icons';
import { SafeAreaView }   from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase }       from '@/lib/supabase';

const { width: SW } = Dimensions.get('window');
const BG='#020A06';const GREEN='#00D97E';const GOLD='#F5C842';
const T={
  white:'#FFFFFF',muted:'rgba(255,255,255,0.50)',faint:'rgba(255,255,255,0.20)',
  surf:'rgba(255,255,255,0.05)',surfHi:'rgba(255,255,255,0.09)',
  border:'rgba(0,217,126,0.12)',borderHi:'rgba(0,217,126,0.30)',
  greenDim:'rgba(0,217,126,0.12)',goldDim:'rgba(245,200,66,0.12)',
  navy:'#0A2218',amber:'#F59E0B',red:'#EF4444',
} as const;
const EDGE=20;

// ─── Types ────────────────────────────────────────────────────────────────────
interface RoleForm {
  tempId:string; role:string; slots:string; hourly_rate:string; dress_code:string; requirements:string;
}
interface EventForm {
  title:string; description:string; type:string;
  location:string; date_start:string; date_end:string;
  roles:RoleForm[];
}
const newRole=():RoleForm=>({tempId:`${Date.now()}_${Math.random()}`,role:'',slots:'2',hourly_rate:'15',dress_code:'',requirements:''});
const EMPTY:EventForm={title:'',description:'',type:'',location:'',date_start:'',date_end:'',roles:[newRole()]};

// ─── Constants ────────────────────────────────────────────────────────────────
const EVENT_TYPES=[
  {k:'wedding',   l:'Mariage',   icon:'heart-outline'          as const, color:'#F472B6'},
  {k:'corporate', l:'Corporate', icon:'business-outline'       as const, color:'#38BDF8'},
  {k:'concert',   l:'Concert',   icon:'musical-notes-outline'  as const, color:'#A78BFA'},
  {k:'sport',     l:'Sport',     icon:'trophy-outline'         as const, color:'#FB923C'},
  {k:'gala',      l:'Gala',      icon:'sparkles-outline'       as const, color:GOLD     },
  {k:'festival',  l:'Festival',  icon:'color-palette-outline'  as const, color:'#4ADE80'},
  {k:'private',   l:'Privé',     icon:'home-outline'           as const, color:'#94A3B8'},
  {k:'other',     l:'Autre',     icon:'calendar-outline'       as const, color:T.muted  },
];
const ROLES_CAT=[
  'Serveur·se','Barman / Barmaid','Chef de rang',"Hôte·sse d'accueil",
  'Agent de sécurité','Coordinateur·rice','Runner','Sommelier·ère',
  'Valet parking','Technicien·ne son/lumière','Photographe','Vidéaste',
];
const STEPS=['Infos','Lieu & Date','Rôles','Récap'];

// ─── Particle BG (minimal) ────────────────────────────────────────────────────
const ParticleBg=memo(()=>(
  <View style={StyleSheet.absoluteFill} pointerEvents="none">
    <LinearGradient colors={[BG,'#051A0E',BG]} style={StyleSheet.absoluteFill}/>
    <View style={{position:'absolute',top:'5%',left:'10%',width:SW*.8,height:SW*.8,borderRadius:SW*.4,backgroundColor:'rgba(0,217,126,0.03)'}}/>
    <View style={{position:'absolute',bottom:'10%',right:'-15%',width:SW*.6,height:SW*.6,borderRadius:SW*.3,backgroundColor:'rgba(245,200,66,0.02)'}}/>
  </View>
));

// ─── Step Bar avec animations ─────────────────────────────────────────────────
const StepBar=memo(function StepBar({current}:{current:number}){
  const anims=useRef(STEPS.map(()=>new Animated.Value(0))).current;
  useEffect(()=>{
    STEPS.forEach((_,i)=>{
      Animated.spring(anims[i],{toValue:i<=current?1:0,tension:120,friction:8,useNativeDriver:false}).start();
    });
  },[current]);
  return(
    <View style={{flexDirection:'row',alignItems:'flex-start',paddingHorizontal:EDGE,paddingBottom:20,gap:0}}>
      {STEPS.map((l,i)=>{
        const done=i<current,active=i===current;
        const scale=anims[i].interpolate({inputRange:[0,1],outputRange:[0.85,1]});
        return(
          <React.Fragment key={l}>
            <View style={{alignItems:'center',gap:5}}>
              <Animated.View style={[
                sb.circle,
                done&&sb.done,active&&sb.active,
                {transform:[{scale}]}
              ]}>
                {done
                  ?<Ionicons name="checkmark" size={12} color="#fff"/>
                  :<Text style={[sb.num,active&&{color:GREEN,fontWeight:'900'}]}>{i+1}</Text>
                }
              </Animated.View>
              <Text style={[sb.lbl,active&&{color:GREEN},done&&{color:T.muted}]}>{l}</Text>
            </View>
            {i<STEPS.length-1&&(
              <Animated.View style={[sb.line,{backgroundColor:anims[i].interpolate({inputRange:[0,1],outputRange:[T.border,GREEN]})}]}/>
            )}
          </React.Fragment>
        );
      })}
    </View>
  );
});
const sb=StyleSheet.create({
  circle:{width:30,height:30,borderRadius:15,backgroundColor:T.surf,borderWidth:1,borderColor:T.border,alignItems:'center',justifyContent:'center'},
  done:  {backgroundColor:GREEN,borderColor:GREEN},
  active:{backgroundColor:'rgba(0,217,126,0.18)',borderColor:GREEN,shadowColor:GREEN,shadowOffset:{width:0,height:0},shadowOpacity:0.40,shadowRadius:8,elevation:4},
  num:   {color:T.faint,fontSize:12,fontWeight:'700'},
  lbl:   {color:T.faint,fontSize:9,fontWeight:'600',textAlign:'center',maxWidth:55,letterSpacing:0.2},
  line:  {flex:1,height:1.5,marginTop:14,marginHorizontal:3,borderRadius:1},
});

// ─── Field ────────────────────────────────────────────────────────────────────
const Field=memo(function Field({label,value,onChange,placeholder,multiline,keyboardType,hint,required,icon}:{label:string;value:string;onChange:(v:string)=>void;placeholder?:string;multiline?:boolean;keyboardType?:any;hint?:string;required?:boolean;icon?:keyof typeof Ionicons.glyphMap}){
  const [focused,setFocused]=useState(false);
  return(
    <View style={{gap:7}}>
      <View style={{flexDirection:'row',alignItems:'center',gap:4}}>
        {icon&&<Ionicons name={icon} size={11} color={T.muted}/>}
        <Text style={{color:T.muted,fontSize:10,fontWeight:'700',letterSpacing:0.9,textTransform:'uppercase'}}>{label}</Text>
        {required&&<Text style={{color:GREEN,fontSize:11,fontWeight:'900'}}>*</Text>}
      </View>
      <View style={[fd.wrap,focused&&fd.wrapFocused]}>
        <TextInput
          style={[fd.input,multiline&&fd.multi]}
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={T.faint}
          multiline={multiline}
          keyboardType={keyboardType??'default'}
          textAlignVertical={multiline?'top':'center'}
          onFocus={()=>setFocused(true)}
          onBlur={()=>setFocused(false)}
        />
      </View>
      {hint&&<Text style={{color:T.faint,fontSize:10,lineHeight:14}}>{hint}</Text>}
    </View>
  );
});
const fd=StyleSheet.create({
  wrap:       {backgroundColor:T.surf,borderRadius:14,borderWidth:1,borderColor:T.border},
  wrapFocused:{borderColor:GREEN,backgroundColor:'rgba(0,217,126,0.06)'},
  input:      {paddingHorizontal:14,paddingVertical:13,color:T.white,fontSize:14},
  multi:      {minHeight:80,lineHeight:20},
});

// ─── Step 1 ───────────────────────────────────────────────────────────────────
const Step1=memo(function Step1({form,onChange}:{form:EventForm;onChange:<K extends keyof EventForm>(k:K,v:EventForm[K])=>void}){
  return(
    <View style={{gap:20,padding:EDGE}}>
      <Field label="Titre de la mission" icon="pencil-outline" required value={form.title} onChange={v=>onChange('title',v)} placeholder="Ex : Gala de fin d'année 2025"/>
      <View style={{gap:10}}>
        <View style={{flexDirection:'row',alignItems:'center',gap:4}}>
          <Ionicons name="layers-outline" size={11} color={T.muted}/>
          <Text style={{color:T.muted,fontSize:10,fontWeight:'700',letterSpacing:0.9,textTransform:'uppercase'}}>Type d'événement <Text style={{color:GREEN}}>*</Text></Text>
        </View>
        <View style={{flexDirection:'row',flexWrap:'wrap',gap:10}}>
          {EVENT_TYPES.map(t=>{
            const a=form.type===t.k;
            return(
              <TouchableOpacity key={t.k} style={[s1.typeCard,a&&{backgroundColor:`${t.color}18`,borderColor:t.color}]} onPress={()=>onChange('type',t.k)} activeOpacity={0.75}>
                <Ionicons name={t.icon} size={22} color={a?t.color:T.muted}/>
                <Text style={[s1.typeLbl,a&&{color:t.color,fontWeight:'700'}]}>{t.l}</Text>
                {a&&<View style={{position:'absolute',top:5,right:5,width:7,height:7,borderRadius:3.5,backgroundColor:t.color}}/>}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
      <Field label="Description" icon="document-text-outline" value={form.description} onChange={v=>onChange('description',v)} placeholder="Contexte, attentes, ambiance de l'événement…" multiline hint="Une bonne description augmente la qualité des candidatures"/>
    </View>
  );
});
const s1=StyleSheet.create({
  typeCard:      {width:'22%',alignItems:'center',gap:5,paddingVertical:14,borderRadius:16,backgroundColor:T.surf,borderWidth:1,borderColor:T.border,position:'relative'},
  typeLbl:       {color:T.muted,fontSize:9,fontWeight:'600',textAlign:'center'},
});

// ─── Step 2 ───────────────────────────────────────────────────────────────────
const Step2=memo(function Step2({form,onChange}:{form:EventForm;onChange:<K extends keyof EventForm>(k:K,v:EventForm[K])=>void}){
  const dur=React.useMemo(()=>{
    try{const h=Math.abs(new Date(form.date_end).getTime()-new Date(form.date_start).getTime())/3600000;return isNaN(h)||h<=0?null:h;}
    catch{return null;}
  },[form.date_start,form.date_end]);
  return(
    <View style={{gap:20,padding:EDGE}}>
      <Field label="Adresse complète" icon="location-outline" required value={form.location} onChange={v=>onChange('location',v)} placeholder="15 Rue de Rivoli, 75001 Paris"/>
      <View style={{flexDirection:'row',gap:14}}>
        <View style={{flex:1}}><Field label="Début" icon="play-outline" required value={form.date_start} onChange={v=>onChange('date_start',v)} placeholder="2025-07-15T19:00" hint="Format : AAAA-MM-JJTHH:mm"/></View>
        <View style={{flex:1}}><Field label="Fin" icon="stop-outline" required value={form.date_end} onChange={v=>onChange('date_end',v)} placeholder="2025-07-15T23:30" hint="Format : AAAA-MM-JJTHH:mm"/></View>
      </View>
      {dur&&(
        <View style={{flexDirection:'row',alignItems:'center',gap:10,backgroundColor:'rgba(0,217,126,0.10)',borderRadius:14,padding:14,borderWidth:1,borderColor:T.borderHi}}>
          <View style={{width:36,height:36,borderRadius:18,backgroundColor:'rgba(0,217,126,0.20)',alignItems:'center',justifyContent:'center'}}>
            <Ionicons name="time-outline" size={18} color={GREEN}/>
          </View>
          <View style={{flex:1}}>
            <Text style={{color:GREEN,fontSize:15,fontWeight:'900'}}>{dur.toFixed(1)} heures</Text>
            <Text style={{color:'rgba(0,217,126,0.60)',fontSize:11}}>Durée de la mission</Text>
          </View>
        </View>
      )}
    </View>
  );
});

// ─── Step 3 ───────────────────────────────────────────────────────────────────
const Step3=memo(function Step3({form,onAdd,onUpdate,onRemove}:{form:EventForm;onAdd:()=>void;onUpdate:(id:string,k:keyof RoleForm,v:string)=>void;onRemove:(id:string)=>void}){
  const dur=React.useMemo(()=>{
    try{const h=Math.abs(new Date(form.date_end).getTime()-new Date(form.date_start).getTime())/3600000;return isNaN(h)||h<=0?0:h;}
    catch{return 0;}
  },[form.date_start,form.date_end]);
  const totalBudget=form.roles.reduce((a,r)=>a+(parseInt(r.slots)||0)*(parseFloat(r.hourly_rate)||0)*dur,0);

  return(
    <View style={{gap:16,padding:EDGE}}>
      {/* Budget total live */}
      <View style={{flexDirection:'row',alignItems:'center',gap:10,backgroundColor:T.goldDim,borderRadius:14,padding:14,borderWidth:1,borderColor:'rgba(245,200,66,0.25)'}}>
        <Ionicons name="cash-outline" size={20} color={GOLD}/>
        <View style={{flex:1}}>
          <Text style={{color:GOLD,fontSize:22,fontWeight:'900',letterSpacing:-0.5}}>{Math.round(totalBudget).toLocaleString('fr-FR')} €</Text>
          <Text style={{color:'rgba(245,200,66,0.60)',fontSize:10}}>Budget total estimé (mis à jour en temps réel)</Text>
        </View>
      </View>

      <Text style={{color:T.muted,fontSize:13,lineHeight:19}}>Ajoutez les postes à pourvoir. Le coût estimé se calcule automatiquement.</Text>

      {form.roles.map((r,idx)=>(
        <View key={r.tempId} style={s3.roleCard}>
          <View style={{flexDirection:'row',alignItems:'center',gap:10,marginBottom:12}}>
            <View style={{width:28,height:28,borderRadius:14,backgroundColor:T.greenDim,alignItems:'center',justifyContent:'center'}}><Text style={{color:GREEN,fontSize:12,fontWeight:'900'}}>{idx+1}</Text></View>
            <Text style={{flex:1,color:T.white,fontSize:14,fontWeight:'800'}}>Poste {idx+1}</Text>
            {form.roles.length>1&&(
              <TouchableOpacity onPress={()=>onRemove(r.tempId)} hitSlop={10} style={{width:28,height:28,borderRadius:14,backgroundColor:'rgba(239,68,68,0.10)',alignItems:'center',justifyContent:'center'}}>
                <Ionicons name="close" size={14} color={T.red}/>
              </TouchableOpacity>
            )}
          </View>

          {/* Role picker */}
          <Text style={s3.fieldLbl}>INTITULÉ *</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom:12}}>
            <View style={{flexDirection:'row',gap:8,paddingBottom:2}}>
              {ROLES_CAT.map(rc=>(
                <TouchableOpacity key={rc} style={[s3.rPill,r.role===rc&&s3.rPillActive]} onPress={()=>onUpdate(r.tempId,'role',rc)} activeOpacity={0.75}>
                  <Text style={[s3.rPillTxt,r.role===rc&&s3.rPillTxtActive]}>{rc}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          {/* Slots + Rate */}
          <View style={{flexDirection:'row',gap:12,marginBottom:10}}>
            <View style={{flex:1}}>
              <Text style={s3.fieldLbl}>POSTES *</Text>
              <TextInput style={s3.numInput} value={r.slots} onChangeText={v=>onUpdate(r.tempId,'slots',v)} keyboardType="number-pad" placeholder="2" placeholderTextColor={T.faint}/>
            </View>
            <View style={{flex:1}}>
              <Text style={s3.fieldLbl}>TARIF €/H *</Text>
              <TextInput style={s3.numInput} value={r.hourly_rate} onChangeText={v=>onUpdate(r.tempId,'hourly_rate',v)} keyboardType="decimal-pad" placeholder="15" placeholderTextColor={T.faint}/>
            </View>
          </View>

          {/* Coût estimé */}
          {dur>0&&r.slots&&r.hourly_rate&&(
            <View style={{flexDirection:'row',alignItems:'center',gap:6,marginBottom:10}}>
              <Ionicons name="calculator-outline" size={12} color={GOLD}/>
              <Text style={{color:GOLD,fontSize:12,fontWeight:'700'}}>
                Coût : {Math.round((parseInt(r.slots)||0)*(parseFloat(r.hourly_rate)||0)*dur).toLocaleString('fr-FR')} €
              </Text>
              <Text style={{color:T.faint,fontSize:10}}>({(parseInt(r.slots)||0)} × {r.hourly_rate}€ × {dur.toFixed(1)}h)</Text>
            </View>
          )}

          {/* Dress code */}
          <Text style={s3.fieldLbl}>DRESS CODE</Text>
          <TextInput style={[fd.input,{backgroundColor:T.surf,borderWidth:1,borderColor:T.border,borderRadius:12,marginBottom:8,color:T.white}]} value={r.dress_code} onChangeText={v=>onUpdate(r.tempId,'dress_code',v)} placeholder="Ex : Costume noir, tenue fournie…" placeholderTextColor={T.faint}/>

          <Text style={s3.fieldLbl}>EXIGENCES PARTICULIÈRES</Text>
          <TextInput style={[fd.input,{backgroundColor:T.surf,borderWidth:1,borderColor:T.border,borderRadius:12,color:T.white}]} value={r.requirements} onChangeText={v=>onUpdate(r.tempId,'requirements',v)} placeholder="Expérience requise, langues, certifications…" placeholderTextColor={T.faint}/>
        </View>
      ))}

      <TouchableOpacity style={s3.addBtn} onPress={onAdd} activeOpacity={0.78}>
        <View style={{width:32,height:32,borderRadius:16,backgroundColor:T.greenDim,alignItems:'center',justifyContent:'center',borderWidth:1,borderColor:T.borderHi}}>
          <Ionicons name="add" size={18} color={GREEN}/>
        </View>
        <Text style={{color:GREEN,fontSize:14,fontWeight:'800'}}>Ajouter un poste</Text>
      </TouchableOpacity>
    </View>
  );
});
const s3=StyleSheet.create({
  roleCard:    {backgroundColor:T.surf,borderRadius:20,padding:16,borderWidth:1,borderColor:T.border},
  fieldLbl:    {color:T.muted,fontSize:9,fontWeight:'700',letterSpacing:0.9,marginBottom:7,textTransform:'uppercase'},
  rPill:       {paddingHorizontal:12,paddingVertical:7,borderRadius:20,backgroundColor:T.surfHi,borderWidth:StyleSheet.hairlineWidth,borderColor:T.border},
  rPillActive: {backgroundColor:T.greenDim,borderColor:T.borderHi},
  rPillTxt:    {color:T.muted,fontSize:11},
  rPillTxtActive:{color:GREEN,fontWeight:'800'},
  numInput:    {backgroundColor:T.surf,borderRadius:12,borderWidth:1,borderColor:T.border,paddingHorizontal:14,paddingVertical:12,color:T.white,fontSize:18,fontWeight:'900',textAlign:'center'},
  addBtn:      {flexDirection:'row',alignItems:'center',justifyContent:'center',gap:10,paddingVertical:16,borderRadius:18,borderWidth:1.5,borderColor:T.borderHi,borderStyle:'dashed' as any},
});

// ─── Step 4 ───────────────────────────────────────────────────────────────────
const Step4=memo(function Step4({form}:{form:EventForm}){
  const dur=React.useMemo(()=>{try{const h=Math.abs(new Date(form.date_end).getTime()-new Date(form.date_start).getTime())/3600000;return isNaN(h)||h<=0?0:h;}catch{return 0;}},[form.date_start,form.date_end]);
  const budget=form.roles.reduce((a,r)=>a+(parseInt(r.slots)||0)*(parseFloat(r.hourly_rate)||0)*dur,0);
  const total=form.roles.reduce((a,r)=>a+(parseInt(r.slots)||0),0);
  const type=EVENT_TYPES.find(t=>t.k===form.type);
  const fmtDt=(iso:string)=>{try{return new Date(iso).toLocaleString('fr-FR',{weekday:'long',day:'numeric',month:'long',hour:'2-digit',minute:'2-digit'});}catch{return iso;}};
  return(
    <View style={{gap:16,padding:EDGE}}>
      <Text style={{color:T.white,fontSize:14,fontWeight:'800',letterSpacing:-0.2}}>Vérifiez votre mission avant publication</Text>

      {/* Budget highlight */}
      <View style={{backgroundColor:'rgba(0,217,126,0.10)',borderRadius:18,padding:18,alignItems:'center',gap:4,borderWidth:1.5,borderColor:T.borderHi}}>
        <Text style={{color:'rgba(0,217,126,0.60)',fontSize:10,fontWeight:'700',textTransform:'uppercase',letterSpacing:1.2}}>Budget total estimé</Text>
        <Text style={{color:GREEN,fontSize:32,fontWeight:'900',letterSpacing:-1}}>{Math.round(budget).toLocaleString('fr-FR')} €</Text>
        <Text style={{color:'rgba(0,217,126,0.50)',fontSize:11}}>{total} poste{total>1?'s':''} · {dur.toFixed(1)}h · {form.roles.length} rôle{form.roles.length>1?'s':''}</Text>
      </View>

      {/* Details */}
      <View style={{backgroundColor:T.surf,borderRadius:18,borderWidth:StyleSheet.hairlineWidth,borderColor:T.border,overflow:'hidden'}}>
        {[
          {icon:'pencil-outline' as const,     k:'Titre',  v:form.title||'—'},
          {icon:'layers-outline' as const,     k:'Type',   v:type?.l??'—'},
          {icon:'location-outline' as const,   k:'Lieu',   v:form.location||'—'},
          {icon:'play-outline' as const,       k:'Début',  v:form.date_start?fmtDt(form.date_start):'—'},
          {icon:'stop-outline' as const,       k:'Fin',    v:form.date_end?fmtDt(form.date_end):'—'},
          {icon:'time-outline' as const,       k:'Durée',  v:dur>0?`${dur.toFixed(1)} heures`:'—'},
        ].map(({icon,k,v},i,arr)=>(
          <View key={k} style={{flexDirection:'row',alignItems:'flex-start',paddingHorizontal:16,paddingVertical:12,gap:10,borderBottomWidth:i<arr.length-1?StyleSheet.hairlineWidth:0,borderBottomColor:T.border}}>
            <Ionicons name={icon} size={14} color={GREEN} style={{marginTop:1}}/>
            <Text style={{color:T.muted,fontSize:12,width:60}}>{k}</Text>
            <Text style={{color:T.white,fontSize:12,fontWeight:'600',flex:1}}>{v}</Text>
          </View>
        ))}
      </View>

      {/* Roles */}
      <Text style={{color:T.white,fontSize:13,fontWeight:'800'}}>Postes ({total} au total)</Text>
      {form.roles.map((r,i)=>(
        <View key={r.tempId} style={{flexDirection:'row',alignItems:'center',gap:10,paddingVertical:10,paddingHorizontal:14,borderRadius:12,backgroundColor:T.surf,borderWidth:StyleSheet.hairlineWidth,borderColor:T.border}}>
          <View style={{width:24,height:24,borderRadius:12,backgroundColor:T.greenDim,alignItems:'center',justifyContent:'center'}}><Text style={{color:GREEN,fontSize:10,fontWeight:'800'}}>{i+1}</Text></View>
          <Text style={{flex:1,color:T.white,fontSize:13,fontWeight:'700'}}>{r.role||`Poste ${i+1}`}</Text>
          <Text style={{color:T.muted,fontSize:11}}>{r.slots}×</Text>
          <Text style={{color:GOLD,fontSize:13,fontWeight:'800',minWidth:50,textAlign:'right'}}>{r.hourly_rate}€/h</Text>
          <Text style={{color:'rgba(0,217,126,0.60)',fontSize:11}}>= {Math.round((parseInt(r.slots)||0)*(parseFloat(r.hourly_rate)||0)*dur)}€</Text>
        </View>
      ))}

      <View style={{flexDirection:'row',gap:8,backgroundColor:'rgba(255,255,255,0.04)',borderRadius:14,padding:14,alignItems:'flex-start',borderWidth:StyleSheet.hairlineWidth,borderColor:T.border}}>
        <Ionicons name="information-circle-outline" size={15} color={T.muted} style={{marginTop:1}}/>
        <Text style={{color:T.muted,fontSize:11,lineHeight:17,flex:1}}>Après publication, votre mission est immédiatement visible par les professionnels disponibles. Vous pouvez la modifier ou l'archiver depuis votre tableau de bord à tout moment.</Text>
      </View>
    </View>
  );
});

// ─── Validation ───────────────────────────────────────────────────────────────
function validate(form:EventForm,step:number):string|null{
  if(step===0){
    if(!form.title.trim())        return 'Le titre est obligatoire.';
    if(form.title.length<3)       return 'Titre trop court (3 caractères min).';
    if(!form.type)                return "Sélectionnez un type d'événement.";
  }
  if(step===1){
    if(!form.location.trim())     return 'Le lieu est obligatoire.';
    if(!form.date_start.trim())   return 'La date de début est obligatoire.';
    if(!form.date_end.trim())     return 'La date de fin est obligatoire.';
    try{if(new Date(form.date_end)<=new Date(form.date_start)) return 'La fin doit être après le début.';}
    catch{return 'Format de date invalide (AAAA-MM-JJTHH:mm).';}
  }
  if(step===2){
    for(const r of form.roles){
      if(!r.role)                    return 'Sélectionnez un intitulé pour chaque poste.';
      if(!r.slots||parseInt(r.slots)<1) return 'Minimum 1 poste par rôle.';
      if(!r.hourly_rate||parseFloat(r.hourly_rate)<1) return 'Tarif minimum 1€/h.';
    }
  }
  return null;
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function CreateEventScreen() {
  const router  = useRouter();
  const params  = useLocalSearchParams<{inviteStaffId?:string;inviteStaffName?:string}>();
  const [step,     setStep]    = useState(0);
  const [form,     setForm]    = useState<EventForm>(EMPTY);
  const [saving,   setSaving]  = useState(false);
  const [draftId,  setDraftId] = useState<string|null>(null);
  const [autoSaved,setAutoSaved]= useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const stepAnim  = useRef(new Animated.Value(0)).current;

  const animateStep=useCallback(()=>{
    stepAnim.setValue(0.95);
    Animated.spring(stepAnim,{toValue:1,tension:180,friction:10,useNativeDriver:true}).start();
  },[stepAnim]);

  const onChange=useCallback(<K extends keyof EventForm>(k:K,v:EventForm[K])=>setForm(f=>({...f,[k]:v})),[]);
  const onAddRole=useCallback(()=>setForm(f=>({...f,roles:[...f.roles,newRole()]})),[]);
  const onRemoveRole=useCallback((id:string)=>setForm(f=>({...f,roles:f.roles.filter(r=>r.tempId!==id)})),[]);
  const onUpdateRole=useCallback((id:string,k:keyof RoleForm,v:string)=>setForm(f=>({...f,roles:f.roles.map(r=>r.tempId===id?{...r,[k]:v}:r)})),[]);

  // Auto-save draft
  const saveDraft=useCallback(async()=>{
    const {data:{session}}=await supabase.auth.getSession();
    if(!session) return;
    const uid=session.user.id;
    const payload={organizer_id:uid,title:form.title||'Brouillon',description:form.description||null,type:form.type||'other',location:form.location||'À définir',date_start:form.date_start||new Date().toISOString(),date_end:form.date_end||new Date(Date.now()+3600000).toISOString(),status:'draft'};
    if(draftId){
      await supabase.from('events').update(payload).eq('id',draftId);
    }else{
      const {data}=await supabase.from('events').insert(payload).select('id').single();
      if(data?.id) setDraftId(data.id);
    }
    setAutoSaved(true);
    setTimeout(()=>setAutoSaved(false),2000);
  },[form,draftId]);

  const goNext=useCallback(async()=>{
    const err=validate(form,step);
    if(err){Alert.alert('Champ manquant',err);return;}
    saveDraft().catch(()=>{});
    setStep(s=>s+1);
    animateStep();
    scrollRef.current?.scrollTo({y:0,animated:true});
  },[form,step,saveDraft,animateStep]);

  const goBack=useCallback(()=>{
    if(step===0){router.back();return;}
    setStep(s=>s-1);
    animateStep();
    scrollRef.current?.scrollTo({y:0,animated:true});
  },[step,router,animateStep]);

  const publish=useCallback(async()=>{
    setSaving(true);
    try{
      const {data:{session}}=await supabase.auth.getSession();
      if(!session) throw new Error('Vous devez être connecté pour publier une mission.');
      const uid=session.user.id;
      const eventPayload={organizer_id:uid,title:form.title,description:form.description||null,type:form.type,location:form.location,date_start:form.date_start,date_end:form.date_end,status:'published'};
      let eventId=draftId;
      if(eventId){await supabase.from('events').update(eventPayload).eq('id',eventId);}
      else{const {data,error}=await supabase.from('events').insert(eventPayload).select('id').single();if(error)throw error;eventId=data.id;}
      // Supprimer anciens roles si re-publication
      if(draftId) await supabase.from('event_roles').delete().eq('event_id',eventId);
      // Insérer les rôles
      const rolesPayload=form.roles.map(r=>({
        event_id:eventId,role:r.role,slots:parseInt(r.slots),
        hourly_rate:parseFloat(r.hourly_rate),dress_code:r.dress_code||null,
        requirements:r.requirements||null,slots_filled:0,
      }));
      const {error:rErr}=await supabase.from('event_roles').insert(rolesPayload);
      if(rErr) throw rErr;
      Alert.alert(
        '🎉 Mission publiée avec succès !',
        `"${form.title}" est maintenant visible par ${form.roles.reduce((a,r)=>a+(parseInt(r.slots)||0),0)} profils de staffing qualifiés.`,
        [{text:'Voir mes missions',onPress:()=>router.replace('/(organizer)/dashboard' as any)}]
      );
    }catch(e:any){
      Alert.alert('Erreur de publication',e?.message??'Une erreur inattendue est survenue. Veuillez réessayer.');
    }finally{setSaving(false);}
  },[form,draftId,router]);

  return(
    <View style={{flex:1,backgroundColor:BG}}>
      <ParticleBg/>
      <SafeAreaView edges={['top']}>
        {/* Top Nav */}
        <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:EDGE,paddingVertical:12}}>
          <TouchableOpacity style={s.backBtn} onPress={goBack} activeOpacity={0.70}>
            <Ionicons name={step===0?'close':'chevron-back'} size={18} color={T.muted}/>
          </TouchableOpacity>
          <View style={{alignItems:'center'}}>
            <Text style={{color:T.white,fontSize:16,fontWeight:'900',letterSpacing:-0.2}}>Nouvelle mission</Text>
            {autoSaved&&<Text style={{color:'rgba(0,217,126,0.60)',fontSize:10,marginTop:1}}>✓ Brouillon sauvegardé</Text>}
          </View>
          <View style={{width:40,alignItems:'flex-end'}}>
            {step<3&&<TouchableOpacity onPress={saveDraft} hitSlop={8}>
              <Ionicons name="cloud-upload-outline" size={18} color={T.faint}/>
            </TouchableOpacity>}
          </View>
        </View>
        <StepBar current={step}/>
      </SafeAreaView>

      <KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS==='ios'?'padding':'height'} keyboardVerticalOffset={130}>
        <Animated.ScrollView
          ref={scrollRef as any}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{paddingBottom:150}}
          keyboardShouldPersistTaps="handled"
          style={{transform:[{scale:stepAnim}]}}
        >
          {step===0&&<Step1 form={form} onChange={onChange}/>}
          {step===1&&<Step2 form={form} onChange={onChange}/>}
          {step===2&&<Step3 form={form} onAdd={onAddRole} onUpdate={onUpdateRole} onRemove={onRemoveRole}/>}
          {step===3&&<Step4 form={form}/>}
        </Animated.ScrollView>
      </KeyboardAvoidingView>

      {/* CTA bas */}
      <SafeAreaView edges={['bottom']} style={{backgroundColor:BG,borderTopWidth:StyleSheet.hairlineWidth,borderTopColor:T.border}}>
        <View style={{flexDirection:'row',gap:10,paddingHorizontal:EDGE,paddingVertical:14,alignItems:'center'}}>
          {step<3&&(
            <TouchableOpacity style={s.draftBtn} onPress={saveDraft} activeOpacity={0.70}>
              <Ionicons name="cloud-upload-outline" size={14} color={T.muted}/>
              <Text style={{color:T.muted,fontSize:12,fontWeight:'600'}}>Brouillon</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={[s.nextBtn,saving&&{opacity:.6}]} onPress={step<3?goNext:publish} activeOpacity={0.85} disabled={saving}>
            <LinearGradient colors={['rgba(0,217,126,0.32)','rgba(0,217,126,0.16)']} style={s.nextGrad}>
              {saving
                ?<><ActivityIndicator color={GREEN} size="small"/><Text style={s.nextTxt}>Publication en cours…</Text></>
                :<>
                  <Text style={s.nextTxt}>{step<3?'Continuer':step===3?'🚀 Publier la mission':''}</Text>
                  {step<3&&<Ionicons name="arrow-forward" size={16} color={GREEN}/>}
                </>
              }
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

const s=StyleSheet.create({
  backBtn: {width:42,height:42,borderRadius:21,alignItems:'center',justifyContent:'center',backgroundColor:T.surf,borderWidth:1,borderColor:T.border},
  draftBtn:{flexDirection:'row',alignItems:'center',gap:5,paddingHorizontal:14,paddingVertical:13,borderRadius:14,backgroundColor:T.surf,borderWidth:StyleSheet.hairlineWidth,borderColor:T.border},
  nextBtn: {flex:1,borderRadius:16,overflow:'hidden',borderWidth:1.5,borderColor:T.borderHi},
  nextGrad:{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,paddingVertical:16},
  nextTxt: {color:GREEN,fontSize:15,fontWeight:'900',letterSpacing:0.2},
});