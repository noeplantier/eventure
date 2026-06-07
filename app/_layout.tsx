import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
        <Stack.Screen name="(auth)"       options={{ animation: 'none' }} />
        <Stack.Screen name="(organizer)"  />
        <Stack.Screen name="(staff)"      />
        <Stack.Screen name="(shared)"     />
      </Stack>
    </GestureHandlerRootView>
  );
}
