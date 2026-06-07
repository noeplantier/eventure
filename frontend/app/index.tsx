import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { Redirect } from 'expo-router';

export default function Index() {
  const router = useRouter();

    return <Redirect href="/(organizer)/dashboard"/>;
  
}

