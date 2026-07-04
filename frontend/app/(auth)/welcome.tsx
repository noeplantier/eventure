import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, KeyboardAvoidingView,
  Platform, ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons }       from '@expo/vector-icons';
import { useRouter }      from 'expo-router';
import { SafeAreaView }   from 'react-native-safe-area-context';
import { supabase }       from '@/lib/supabase';
import { AURA }           from '@/constants/aura-theme';

const GREEN = AURA.primary;
const T = {
  bg:     AURA.bg,
  navy:   AURA.surface,
  white:  AURA.text,
  muted:  AURA.textSub,
  faint:  AURA.textMuted,
  surf:   AURA.surfaceAlt,
  border: AURA.primaryBorder,
  green:  GREEN,
  gold:   AURA.warning,
  red:    AURA.danger,
};

export default function WelcomeScreen() {
  const router = useRouter();

  const [mode,     setMode]     = useState<'login'|'register'>('login');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [company,  setCompany]  = useState('');
  const [loading,  setLoading]  = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [error,    setError]    = useState('');

  const handle = async () => {
    setError('');
    if (!email.trim() || !password.trim()) {
      setError('Email et mot de passe requis'); return;
    }
    if (mode === 'register' && !company.trim()) {
      setError('Nom de votre agence / société requis'); return;
    }
    if (password.length < 6) {
      setError('Mot de passe trop court (6 caractères min)'); return;
    }

    setLoading(true);
    try {
      if (mode === 'login') {
        const { error: e } = await supabase.auth.signInWithPassword({
          email: email.trim(), password,
        });
        if (e) { setError(e.message); return; }
        router.replace('/(organizer)/dashboard');

      } else {
        const { data, error: e } = await supabase.auth.signUp({
          email: email.trim(), password,
        });
        if (e) { setError(e.message); return; }

        // Créer le profil organisateur
        if (data.user) {
          await supabase.from('profiles').upsert({
            id:           data.user.id,
            email:        email.trim(),
            display_name: company.trim(),
            company_name: company.trim(),
            role:         'organizer',
            is_pro:       false,
            verified:     false,
          });
        }

        // Si confirmation email requise
        if (!data.session) {
          Alert.alert(
            'Vérifiez votre email 📬',
            `Un lien de confirmation a été envoyé à ${email.trim()}. Cliquez dessus pour activer votre compte.`,
            [{ text: 'OK' }]
          );
          return;
        }
        router.replace('/(organizer)/dashboard');
      }
    } catch (err: any) {
      setError(err?.message ?? 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={s.root}>
      <LinearGradient colors={[AURA.bg,AURA.bgElevated,AURA.bg]} style={StyleSheet.absoluteFill}/>

      {/* Halo vert */}
      <View style={s.halo}/>

      <KeyboardAvoidingView
        style={{ flex:1 }}
        behavior={Platform.OS==='ios'?'padding':'height'}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow:1 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <SafeAreaView style={s.inner}>

            {/* Logo */}
            <View style={s.hero}>
              <View style={s.logoBox}>
                <Ionicons name="calendar" size={40} color={GREEN}/>
              </View>
              <Text style={s.title}>Eventure</Text>
              <Text style={s.sub}>Staffing Événementiel Professionnel</Text>
            </View>

            {/* Tabs login / register */}
            <View style={s.tabs}>
              {(['login','register'] as const).map(m => (
                <TouchableOpacity
                  key={m}
                  style={[s.tab, mode===m && s.tabActive]}
                  onPress={()=>{ setMode(m); setError(''); }}
                  activeOpacity={0.75}
                >
                  <Text style={[s.tabTxt, mode===m && s.tabTxtActive]}>
                    {m==='login' ? 'Se connecter' : 'Créer un compte'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Formulaire */}
            <View style={s.form}>

              {/* Nom agence — register uniquement */}
              {mode==='register' && (
                <View style={s.fieldWrap}>
                  <Text style={s.label}>Nom de votre agence / société</Text>
                  <View style={s.inputRow}>
                    <Ionicons name="business-outline" size={16} color={T.muted}/>
                    <TextInput
                      style={s.input}
                      placeholder="Ex : Événements Dupont SARL"
                      placeholderTextColor={T.faint}
                      value={company}
                      onChangeText={setCompany}
                      autoCapitalize="words"
                      returnKeyType="next"
                    />
                  </View>
                </View>
              )}

              {/* Email */}
              <View style={s.fieldWrap}>
                <Text style={s.label}>Adresse email</Text>
                <View style={s.inputRow}>
                  <Ionicons name="mail-outline" size={16} color={T.muted}/>
                  <TextInput
                    style={s.input}
                    placeholder="votre@email.com"
                    placeholderTextColor={T.faint}
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="next"
                  />
                </View>
              </View>

              {/* Mot de passe */}
              <View style={s.fieldWrap}>
                <Text style={s.label}>Mot de passe</Text>
                <View style={s.inputRow}>
                  <Ionicons name="lock-closed-outline" size={16} color={T.muted}/>
                  <TextInput
                    style={[s.input, { flex:1 }]}
                    placeholder={mode==='register'?'6 caractères minimum':'••••••••'}
                    placeholderTextColor={T.faint}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPass}
                    returnKeyType="done"
                    onSubmitEditing={handle}
                  />
                  <TouchableOpacity onPress={()=>setShowPass(p=>!p)} hitSlop={8}>
                    <Ionicons
                      name={showPass?'eye-off-outline':'eye-outline'}
                      size={16} color={T.muted}
                    />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Erreur */}
              {!!error && (
                <View style={s.errorBox}>
                  <Ionicons name="alert-circle-outline" size={14} color={T.red}/>
                  <Text style={s.errorTxt}>{error}</Text>
                </View>
              )}

              {/* CTA */}
              <TouchableOpacity
                style={[s.cta, loading && { opacity:0.6 }]}
                onPress={handle}
                activeOpacity={0.85}
                disabled={loading}
              >
                <LinearGradient
                  colors={['rgba(129,140,248,0.35)','rgba(129,140,248,0.18)']}
                  style={s.ctaGrad}
                >
                  {loading
                    ? <ActivityIndicator color={GREEN} size="small"/>
                    : <>
                        <Text style={s.ctaTxt}>
                          {mode==='login' ? 'Se connecter' : 'Créer mon compte'}
                        </Text>
                        <Ionicons name="arrow-forward" size={16} color={GREEN}/>
                      </>
                  }
                </LinearGradient>
              </TouchableOpacity>

              {/* Mot de passe oublié */}
              {mode==='login' && (
                <TouchableOpacity style={{ alignSelf:'center', paddingVertical:8 }}
                  onPress={async()=>{
                    if(!email.trim()){setError('Entrez votre email d\'abord');return;}
                    const {error:e} = await supabase.auth.resetPasswordForEmail(email.trim());
                    if(e){setError(e.message);}
                    else{Alert.alert('Email envoyé','Vérifiez votre boîte mail pour réinitialiser votre mot de passe.');}
                  }}
                >
                  <Text style={s.forgotTxt}>Mot de passe oublié ?</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Footer */}
            <View style={s.footer}>
              <Text style={s.footerTxt}>
                {mode==='login'
                  ? "Pas encore de compte ? "
                  : "Déjà un compte ? "}
              </Text>
              <TouchableOpacity onPress={()=>{ setMode(m=>m==='login'?'register':'login'); setError(''); }}>
                <Text style={s.footerLink}>
                  {mode==='login' ? 'Créer un compte' : 'Se connecter'}
                </Text>
              </TouchableOpacity>
            </View>

          </SafeAreaView>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const s = StyleSheet.create({
  root:        { flex:1, backgroundColor:T.bg },
  halo:        { position:'absolute', top:'8%', left:'-20%', width:'140%', height:'40%', borderRadius:999, backgroundColor:'rgba(129,140,248,0.04)' },
  inner:       { flex:1, paddingHorizontal:24, justifyContent:'space-between', paddingTop:20, paddingBottom:32 },
  hero:        { alignItems:'center', gap:12, paddingTop:20, paddingBottom:28 },
  logoBox:     { width:80, height:80, borderRadius:24, backgroundColor:'rgba(129,140,248,0.12)', alignItems:'center', justifyContent:'center', borderWidth:1.5, borderColor:'rgba(129,140,248,0.28)' },
  title:       { color:T.white, fontSize:34, fontWeight:'900', letterSpacing:-1 },
  sub:         { color:T.muted, fontSize:13, textAlign:'center' },
  tabs:        { flexDirection:'row', backgroundColor:T.surf, borderRadius:16, padding:4, marginBottom:24, borderWidth:StyleSheet.hairlineWidth, borderColor:T.border },
  tab:         { flex:1, paddingVertical:11, borderRadius:12, alignItems:'center' },
  tabActive:   { backgroundColor:'rgba(129,140,248,0.18)', borderWidth:1, borderColor:'rgba(129,140,248,0.30)' },
  tabTxt:      { color:T.muted, fontSize:13, fontWeight:'600' },
  tabTxtActive:{ color:GREEN, fontWeight:'800' },
  form:        { gap:16 },
  fieldWrap:   { gap:6 },
  label:       { color:T.muted, fontSize:11, fontWeight:'700', letterSpacing:0.5, textTransform:'uppercase' },
  inputRow:    { flexDirection:'row', alignItems:'center', gap:10, backgroundColor:T.surf, borderRadius:14, borderWidth:StyleSheet.hairlineWidth, borderColor:T.border, paddingHorizontal:14, paddingVertical:14 },
  input:       { flex:1, color:T.white, fontSize:15 },
  errorBox:    { flexDirection:'row', alignItems:'center', gap:8, backgroundColor:'rgba(248,113,113,0.10)', borderRadius:12, padding:12, borderWidth:1, borderColor:'rgba(248,113,113,0.25)' },
  errorTxt:    { color:T.red, fontSize:12, fontWeight:'600', flex:1 },
  cta:         { borderRadius:16, overflow:'hidden', borderWidth:1.5, borderColor:'rgba(129,140,248,0.40)' },
  ctaGrad:     { flexDirection:'row', alignItems:'center', justifyContent:'center', gap:10, paddingVertical:16 },
  ctaTxt:      { color:GREEN, fontSize:16, fontWeight:'900' },
  forgotTxt:   { color:T.muted, fontSize:13, fontWeight:'600', textDecorationLine:'underline' },
  footer:      { flexDirection:'row', justifyContent:'center', alignItems:'center', gap:4, paddingTop:8 },
  footerTxt:   { color:T.muted, fontSize:13 },
  footerLink:  { color:GREEN, fontSize:13, fontWeight:'700' },
});