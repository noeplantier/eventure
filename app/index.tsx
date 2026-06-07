import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { isMockMode } from '@/lib/supabase';
import { MOCK_USER }  from '@/lib/mockData';
import { supabase }   from '@/lib/supabase';
import { COLORS }     from '@/constants/theme';

export default function Index() {
  const router = useRouter();

  useEffect(() => {
    async function redirect() {
      if (isMockMode) {
        // En mode mock, rediriger selon le rôle de MOCK_USER
        const role = MOCK_USER.role;
        router.replace(role === 'organizer' ? '/(organizer)/dashboard' : '/(staff)/feed');
        return;
      }
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace('/(auth)/welcome'); return; }
      // Déterminer le rôle depuis Supabase
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single();
      const role = (profile as any)?.role ?? 'staff';
      router.replace(role === 'organizer' ? '/(organizer)/dashboard' : '/(staff)/feed');
    }
    redirect();
  }, []);

  return (
    <View style={{ flex:1, backgroundColor:COLORS.bg, alignItems:'center', justifyContent:'center' }}>
      <ActivityIndicator color={COLORS.violet} size="large" />
    </View>
  );
}
