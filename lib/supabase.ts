import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

// Storage web-safe
const ExpoSecureStoreAdapter = {
  getItem:    (key: string) => Platform.OS === 'web' ? localStorage.getItem(key)             : SecureStore.getItemAsync(key),
  setItem:    (key: string, value: string) => Platform.OS === 'web' ? (localStorage.setItem(key, value), Promise.resolve()) : SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => Platform.OS === 'web' ? (localStorage.removeItem(key), Promise.resolve()) : SecureStore.deleteItemAsync(key),
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    storage:                ExpoSecureStoreAdapter as any,
    autoRefreshToken:       true,
    persistSession:         true,
    detectSessionInUrl:     false,
  },
});

export const isMockMode = process.env.EXPO_PUBLIC_MOCK_MODE === 'true';
