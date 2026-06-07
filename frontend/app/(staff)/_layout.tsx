import { Stack } from 'expo-router';
export default function StaffLayout() {
  return (
    <Stack screenOptions={{ headerShown:false }}>
      <Stack.Screen name="feed"         />
      <Stack.Screen name="mission/[id]" />
      <Stack.Screen name="planning"     />
      <Stack.Screen name="earnings"     />
      <Stack.Screen name="profile"      />
    </Stack>
  );
}
