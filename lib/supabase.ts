import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';

// Clés hardcodées temporairement — à remettre en env vars une fois l'app stable
const SUPABASE_URL = 'https://knrzbdqfflobfjdmqyte.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtucnpiZHFmZmxvYmZqZG1xeXRlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxOTIyMzgsImV4cCI6MjA5MDc2ODIzOH0.YWgxA9JKukqsBfuy0VXX4Ku_CHF3U6Wlh9t6qnOrRrg';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
export const isMockMode = false;