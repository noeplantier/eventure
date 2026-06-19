import { Stack } from 'expo-router';

export default function OrganizerLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="dashboard"    />
      <Stack.Screen name="events"       />
      <Stack.Screen name="staff"        />
      <Stack.Screen name="missions"     />
      <Stack.Screen name="calendar"     />
      <Stack.Screen name="create-event" />
      <Stack.Screen name="event/[id]"   />
      <Stack.Screen name="mission/[id]" />
      <Stack.Screen name="applications" />
      <Stack.Screen name="profile"      />
      <Stack.Screen name="edit-profile" />
    </Stack>
  );
}
