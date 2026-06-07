#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# setup-eventure.sh — Setup complet de l'app Eventure
# Event Staffing & Payments Platform
#
# USAGE : bash setup-eventure.sh
# RÉSULTAT : App fonctionnelle avec mock data, lancée avec npx expo start
# ─────────────────────────────────────────────────────────────────────────────

set -e
echo ""
echo "🚀 EVENTURE — Setup complet"
echo "─────────────────────────────────────────────────────────────────"

# ─────────────────────────────────────────────────────────────────────────────
# ÉTAPE 1 — Créer le projet Expo
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "📦 Étape 1 — Création du projet Expo (TypeScript)"
npx create-expo-app@latest eventure --template blank-typescript
cd eventure

# ─────────────────────────────────────────────────────────────────────────────
# ÉTAPE 2 — Dépendances
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "📦 Étape 2 — Installation des dépendances"

# Navigation & UI
npx expo install \
  expo-router \
  expo-status-bar \
  expo-linear-gradient \
  expo-blur \
  expo-image \
  expo-image-picker \
  expo-file-system \
  expo-haptics \
  expo-secure-store \
  expo-location \
  expo-camera \
  react-native-safe-area-context \
  react-native-screens \
  react-native-gesture-handler \
  react-native-reanimated

# Icônes
npx expo install @expo/vector-icons

# Supabase
npm install @supabase/supabase-js react-native-url-polyfill

# Paiements
npm install @stripe/stripe-react-native

# Utilitaires
npm install date-fns

echo "✅ Dépendances installées"

# ─────────────────────────────────────────────────────────────────────────────
# ÉTAPE 3 — Structure des dossiers
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "📁 Étape 3 — Création de l'architecture"

mkdir -p \
  app/\(auth\) \
  app/\(organizer\)/event \
  app/\(staff\) \
  app/\(shared\) \
  components/staffing \
  components/ui \
  components/layout \
  lib \
  constants \
  services \
  hooks \
  assets/images

echo "✅ Architecture créée"

# ─────────────────────────────────────────────────────────────────────────────
# ÉTAPE 4 — Fichiers de configuration
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "⚙️  Étape 4 — Configuration"

# ── app.json ──────────────────────────────────────────────────────────────
cat > app.json << 'APP_JSON'
{
  "expo": {
    "name": "Eventure",
    "slug": "eventure",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/images/icon.png",
    "scheme": "eventure",
    "userInterfaceStyle": "dark",
    "backgroundColor": "#070C17",
    "splash": {
      "backgroundColor": "#070C17"
    },
    "ios": {
      "supportsTablet": false,
      "bundleIdentifier": "com.eventure.app",
      "backgroundColor": "#070C17"
    },
    "android": {
      "adaptiveIcon": {
        "backgroundColor": "#070C17"
      },
      "package": "com.eventure.app",
      "backgroundColor": "#070C17"
    },
    "web": {
      "bundler": "metro",
      "output": "single",
      "backgroundColor": "#070C17"
    },
    "plugins": [
      "expo-router",
      "expo-secure-store",
      ["expo-image-picker", { "photosPermission": "Eventure accède à vos photos." }],
      ["expo-location", { "locationWhenInUsePermission": "Eventure utilise votre position pour les missions proches." }],
      ["expo-camera", { "cameraPermission": "Eventure utilise la caméra pour les photos de profil." }]
    ],
    "experiments": {
      "typedRoutes": true
    }
  }
}
APP_JSON

# ── babel.config.js ────────────────────────────────────────────────────────
cat > babel.config.js << 'BABEL'
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      'react-native-reanimated/plugin',
    ],
  };
};
BABEL

# ── tsconfig.json ──────────────────────────────────────────────────────────
cat > tsconfig.json << 'TSCONFIG'
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./*"]
    }
  }
}
TSCONFIG

# ── metro.config.js ────────────────────────────────────────────────────────
cat > metro.config.js << 'METRO'
const { getDefaultConfig } = require('expo/metro-config');
const config = getDefaultConfig(__dirname);
module.exports = config;
METRO

echo "✅ Fichiers de config créés"

# ─────────────────────────────────────────────────────────────────────────────
# ÉTAPE 5 — Variables d'environnement
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "🔑 Étape 5 — Variables d'environnement"

# .env.local — données factices qui fonctionnent en mode mock
cat > .env.local << 'ENVLOCAL'
# ─────────────────────────────────────────────────────────────────────────────
# EVENTURE — Variables d'environnement
# Remplacez ces valeurs par vos vraies clés Supabase / Stripe
# En l'état, l'app tourne en mode MOCK (données locales)
# ─────────────────────────────────────────────────────────────────────────────

# Supabase — remplacez par vos vraies clés sur https://supabase.com
EXPO_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.mock

# Mode mock — met à true pour utiliser les données locales sans Supabase
EXPO_PUBLIC_MOCK_MODE=true

# Stripe — remplacez par votre clé publique Stripe sur https://dashboard.stripe.com
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_mock_key_eventure

# App
EXPO_PUBLIC_APP_NAME=Eventure
EXPO_PUBLIC_APP_VERSION=1.0.0
ENVLOCAL

# .env.example — template pour les nouveaux devs
cat > .env.example << 'ENVEX'
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
EXPO_PUBLIC_MOCK_MODE=false
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_your_key
EXPO_PUBLIC_APP_NAME=Eventure
EXPO_PUBLIC_APP_VERSION=1.0.0
ENVEX

# .gitignore
cat > .gitignore << 'GITIGNORE'
node_modules/
.expo/
dist/
.env.local
.env.production
*.jks
*.p8
*.p12
*.key
*.mobileprovision
*.orig.*
web-build/
.DS_Store
GITIGNORE

echo "✅ Variables d'environnement créées"

# ─────────────────────────────────────────────────────────────────────────────
# ÉTAPE 6 — Librairie centrale
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "📚 Étape 6 — Librairie centrale"

# ── lib/supabase.ts ────────────────────────────────────────────────────────
cat > lib/supabase.ts << 'SUPABASE'
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
SUPABASE

# ── lib/mockData.ts ────────────────────────────────────────────────────────
cat > lib/mockData.ts << 'MOCKDATA'
/**
 * lib/mockData.ts
 * Données factices — utilisées quand EXPO_PUBLIC_MOCK_MODE=true
 * L'app fonctionne intégralement sans Supabase en mode mock.
 */

export const MOCK_USER = {
  id:           'mock-user-001',
  email:        'hugo@eventure.app',
  display_name: 'Hugo Chassaing',
  username:     'hugo.chassaing',
  avatar_url:   'https://i.pravatar.cc/150?img=33',
  role:         'organizer',   // 'organizer' | 'staff'
  is_pro:       true,
};

export const MOCK_STAFF = [
  { id:'s1', display_name:'Lucie Martin',    avatar_url:'https://i.pravatar.cc/60?img=9',  role:['Serveur·se','Barman / Barmaid'], hourly_rate:16, rating:4.8, missions_count:34, location:'Paris 11e', is_available:true  },
  { id:'s2', display_name:'Marc Lefebvre',   avatar_url:'https://i.pravatar.cc/60?img=12', role:['Agent de sécurité'],              hourly_rate:18, rating:4.6, missions_count:21, location:'Paris 8e',  is_available:true  },
  { id:'s3', display_name:'Anaëlle Cornu',   avatar_url:'https://i.pravatar.cc/60?img=22', role:["Hôte·sse d'accueil",'Coordinateur·rice'], hourly_rate:15, rating:4.9, missions_count:52, location:'Boulogne', is_available:false },
  { id:'s4', display_name:'Thomas Garnier',  avatar_url:'https://i.pravatar.cc/60?img=33', role:['Barman / Barmaid','Sommelier·ère'], hourly_rate:17, rating:4.7, missions_count:28, location:'Paris 3e',  is_available:true  },
  { id:'s5', display_name:'Sophie Artaud',   avatar_url:'https://i.pravatar.cc/60?img=47', role:['Photographe','Vidéaste'],          hourly_rate:45, rating:5.0, missions_count:12, location:'Paris 2e',  is_available:true  },
];

export const MOCK_EVENTS = [
  {
    id:          'e1',
    title:       'Gala Annuel Société Vinci',
    description: 'Dîner de gala pour 250 personnes au Grand Palais. Ambiance luxe, service 5 étoiles requis.',
    location:    'Grand Palais, Paris 8e',
    latitude:    48.8660,
    longitude:   2.3133,
    date_start:  new Date(Date.now() + 7*24*3600*1000).toISOString(),
    date_end:    new Date(Date.now() + 7*24*3600*1000 + 5*3600*1000).toISOString(),
    type:        'gala',
    status:      'published',
    cover_url:   'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=800&q=80',
    distance_km: 2.4,
    organizer:   { company_name:'Vinci Events', avatar_url:'https://i.pravatar.cc/40?img=50', rating:4.8 },
    roles: [
      { id:'r1', role:'Serveur·se',   slots:8, slots_filled:3, hourly_rate:16, dress_code:'Tenue noire ceinture blanche' },
      { id:'r2', role:'Barman / Barmaid', slots:3, slots_filled:1, hourly_rate:18, dress_code:'Chemise blanche nœud papillon' },
      { id:'r3', role:"Hôte·sse d'accueil", slots:4, slots_filled:4, hourly_rate:15, dress_code:'Robe noire fournie' },
    ],
  },
  {
    id:          'e2',
    title:       'Conférence Tech Summit 2025',
    description: 'Conférence internationale 500 personnes. Accueil, vestiaire, coordination salle.',
    location:    'Palais des Congrès, Paris 17e',
    latitude:    48.8783,
    longitude:   2.2826,
    date_start:  new Date(Date.now() + 14*24*3600*1000).toISOString(),
    date_end:    new Date(Date.now() + 14*24*3600*1000 + 8*3600*1000).toISOString(),
    type:        'corporate',
    status:      'published',
    cover_url:   'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800&q=80',
    distance_km: 5.1,
    organizer:   { company_name:'TechEvents Paris', avatar_url:'https://i.pravatar.cc/40?img=60', rating:4.5 },
    roles: [
      { id:'r4', role:"Hôte·sse d'accueil", slots:6, slots_filled:2, hourly_rate:15, dress_code:'Tenue fournie bleue' },
      { id:'r5', role:'Agent de sécurité',  slots:4, slots_filled:0, hourly_rate:19, dress_code:'Costume noir' },
      { id:'r6', role:'Runner',             slots:5, slots_filled:5, hourly_rate:14, dress_code:'Polo gris' },
    ],
  },
  {
    id:          'e3',
    title:       'Mariage Dupont × Leroy',
    description: 'Mariage 120 personnes au château. Service dîner + cocktail.',
    location:    'Château de Vaux-le-Vicomte, Maincy',
    latitude:    48.5676,
    longitude:   2.7128,
    date_start:  new Date(Date.now() + 21*24*3600*1000).toISOString(),
    date_end:    new Date(Date.now() + 21*24*3600*1000 + 7*3600*1000).toISOString(),
    type:        'wedding',
    status:      'published',
    cover_url:   'https://images.unsplash.com/photo-1519741497674-611481863552?w=800&q=80',
    distance_km: 52,
    organizer:   { company_name:'Dupont Family', avatar_url:'https://i.pravatar.cc/40?img=70', rating:4.2 },
    roles: [
      { id:'r7', role:'Serveur·se',         slots:5, slots_filled:2, hourly_rate:17, dress_code:'Smoking noir' },
      { id:'r8', role:'Sommelier·ère',      slots:2, slots_filled:0, hourly_rate:22, dress_code:'Tablier blanc' },
      { id:'r9', role:'Photographe',        slots:1, slots_filled:1, hourly_rate:50, dress_code:'Libre' },
    ],
  },
  {
    id:          'e4',
    title:       'Concert Coldplay — Stade de France',
    description: 'Mission concert 70 000 personnes. Sécurité, placement public, gestion flux.',
    location:    'Stade de France, Saint-Denis',
    latitude:    48.9244,
    longitude:   2.3601,
    date_start:  new Date(Date.now() + 3*24*3600*1000).toISOString(),
    date_end:    new Date(Date.now() + 3*24*3600*1000 + 6*3600*1000).toISOString(),
    type:        'concert',
    status:      'published',
    cover_url:   'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=800&q=80',
    distance_km: 8.7,
    organizer:   { company_name:'Live Nation France', avatar_url:'https://i.pravatar.cc/40?img=80', rating:4.9 },
    roles: [
      { id:'r10', role:'Agent de sécurité', slots:40, slots_filled:32, hourly_rate:20, dress_code:'Gilet jaune fourni' },
      { id:'r11', role:'Coordinateur·rice', slots:8,  slots_filled:5,  hourly_rate:22, dress_code:'Badge + polo LN' },
    ],
  },
  {
    id:          'e5',
    title:       'Brouillon — Festival Été 2025',
    description: 'Festival 3 jours en cours de préparation.',
    location:    'À définir',
    date_start:  new Date(Date.now() + 60*24*3600*1000).toISOString(),
    date_end:    new Date(Date.now() + 63*24*3600*1000).toISOString(),
    type:        'festival',
    status:      'draft',
    organizer:   { company_name:'Hugo Chassaing', rating:0 },
    roles: [
      { id:'r12', role:'Serveur·se', slots:20, slots_filled:0, hourly_rate:15, dress_code:'' },
    ],
  },
];

export const MOCK_APPLICATIONS = [
  { id:'a1', event_role_id:'r1', staff_id:'s1', status:'pending',  applied_at:new Date(Date.now()-2*3600*1000).toISOString(), staff:MOCK_STAFF[0] },
  { id:'a2', event_role_id:'r1', staff_id:'s4', status:'pending',  applied_at:new Date(Date.now()-5*3600*1000).toISOString(), staff:MOCK_STAFF[3] },
  { id:'a3', event_role_id:'r2', staff_id:'s2', status:'accepted', applied_at:new Date(Date.now()-24*3600*1000).toISOString(), staff:MOCK_STAFF[1] },
  { id:'a4', event_role_id:'r4', staff_id:'s3', status:'rejected', applied_at:new Date(Date.now()-48*3600*1000).toISOString(), staff:MOCK_STAFF[2] },
];

export const MOCK_MISSIONS = [
  { id:'m1', staff_id:'s1', event_id:'e1', check_in:null, check_out:null, hours_worked:0, amount_due:80, payment_status:'pending' },
];

export const MOCK_STATS = {
  organizer: { active:4, pending:2, hired:47, revenue:8420 },
  staff:     { missions_done:12, earnings_month:1840, rating:4.8, upcoming:2 },
};
MOCKDATA

# ── lib/api.ts ─────────────────────────────────────────────────────────────
cat > lib/api.ts << 'API'
/**
 * lib/api.ts
 * Couche API — utilise Supabase si configuré, mock data sinon.
 * Remplacez isMockMode par false dès que votre Supabase est prêt.
 */

import { supabase, isMockMode } from './supabase';
import {
  MOCK_EVENTS, MOCK_STAFF, MOCK_APPLICATIONS,
  MOCK_MISSIONS, MOCK_STATS, MOCK_USER,
} from './mockData';

// ── Events ────────────────────────────────────────────────────────────────
export async function getEvents(organizerId?: string) {
  if (isMockMode) {
    return organizerId
      ? MOCK_EVENTS.filter(() => true)
      : MOCK_EVENTS.filter(e => e.status === 'published');
  }
  const q = supabase.from('events').select(`
    id, title, description, location, date_start, date_end,
    type, status, cover_url,
    event_roles(id, role, slots, slots_filled, hourly_rate, dress_code)
  `);
  if (organizerId) q.eq('organizer_id', organizerId);
  const { data } = await q.order('date_start', { ascending:true });
  return data ?? [];
}

export async function createEvent(payload: any) {
  if (isMockMode) {
    console.log('[MOCK] createEvent:', payload);
    return { id: 'mock-event-' + Date.now(), ...payload };
  }
  const { data, error } = await supabase.from('events').insert(payload).select('id').single();
  if (error) throw error;
  return data;
}

// ── Applications ─────────────────────────────────────────────────────────
export async function getApplications(eventId?: string) {
  if (isMockMode) return MOCK_APPLICATIONS;
  const { data } = await supabase.from('applications').select('*, staff:staff_id(*)');
  return data ?? [];
}

export async function applyToEvent(eventRoleId: string, staffId: string, message?: string) {
  if (isMockMode) {
    console.log('[MOCK] applyToEvent:', eventRoleId);
    return { id: 'mock-app-' + Date.now(), status:'pending' };
  }
  const { data, error } = await supabase.from('applications').insert({
    event_role_id: eventRoleId, staff_id: staffId, message,
  }).select().single();
  if (error) throw error;
  return data;
}

export async function updateApplicationStatus(id: string, status: 'accepted'|'rejected') {
  if (isMockMode) { console.log('[MOCK] updateApp:', id, status); return; }
  await supabase.from('applications').update({ status }).eq('id', id);
}

// ── Staff ─────────────────────────────────────────────────────────────────
export async function getStaff() {
  if (isMockMode) return MOCK_STAFF;
  const { data } = await supabase.from('staff').select('*').eq('is_available', true);
  return data ?? [];
}

// ── Stats ─────────────────────────────────────────────────────────────────
export async function getOrganizerStats(organizerId: string) {
  if (isMockMode) return MOCK_STATS.organizer;
  // TODO : requêtes Supabase agrégées
  return MOCK_STATS.organizer;
}

// ── Auth ──────────────────────────────────────────────────────────────────
export async function getCurrentUser() {
  if (isMockMode) return MOCK_USER;
  const { data:{ user } } = await supabase.auth.getUser();
  return user;
}
API

echo "✅ Librairie centrale créée"

# ─────────────────────────────────────────────────────────────────────────────
# ÉTAPE 7 — Constantes et thème
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "🎨 Étape 7 — Thème et constantes"

cat > constants/theme.ts << 'THEME'
// constants/theme.ts — Design tokens Eventure
export const COLORS = {
  bg:      '#070C17',    // fond principal
  navy:    '#0D2240',    // surfaces
  violet:  '#A78BFA',    // accent principal
  white:   '#FFFFFF',
  muted:   'rgba(255,255,255,0.50)',
  faint:   'rgba(255,255,255,0.18)',
  surf:    'rgba(255,255,255,0.05)',
  surfHi:  'rgba(255,255,255,0.09)',
  border:  'rgba(255,255,255,0.08)',
  gold:    '#F5C842',
  green:   '#22C55E',
  amber:   '#F59E0B',
  red:     '#EF4444',
} as const;

export const SPACING = {
  xs:  4,  sm:  8,
  md:  16, lg:  24,
  xl:  32, xxl: 48,
} as const;

export const RADIUS = {
  sm:  8,  md: 14,
  lg:  18, xl: 24,
  full: 999,
} as const;
THEME

cat > constants/roles.ts << 'ROLES'
// constants/roles.ts — Catalogue des rôles métier
export const ROLES_CATALOGUE = [
  'Serveur·se', 'Barman / Barmaid', 'Chef de rang',
  "Hôte·sse d'accueil", 'Agent de sécurité', 'Coordinateur·rice',
  'Runner', 'Sommelier·ère', 'Valet parking',
  'Technicien·ne son/lumière', 'Photographe', 'Vidéaste',
] as const;

export const EVENT_TYPES = [
  { key:'wedding',   label:'Mariage',    icon:'heart-outline'         },
  { key:'corporate', label:'Corporate',  icon:'business-outline'      },
  { key:'concert',   label:'Concert',    icon:'musical-notes-outline' },
  { key:'sport',     label:'Sport',      icon:'trophy-outline'        },
  { key:'gala',      label:'Gala',       icon:'sparkles-outline'      },
  { key:'festival',  label:'Festival',   icon:'color-palette-outline' },
  { key:'private',   label:'Privé',      icon:'home-outline'          },
  { key:'other',     label:'Autre',      icon:'calendar-outline'      },
] as const;

export const ROLE_ICONS: Record<string, string> = {
  'Serveur·se':            'restaurant-outline',
  'Barman / Barmaid':      'beer-outline',
  'Chef de rang':          'star-outline',
  "Hôte·sse d'accueil":   'person-outline',
  'Agent de sécurité':     'shield-outline',
  'Coordinateur·rice':     'clipboard-outline',
  'Runner':                'walk-outline',
  'Sommelier·ère':         'wine-outline',
  'Valet parking':         'car-outline',
  'Technicien·ne son/lumière':'musical-note-outline',
  'Photographe':           'camera-outline',
  'Vidéaste':              'videocam-outline',
};
ROLES

echo "✅ Thème créé"

# ─────────────────────────────────────────────────────────────────────────────
# ÉTAPE 8 — Navigation (Expo Router)
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "🗺️  Étape 8 — Navigation"

# ── app/_layout.tsx ─────────────────────────────────────────────────────────
cat > app/_layout.tsx << 'ROOT_LAYOUT'
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
ROOT_LAYOUT

# ── app/index.tsx — redirection selon le rôle ────────────────────────────────
cat > app/index.tsx << 'INDEX'
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
INDEX

# ── app/(auth)/welcome.tsx ───────────────────────────────────────────────────
cat > app/\(auth\)/welcome.tsx << 'WELCOME'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '@/constants/theme';

export default function WelcomeScreen() {
  const router = useRouter();
  return (
    <View style={s.root}>
      <LinearGradient colors={['#070C17','#0D1A35']} style={StyleSheet.absoluteFill}/>
      <SafeAreaView style={s.inner}>
        <View style={s.hero}>
          <View style={s.logoBox}>
            <Ionicons name="calendar" size={40} color={COLORS.violet}/>
          </View>
          <Text style={s.title}>Eventure</Text>
          <Text style={s.sub}>Plateforme de staffing événementiel</Text>
        </View>
        <View style={s.btns}>
          <TouchableOpacity style={s.orgaBtn} onPress={()=>router.push('/(organizer)/dashboard' as any)} activeOpacity={0.85}>
            <LinearGradient colors={['rgba(167,139,250,0.35)','rgba(167,139,250,0.15)']} style={s.btnGrad}>
              <Ionicons name="business-outline" size={20} color={COLORS.violet}/>
              <Text style={s.orgaTxt}>Je suis Organisateur</Text>
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity style={s.staffBtn} onPress={()=>router.push('/(staff)/feed' as any)} activeOpacity={0.85}>
            <Text style={s.staffTxt}>Je cherche des missions →</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}
const s = StyleSheet.create({
  root:     { flex:1 },
  inner:    { flex:1, paddingHorizontal:24, justifyContent:'space-between', paddingVertical:40 },
  hero:     { flex:1, alignItems:'center', justifyContent:'center', gap:16 },
  logoBox:  { width:80, height:80, borderRadius:24, backgroundColor:'rgba(167,139,250,0.18)', alignItems:'center', justifyContent:'center', borderWidth:1, borderColor:'rgba(167,139,250,0.35)' },
  title:    { color:'#fff', fontSize:36, fontWeight:'900', letterSpacing:-1 },
  sub:      { color:'rgba(255,255,255,0.50)', fontSize:15, textAlign:'center' },
  btns:     { gap:14 },
  orgaBtn:  { borderRadius:18, overflow:'hidden', borderWidth:1, borderColor:'rgba(167,139,250,0.40)' },
  btnGrad:  { flexDirection:'row', alignItems:'center', justifyContent:'center', gap:12, paddingVertical:18 },
  orgaTxt:  { color:'#A78BFA', fontSize:16, fontWeight:'800' },
  staffBtn: { alignItems:'center', paddingVertical:16 },
  staffTxt: { color:'rgba(255,255,255,0.60)', fontSize:15, fontWeight:'600' },
});
WELCOME

# ── app/(organizer)/_layout.tsx ─────────────────────────────────────────────
cat > app/\(organizer\)/_layout.tsx << 'ORGA_LAYOUT'
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
ORGA_LAYOUT

# ── app/(staff)/_layout.tsx ─────────────────────────────────────────────────
cat > app/\(staff\)/_layout.tsx << 'STAFF_LAYOUT'
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
STAFF_LAYOUT

echo "✅ Navigation créée"

# ─────────────────────────────────────────────────────────────────────────────
# ÉTAPE 9 — Screens principaux
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "📱 Étape 9 — Screens"

# ── app/(organizer)/dashboard.tsx ──────────────────────────────────────────
cat > app/\(organizer\)/dashboard.tsx << 'DASH'
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { COLORS } from '@/constants/theme';
import { getEvents, getOrganizerStats, getCurrentUser } from '@/lib/api';

const T = COLORS;

export default function Dashboard() {
  const router = useRouter();
  const [events,     setEvents]     = useState<any[]>([]);
  const [stats,      setStats]      = useState({ active:0, pending:0, hired:0, revenue:0 });
  const [user,       setUser]       = useState<any>(null);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab,        setTab]        = useState<'published'|'draft'|'done'>('published');

  const load = async () => {
    const [u, evts, st] = await Promise.all([
      getCurrentUser(),
      getEvents(),
      getOrganizerStats(''),
    ]);
    setUser(u);
    setEvents(evts as any[]);
    setStats(st as any);
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = events.filter(e => e.status === tab);

  const STATUS_COLOR: Record<string,string> = {
    published: T.green, draft: T.amber, done: T.muted, closed: T.faint,
  };

  return (
    <View style={s.root}>
      <LinearGradient colors={['#0D1A35','#070C17']} style={StyleSheet.absoluteFill}/>
      <SafeAreaView edges={['top']}>
        <View style={s.nav}>
          <View>
            <Text style={s.greeting}>Bonjour 👋</Text>
            <Text style={s.name}>{user?.display_name ?? '…'}</Text>
          </View>
          <TouchableOpacity style={s.createBtn} onPress={()=>router.push('/(organizer)/create-event' as any)} activeOpacity={0.82}>
            <LinearGradient colors={['rgba(167,139,250,0.35)','rgba(167,139,250,0.18)']} style={s.createGrad}>
              <Ionicons name="add" size={18} color={T.violet}/>
              <Text style={s.createTxt}>Créer</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom:100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>{setRefreshing(true);load();}} tintColor={T.violet}/>}
      >
        {/* Stats */}
        <View style={s.statsGrid}>
          {[
            { icon:'calendar-outline',l:'Actives',    v:String(stats.active),  c:T.violet },
            { icon:'time-outline',    l:'En attente', v:String(stats.pending), c:T.amber  },
            { icon:'people-outline',  l:'Recrutés',   v:String(stats.hired),   c:T.green  },
            { icon:'cash-outline',    l:'Budget',     v:`${(stats.revenue/1000).toFixed(0)}K€`, c:T.gold },
          ].map(({ icon, l, v, c }) => (
            <View key={l} style={[s.statCard, { borderColor:`${c}28` }]}>
              <Ionicons name={icon as any} size={18} color={c}/>
              <Text style={[s.statVal, { color:c }]}>{v}</Text>
              <Text style={s.statLabel}>{l}</Text>
            </View>
          ))}
        </View>

        {/* Tabs */}
        <View style={s.tabs}>
          {(['published','draft','done'] as const).map(k => (
            <TouchableOpacity key={k} style={[s.tab, tab===k&&s.tabActive]} onPress={()=>setTab(k)} activeOpacity={0.75}>
              <Text style={[s.tabTxt, tab===k&&s.tabTxtActive]}>
                {k==='published'?'En ligne':k==='draft'?'Brouillons':'Terminées'}
                {` (${events.filter(e=>e.status===k).length})`}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Events */}
        <View style={s.list}>
          {loading ? (
            <ActivityIndicator color={T.violet} size="large" style={{marginTop:40}}/>
          ) : filtered.length === 0 ? (
            <View style={s.empty}>
              <Ionicons name="calendar-outline" size={40} color={T.faint}/>
              <Text style={s.emptyTxt}>Aucune mission {tab==='published'?'active':tab==='draft'?'en brouillon':'terminée'}</Text>
              {tab==='published'&&<TouchableOpacity style={s.emptyBtn} onPress={()=>router.push('/(organizer)/create-event' as any)}>
                <Text style={s.emptyBtnTxt}>+ Créer ma première mission</Text>
              </TouchableOpacity>}
            </View>
          ) : filtered.map((e: any) => (
            <TouchableOpacity key={e.id} style={s.eventCard} onPress={()=>router.push({ pathname:'/(organizer)/event/[id]', params:{id:e.id} } as any)} activeOpacity={0.85}>
              <View style={s.eventTop}>
                <View style={[s.eventDot, { backgroundColor: STATUS_COLOR[e.status]??T.muted }]}/>
                <Text style={s.eventTitle} numberOfLines={1}>{e.title}</Text>
                <Ionicons name="chevron-forward" size={14} color={T.faint}/>
              </View>
              <Text style={s.eventMeta}>
                {new Date(e.date_start).toLocaleDateString('fr-FR',{day:'numeric',month:'short'})}
                {'  ·  '}{e.location?.split(',')[0]}
              </Text>
              <View style={s.eventRoles}>
                {(e.roles??[]).map((r:any) => (
                  <View key={r.id} style={s.rolePill}>
                    <Text style={s.rolePillTxt}>{r.role} · {r.slots_filled}/{r.slots}</Text>
                  </View>
                ))}
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root:       { flex:1 },
  nav:        { flexDirection:'row', justifyContent:'space-between', alignItems:'center', paddingHorizontal:20, paddingVertical:14 },
  greeting:   { color:'rgba(255,255,255,0.50)', fontSize:13 },
  name:       { color:'#fff', fontSize:20, fontWeight:'900', letterSpacing:-0.3 },
  createBtn:  { borderRadius:16, overflow:'hidden', borderWidth:1, borderColor:'rgba(167,139,250,0.35)' },
  createGrad: { flexDirection:'row', alignItems:'center', gap:6, paddingHorizontal:16, paddingVertical:10 },
  createTxt:  { color:'#A78BFA', fontSize:14, fontWeight:'800' },
  statsGrid:  { flexDirection:'row', flexWrap:'wrap', gap:10, paddingHorizontal:20, paddingBottom:16 },
  statCard:   { width:'47%', backgroundColor:'rgba(255,255,255,0.05)', borderRadius:16, padding:14, gap:8, alignItems:'center', borderWidth:StyleSheet.hairlineWidth },
  statVal:    { fontSize:24, fontWeight:'900', letterSpacing:-0.5 },
  statLabel:  { color:'rgba(255,255,255,0.40)', fontSize:10, fontWeight:'600', textTransform:'uppercase', letterSpacing:0.5 },
  tabs:       { flexDirection:'row', paddingHorizontal:20, gap:8, marginBottom:16 },
  tab:        { paddingHorizontal:14, paddingVertical:8, borderRadius:20, backgroundColor:'rgba(255,255,255,0.05)', borderWidth:StyleSheet.hairlineWidth, borderColor:'rgba(255,255,255,0.08)' },
  tabActive:  { backgroundColor:'rgba(167,139,250,0.18)', borderColor:'#A78BFA' },
  tabTxt:     { color:'rgba(255,255,255,0.50)', fontSize:12, fontWeight:'600' },
  tabTxtActive:{ color:'#A78BFA' },
  list:       { paddingHorizontal:20 },
  eventCard:  { backgroundColor:'rgba(255,255,255,0.05)', borderRadius:18, padding:16, marginBottom:12, borderWidth:StyleSheet.hairlineWidth, borderColor:'rgba(167,139,250,0.18)', gap:8 },
  eventTop:   { flexDirection:'row', alignItems:'center', gap:8 },
  eventDot:   { width:8, height:8, borderRadius:4 },
  eventTitle: { flex:1, color:'#fff', fontSize:15, fontWeight:'800' },
  eventMeta:  { color:'rgba(255,255,255,0.45)', fontSize:12 },
  eventRoles: { flexDirection:'row', flexWrap:'wrap', gap:6 },
  rolePill:   { backgroundColor:'rgba(167,139,250,0.15)', borderRadius:10, paddingHorizontal:10, paddingVertical:4 },
  rolePillTxt:{ color:'#A78BFA', fontSize:11, fontWeight:'600' },
  empty:      { alignItems:'center', paddingVertical:48, gap:12 },
  emptyTxt:   { color:'rgba(255,255,255,0.40)', fontSize:15, textAlign:'center' },
  emptyBtn:   { backgroundColor:'rgba(167,139,250,0.15)', borderRadius:14, paddingHorizontal:20, paddingVertical:12, borderWidth:1, borderColor:'rgba(167,139,250,0.35)' },
  emptyBtnTxt:{ color:'#A78BFA', fontSize:13, fontWeight:'700' },
});
DASH

# ── app/(staff)/feed.tsx ──────────────────────────────────────────────────
cat > app/\(staff\)/feed.tsx << 'FEED'
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { COLORS } from '@/constants/theme';
import { getEvents, getCurrentUser } from '@/lib/api';

const T = COLORS;

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR',{weekday:'short',day:'numeric',month:'short'});
}

export default function StaffFeed() {
  const router = useRouter();
  const [events, setEvents]   = useState<any[]>([]);
  const [user,   setUser]     = useState<any>(null);
  const [loading,setLoading]  = useState(true);
  const [refresh,setRefresh]  = useState(false);
  const [filter, setFilter]   = useState('all');

  const load = async () => {
    const [u, evts] = await Promise.all([getCurrentUser(), getEvents()]);
    setUser(u); setEvents(evts as any[]); setLoading(false); setRefresh(false);
  };

  useEffect(() => { load(); }, []);

  const filters = [
    { key:'all',       label:'Toutes'   },
    { key:'gala',      label:'Gala'     },
    { key:'wedding',   label:'Mariage'  },
    { key:'corporate', label:'Corporate'},
    { key:'concert',   label:'Concert'  },
  ];

  const filtered = filter==='all' ? events : events.filter(e=>e.type===filter);

  return (
    <View style={s.root}>
      <LinearGradient colors={['#0D1A35','#070C17']} style={StyleSheet.absoluteFill}/>
      <SafeAreaView edges={['top']}>
        <View style={s.header}>
          <View>
            <Text style={s.hello}>Missions disponibles</Text>
            <Text style={s.sub}>{filtered.length} mission{filtered.length>1?'s':''} près de toi</Text>
          </View>
          <TouchableOpacity style={s.profileBtn} onPress={()=>router.push('/(staff)/profile' as any)}>
            <Image source={{ uri:user?.avatar_url ?? 'https://i.pravatar.cc/40' }} style={s.avatar} contentFit="cover"/>
          </TouchableOpacity>
        </View>

        {/* Filtres */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filters}>
          {filters.map(f => (
            <TouchableOpacity key={f.key} style={[s.filterPill, filter===f.key&&s.filterActive]} onPress={()=>setFilter(f.key)} activeOpacity={0.75}>
              <Text style={[s.filterTxt, filter===f.key&&s.filterTxtActive]}>{f.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </SafeAreaView>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding:20, paddingBottom:100, gap:16 }}
        refreshControl={<RefreshControl refreshing={refresh} onRefresh={()=>{setRefresh(true);load();}} tintColor={T.violet}/>}
      >
        {filtered.map((e:any) => {
          const open = (e.roles??[]).reduce((a:number,r:any)=>a+(r.slots-r.slots_filled),0);
          const rate = Math.max(...((e.roles??[]).map((r:any)=>r.hourly_rate) as number[]));
          return (
            <TouchableOpacity key={e.id} style={s.card} onPress={()=>router.push({ pathname:'/(staff)/mission/[id]', params:{id:e.id} } as any)} activeOpacity={0.88}>
              {e.cover_url && <Image source={{ uri:e.cover_url }} style={s.cardImg} contentFit="cover"/>}
              {!e.cover_url && <LinearGradient colors={['#0D1A35','#070C17']} style={s.cardImg}/>}
              <LinearGradient colors={['transparent','rgba(7,12,23,0.95)']} style={StyleSheet.absoluteFillObject}/>

              <View style={s.cardBadge}>
                <Text style={s.cardBadgeTxt}>{open} poste{open>1?'s':''} dispo</Text>
              </View>

              {e.distance_km && (
                <View style={s.distBadge}>
                  <Ionicons name="location-outline" size={10} color={T.muted}/>
                  <Text style={s.distTxt}>{e.distance_km < 1 ? '<1' : Math.round(e.distance_km)} km</Text>
                </View>
              )}

              <View style={s.cardBody}>
                <Text style={s.cardTitle} numberOfLines={2}>{e.title}</Text>
                <View style={s.cardRow}>
                  <Ionicons name="calendar-outline" size={12} color={T.violet}/>
                  <Text style={s.cardMeta}>{fmtDate(e.date_start)}</Text>
                  <Ionicons name="location-outline" size={12} color={T.violet}/>
                  <Text style={s.cardMeta} numberOfLines={1}>{e.location?.split(',')[0]}</Text>
                </View>
                <View style={s.cardRow}>
                  <Ionicons name="cash-outline" size={12} color={T.gold}/>
                  <Text style={[s.cardMeta,{color:T.gold,fontWeight:'700'}]}>jusqu'à {rate} €/h</Text>
                  {e.organizer && <Text style={s.cardMeta}>· {e.organizer.company_name}</Text>}
                </View>
                <TouchableOpacity style={s.applyBtn} onPress={()=>router.push({ pathname:'/(staff)/mission/[id]', params:{id:e.id} } as any)} activeOpacity={0.82}>
                  <LinearGradient colors={['rgba(167,139,250,0.35)','rgba(167,139,250,0.18)']} style={s.applyGrad}>
                    <Text style={s.applyTxt}>Voir la mission</Text>
                    <Ionicons name="arrow-forward" size={14} color={T.violet}/>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root:          { flex:1 },
  header:        { flexDirection:'row', justifyContent:'space-between', alignItems:'center', paddingHorizontal:20, paddingVertical:12 },
  hello:         { color:'#fff', fontSize:22, fontWeight:'900', letterSpacing:-0.4 },
  sub:           { color:'rgba(255,255,255,0.45)', fontSize:13, marginTop:2 },
  profileBtn:    { padding:2 },
  avatar:        { width:40, height:40, borderRadius:20, borderWidth:2, borderColor:'rgba(167,139,250,0.50)' },
  filters:       { paddingHorizontal:20, paddingBottom:14, gap:8 },
  filterPill:    { paddingHorizontal:16, paddingVertical:8, borderRadius:20, backgroundColor:'rgba(255,255,255,0.05)', borderWidth:StyleSheet.hairlineWidth, borderColor:'rgba(255,255,255,0.08)' },
  filterActive:  { backgroundColor:'rgba(167,139,250,0.20)', borderColor:'#A78BFA' },
  filterTxt:     { color:'rgba(255,255,255,0.50)', fontSize:13, fontWeight:'600' },
  filterTxtActive:{ color:'#A78BFA' },
  card:          { borderRadius:20, overflow:'hidden', backgroundColor:'#0D1A35', borderWidth:StyleSheet.hairlineWidth, borderColor:'rgba(167,139,250,0.20)', minHeight:280 },
  cardImg:       { position:'absolute', top:0, left:0, right:0, height:200 },
  cardBadge:     { position:'absolute', top:14, left:14, backgroundColor:'rgba(167,139,250,0.30)', paddingHorizontal:12, paddingVertical:5, borderRadius:20, borderWidth:1, borderColor:'rgba(167,139,250,0.50)' },
  cardBadgeTxt:  { color:'#A78BFA', fontSize:11, fontWeight:'800' },
  distBadge:     { position:'absolute', top:14, right:14, flexDirection:'row', alignItems:'center', gap:4, backgroundColor:'rgba(7,12,23,0.75)', paddingHorizontal:10, paddingVertical:5, borderRadius:12 },
  distTxt:       { color:'rgba(255,255,255,0.60)', fontSize:10, fontWeight:'600' },
  cardBody:      { padding:18, paddingTop:140, gap:8 },
  cardTitle:     { color:'#fff', fontSize:18, fontWeight:'900', letterSpacing:-0.3, lineHeight:24 },
  cardRow:       { flexDirection:'row', alignItems:'center', gap:6, flexWrap:'wrap' },
  cardMeta:      { color:'rgba(255,255,255,0.55)', fontSize:12, fontWeight:'500', flex:1 },
  applyBtn:      { borderRadius:14, overflow:'hidden', marginTop:4, borderWidth:1, borderColor:'rgba(167,139,250,0.40)' },
  applyGrad:     { flexDirection:'row', alignItems:'center', justifyContent:'center', gap:8, paddingVertical:14 },
  applyTxt:      { color:'#A78BFA', fontSize:14, fontWeight:'800' },
});
FEED

# ── Placeholders pour les autres screens ────────────────────────────────────
for SCREEN in "app/(organizer)/create-event.tsx" "app/(organizer)/event/[id].tsx" "app/(organizer)/applications.tsx" "app/(staff)/mission/[id].tsx" "app/(staff)/planning.tsx" "app/(staff)/earnings.tsx" "app/(staff)/profile.tsx"; do
  NAME=$(basename "$SCREEN" .tsx)
  cat > "$SCREEN" << PLACEHOLDER
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
export default function Screen() {
  const router = useRouter();
  return (
    <View style={{ flex:1 }}>
      <LinearGradient colors={['#0D1A35','#070C17']} style={StyleSheet.absoluteFill}/>
      <SafeAreaView style={{ flex:1, alignItems:'center', justifyContent:'center', gap:16 }}>
        <Ionicons name="construct-outline" size={48} color="#A78BFA"/>
        <Text style={{ color:'#fff', fontSize:20, fontWeight:'800' }}>$NAME</Text>
        <Text style={{ color:'rgba(255,255,255,0.45)', fontSize:13 }}>Écran en cours de construction</Text>
        <TouchableOpacity onPress={()=>router.back()} style={{ backgroundColor:'rgba(167,139,250,0.20)', borderRadius:14, paddingHorizontal:20, paddingVertical:12, borderWidth:1, borderColor:'rgba(167,139,250,0.40)' }}>
          <Text style={{ color:'#A78BFA', fontWeight:'700' }}>← Retour</Text>
        </TouchableOpacity>
      </SafeAreaView>
    </View>
  );
}
PLACEHOLDER
done

echo "✅ Screens créés"

# ─────────────────────────────────────────────────────────────────────────────
# ÉTAPE 10 — SQL Supabase (optionnel — pour quand tu connectes Supabase)
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "🗄️  Étape 10 — Schéma SQL (fichier à exécuter dans Supabase)"

cat > supabase-schema.sql << 'SQL'
-- ─────────────────────────────────────────────────────────────────────────────
-- EVENTURE — Schéma Supabase
-- À exécuter dans : Supabase > SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE organizers (
  id            uuid PRIMARY KEY REFERENCES auth.users,
  company_name  text, contact_name text, phone text,
  avatar_url    text, rating numeric(2,1) DEFAULT 0,
  events_count  int DEFAULT 0, verified boolean DEFAULT false,
  siret         text, created_at timestamptz DEFAULT now()
);

CREATE TABLE staff (
  id              uuid PRIMARY KEY REFERENCES auth.users,
  display_name    text, avatar_url text,
  role            text[], hourly_rate numeric(6,2),
  experience_years int, location text,
  latitude float, longitude float,
  rating          numeric(2,1) DEFAULT 0,
  missions_count  int DEFAULT 0,
  is_available    boolean DEFAULT true,
  stripe_account  text, verified boolean DEFAULT false,
  created_at      timestamptz DEFAULT now()
);

CREATE TABLE events (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizer_id  uuid REFERENCES organizers,
  title         text NOT NULL, description text,
  location      text NOT NULL, latitude float, longitude float,
  date_start    timestamptz NOT NULL, date_end timestamptz NOT NULL,
  type          text, status text DEFAULT 'draft',
  cover_url     text, created_at timestamptz DEFAULT now()
);

CREATE TABLE event_roles (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id      uuid REFERENCES events ON DELETE CASCADE,
  role          text NOT NULL, slots int NOT NULL,
  slots_filled  int DEFAULT 0, hourly_rate numeric(6,2),
  dress_code    text, requirements text
);

CREATE TABLE applications (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_role_id uuid REFERENCES event_roles ON DELETE CASCADE,
  staff_id      uuid REFERENCES staff,
  status        text DEFAULT 'pending',
  message       text, applied_at timestamptz DEFAULT now(),
  UNIQUE(event_role_id, staff_id)
);

CREATE TABLE missions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid REFERENCES applications,
  staff_id      uuid REFERENCES staff,
  event_id      uuid REFERENCES events,
  check_in      timestamptz, check_out timestamptz,
  hours_worked  numeric(4,2), amount_due numeric(8,2),
  amount_paid   numeric(8,2) DEFAULT 0,
  payment_status text DEFAULT 'pending',
  stripe_transfer text, created_at timestamptz DEFAULT now()
);

CREATE TABLE reviews (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id  uuid REFERENCES missions,
  reviewer_id uuid REFERENCES auth.users,
  reviewee_id uuid REFERENCES auth.users,
  rating      int CHECK (rating BETWEEN 1 AND 5),
  comment     text, created_at timestamptz DEFAULT now(),
  UNIQUE(mission_id, reviewer_id)
);

-- RLS basique
ALTER TABLE events       ENABLE ROW LEVEL SECURITY;
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE missions      ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public events" ON events FOR SELECT USING (status = 'published');
CREATE POLICY "Own events"    ON events FOR ALL    USING (organizer_id = auth.uid());
SQL

echo "✅ SQL créé dans supabase-schema.sql"

# ─────────────────────────────────────────────────────────────────────────────
# ÉTAPE 11 — Git initial
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "📝 Étape 11 — Git"
git init
git add .
git commit -m "🎉 Initial commit — Eventure Event Staffing Platform"
echo "✅ Git initialisé"

# ─────────────────────────────────────────────────────────────────────────────
# FIN — Lancer l'app
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "─────────────────────────────────────────────────────────────────"
echo "✅ EVENTURE — Setup terminé !"
echo ""
echo "📱 Pour lancer l'app :"
echo "   cd eventure"
echo "   npx expo start"
echo ""
echo "🌐 Pour le web :"
echo "   npx expo start --web"
echo ""
echo "📋 Prochaines étapes :"
echo "   1. Créer un projet sur https://supabase.com"
echo "   2. Copier URL + clé dans .env.local"
echo "   3. Exécuter supabase-schema.sql dans Supabase > SQL Editor"
echo "   4. Mettre EXPO_PUBLIC_MOCK_MODE=false dans .env.local"
echo "─────────────────────────────────────────────────────────────────"