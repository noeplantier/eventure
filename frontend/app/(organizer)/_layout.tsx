import { Stack } from 'expo-router';
export default function OrganizerLayout() {
  return (
    <Stack screenOptions={{ headerShown:false }}>
      <Stack.Screen name="dashboard"    />
      <Stack.Screen name="create-event" />
      <Stack.Screen name="event/[id]"   />
      <Stack.Screen name="applications" />
    </Stack>
  );
}
