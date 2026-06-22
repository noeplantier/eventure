import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AUTH_STORAGE_KEY } from '@/lib/putInCoffeeUsers';

export default function Index() {
  const router = useRouter();

  useEffect(() => {
    AsyncStorage.getItem(AUTH_STORAGE_KEY).then(raw => {
      if (!raw) {
        router.replace('/(auth)/welcome');
        return;
      }
      try {
        const user = JSON.parse(raw);
        router.replace(user.role === 'organizer' ? '/(organizer)/dashboard' : '/(staff)/feed');
      } catch {
        router.replace('/(auth)/welcome');
      }
    });
  }, []);

  return (
    <View style={styles.root}>
      <ActivityIndicator color="#FFFFFF" size="large" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#030B1E', alignItems: 'center', justifyContent: 'center' },
});
