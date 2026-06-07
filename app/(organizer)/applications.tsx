import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
export default function Screen() {
  const router = useRouter();
  return (
    <View style={{ flex:1 }}>
      <LinearGradient colors={['#0D1A35','#070C17']} style={StyleSheet.absoluteFill}/>
      <SafeAreaView style={{ flex:1, alignItems:'center', justifyContent:'center', gap:16 }}>
        <Ionicons name="construct-outline" size={48} color="#A78BFA"/>
        <Text style={{ color:'#fff', fontSize:20, fontWeight:'800' }}>applications</Text>
        <Text style={{ color:'rgba(255,255,255,0.45)', fontSize:13 }}>Écran en cours de construction</Text>
        <TouchableOpacity onPress={()=>router.back()} style={{ backgroundColor:'rgba(167,139,250,0.20)', borderRadius:14, paddingHorizontal:20, paddingVertical:12, borderWidth:1, borderColor:'rgba(167,139,250,0.40)' }}>
          <Text style={{ color:'#A78BFA', fontWeight:'700' }}>← Retour</Text>
        </TouchableOpacity>
      </SafeAreaView>
    </View>
  );
}
