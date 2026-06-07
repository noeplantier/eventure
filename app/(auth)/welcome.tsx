import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '@/constants/theme';

export default function WelcomeScreen() {
  const router = useRouter();
  return (
    <View style={s.root}>
      <LinearGradient colors={['#070C17','#0D1A35']} style={StyleSheet.absoluteFill}/>
      <SafeAreaView style={s.inner}>
        <View style={s.hero}>
          <View style={s.logoBox}>
            <Ionicons name="calendar" size={40} color={COLORS.violet}/>
          </View>
          <Text style={s.title}>Eventure</Text>
          <Text style={s.sub}>Plateforme de staffing événementiel</Text>
        </View>
        <View style={s.btns}>
          <TouchableOpacity style={s.orgaBtn} onPress={()=>router.push('/(organizer)/dashboard' as any)} activeOpacity={0.85}>
            <LinearGradient colors={['rgba(167,139,250,0.35)','rgba(167,139,250,0.15)']} style={s.btnGrad}>
              <Ionicons name="business-outline" size={20} color={COLORS.violet}/>
              <Text style={s.orgaTxt}>Je suis Organisateur</Text>
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity style={s.staffBtn} onPress={()=>router.push('/(staff)/feed' as any)} activeOpacity={0.85}>
            <Text style={s.staffTxt}>Je cherche des missions →</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}
const s = StyleSheet.create({
  root:     { flex:1 },
  inner:    { flex:1, paddingHorizontal:24, justifyContent:'space-between', paddingVertical:40 },
  hero:     { flex:1, alignItems:'center', justifyContent:'center', gap:16 },
  logoBox:  { width:80, height:80, borderRadius:24, backgroundColor:'rgba(167,139,250,0.18)', alignItems:'center', justifyContent:'center', borderWidth:1, borderColor:'rgba(167,139,250,0.35)' },
  title:    { color:'#fff', fontSize:36, fontWeight:'900', letterSpacing:-1 },
  sub:      { color:'rgba(255,255,255,0.50)', fontSize:15, textAlign:'center' },
  btns:     { gap:14 },
  orgaBtn:  { borderRadius:18, overflow:'hidden', borderWidth:1, borderColor:'rgba(167,139,250,0.40)' },
  btnGrad:  { flexDirection:'row', alignItems:'center', justifyContent:'center', gap:12, paddingVertical:18 },
  orgaTxt:  { color:'#A78BFA', fontSize:16, fontWeight:'800' },
  staffBtn: { alignItems:'center', paddingVertical:16 },
  staffTxt: { color:'rgba(255,255,255,0.60)', fontSize:15, fontWeight:'600' },
});
