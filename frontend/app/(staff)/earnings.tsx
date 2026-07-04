import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
export default function Screen() {
  const router = useRouter();
  return (
    <View style={{ flex:1 }}>
      <LinearGradient colors={['#141821','#0A0C10']} style={StyleSheet.absoluteFill}/>
      <SafeAreaView style={{ flex:1, alignItems:'center', justifyContent:'center', gap:16 }}>
        <Ionicons name="construct-outline" size={48} color="#C4B5FD"/>
        <Text style={{ color:'#fff', fontSize:20, fontWeight:'800' }}>earnings</Text>
        <Text style={{ color:'rgba(255,255,255,0.45)', fontSize:13 }}>Écran en cours de construction</Text>
        <TouchableOpacity onPress={()=>router.back()} style={{ backgroundColor:'rgba(196,181,253,0.20)', borderRadius:14, paddingHorizontal:20, paddingVertical:12, borderWidth:1, borderColor:'rgba(196,181,253,0.40)' }}>
          <Text style={{ color:'#C4B5FD', fontWeight:'700' }}>← Retour</Text>
        </TouchableOpacity>
      </SafeAreaView>
    </View>
  );
}
