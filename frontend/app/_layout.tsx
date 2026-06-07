/**
 * app/_layout.tsx — EVENTURE · ROOT LAYOUT
 *
 * ★ Architecture IDENTIQUE Universe v9
 * ★ Overlay anti-screenshot RETIRÉ du web ici
 *   → géré exclusivement par la couche app.json / service worker
 * ★ Natif uniquement : FLAG_SECURE Android + détection iOS
 * ★ NavBar toujours visible (pas de /reels dans Eventure → pas d'animation)
 * ★ Zéro typeof/document/window au module-level → pas de SyntaxError SSR
 */
import React, {
  useCallback, useEffect, useRef, useState,
} from 'react';
import {
  Animated,
  AppState,
  Dimensions,
  Platform,
  StyleSheet,
  Text,
  View,
  type AppStateStatus,
} from 'react-native';
import { Stack, usePathname, useRouter, useSegments } from 'expo-router';
import { SafeAreaProvider }  from 'react-native-safe-area-context';
import { StatusBar }         from 'expo-status-bar';
import * as SplashScreen     from 'expo-splash-screen';
import { Ionicons }          from '@expo/vector-icons';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient }    from 'expo-linear-gradient';
import { supabase }          from '@/lib/supabase';
import CustomNavBar          from '../components/CustomNavBar';

SplashScreen.preventAutoHideAsync().catch(() => {});

const { width: SW, height: SH } = Dimensions.get('window');

// ─────────────────────────────────────────────────────────────────────────────
// Particules pré-calculées — aucun typeof, aucun window ici (identique STARS Universe)
// Vert #00D97E + or #F5C842 + blanc pour l'overlay Eventure
// ─────────────────────────────────────────────────────────────────────────────
const PARTICLES = Array.from({ length: 80 }, (_, i) => ({
  key:  i,
  x:    ((Math.sin(i * 2.399) + 1) / 2) * SW,
  y:    ((Math.cos(i * 1.618) + 1) / 2) * SH,
  r:    i % 7 === 0 ? 1.8 : i % 3 === 0 ? 1.1 : 0.6,
  op:   0.10 + (i % 8) * 0.05,
  // Vert pour les grandes, or pour les moyennes, blanc pour les petites
  col:  i % 7 === 0 ? '#00D97E' : i % 3 === 0 ? '#F5C842' : 'rgba(255,255,255,0.70)',
}));

// ─────────────────────────────────────────────────────────────────────────────
// OVERLAY EVENTURE (natif seulement — non rendu sur web)
// Identique ScreenshotOverlay Universe — texte + icône adaptés staffing
// ─────────────────────────────────────────────────────────────────────────────
const ScreenshotOverlay = React.memo(function ScreenshotOverlay({
  visible,
}: { visible: boolean }) {
  const anim = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.timing(anim, { toValue: 1, duration: 100, useNativeDriver: true }).start();
    } else {
      Animated.timing(anim, { toValue: 0, duration: 280, useNativeDriver: true }).start(
        ({ finished }) => { if (finished) setMounted(false); },
      );
    }
  }, [visible, anim]);

  if (!mounted) return null;

  return (
    <Animated.View
      style={[StyleSheet.absoluteFillObject, { zIndex: 99999, opacity: anim }]}
      pointerEvents="none"
    >
      {/* Fond dégradé Eventure — identique structure Universe mais vert sombre */}
      <LinearGradient
        colors={['#020A06', '#051A0E', '#0A2218', '#020A06']}
        locations={[0, 0.35, 0.70, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* Particules vert/or — identique pattern étoiles Universe */}
      {PARTICLES.map(s => (
        <View key={s.key} style={{
          position:        'absolute',
          left:             s.x - s.r,
          top:              s.y - s.r,
          width:            s.r * 2,
          height:           s.r * 2,
          borderRadius:     s.r,
          backgroundColor:  s.col,
          opacity:          s.op,
        }}/>
      ))}

      {/* Halo vert central — identique halo bleu Universe */}
      <View style={{
        position:        'absolute',
        top:              SH * 0.10,
        left:            -SW * 0.25,
        width:            SW * 1.50,
        height:           SH * 0.45,
        borderRadius:     SW,
        backgroundColor: 'rgba(0,217,126,0.04)',
      }}/>

      {/* Halo or bas droite */}
      <View style={{
        position:        'absolute',
        bottom:           SH * 0.08,
        right:           -SW * 0.20,
        width:            SW * 0.80,
        height:           SW * 0.80,
        borderRadius:     SW * 0.40,
        backgroundColor: 'rgba(245,200,66,0.03)',
      }}/>

      {/* Contenu central — identique structure Universe */}
      <View style={ov.center}>

        {/* Icône — calendar-lock (remplace film-outline Universe) */}
        <View style={ov.iconBox}>
          <MaterialCommunityIcons
            name="calendar-lock"
            size={36}
            color="rgba(0,217,126,0.68)"
          />
        </View>

        <Text style={ov.title}>EVENTURE</Text>
        <Text style={ov.eyebrow}>Staffing Événementiel Professionnel</Text>

        {/* Identique Universe */}
        <View style={ov.divider}/>
        <Text style={ov.msg}>Capture d'écran non autorisée</Text>
        <Text style={ov.sub}>
          Les données de missions et recrutements sont protégées.{'\n'}
          Toute reproduction est strictement interdite.
        </Text>
        <View style={ov.badge}>
          <Ionicons name="shield-checkmark-outline" size={11} color="rgba(0,217,126,0.35)"/>
          <Text style={ov.badgeTxt}>DONNÉES PROFESSIONNELLES PROTÉGÉES</Text>
        </View>

      </View>
    </Animated.View>
  );
});

const ov = StyleSheet.create({
  center: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    gap: 14, paddingHorizontal: 44,
  },
  iconBox: {
    width: 84, height: 84, borderRadius: 22,
    backgroundColor: 'rgba(0,217,126,0.08)',
    borderWidth: 1.5, borderColor: 'rgba(0,217,126,0.18)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 4,
  },
  title:   { color: '#fff', fontSize: 26, fontWeight: '900', letterSpacing: 5, textTransform: 'uppercase' },
  eyebrow: { color: 'rgba(0,217,126,0.38)', fontSize: 10, letterSpacing: 1.8, textTransform: 'uppercase', marginTop: -6, textAlign: 'center' },
  divider: { width: 44, height: 1, backgroundColor: 'rgba(0,217,126,0.14)', borderRadius: 1, marginVertical: 2 },
  msg:     { color: 'rgba(255,255,255,0.72)', fontSize: 15, fontWeight: '700', textAlign: 'center', letterSpacing: -0.2 },
  sub:     { color: 'rgba(255,255,255,0.26)', fontSize: 11, textAlign: 'center', lineHeight: 17, marginTop: -2 },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 13, paddingVertical: 6, borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(0,217,126,0.10)',
    backgroundColor: 'rgba(0,217,126,0.03)', marginTop: 6,
  },
  badgeTxt: { color: 'rgba(0,217,126,0.32)', fontSize: 8.5, fontWeight: '800', letterSpacing: 1.8, textTransform: 'uppercase' },
});

// ─────────────────────────────────────────────────────────────────────────────
// HOOK ANTI-SCREENSHOT — NATIF UNIQUEMENT (identique Universe)
// ─────────────────────────────────────────────────────────────────────────────
function useAntiScreenshot() {
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((ms = 0) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setVisible(true);
    if (ms > 0) timerRef.current = setTimeout(() => setVisible(false), ms);
  }, []);

  const hide = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setVisible(false);
  }, []);

  useEffect(() => {
    // Web → rien à faire ici (pas d'overlay RN sur web, pas de SyntaxError)
    if (Platform.OS === 'web') return;

    // require() dynamique dans useEffect — jamais évalué par Node.js SSR
    let SC: any = null;
    try { SC = require('expo-screen-capture'); } catch {}

    // Android : FLAG_SECURE → capture = image noire (bloqué au niveau OS)
    // iOS     : écran noir dans AirPlay/QuickTime/preview
    SC?.preventScreenCaptureAsync?.().catch(() => {});

    // iOS : détecte la capture (Power + Volume) → overlay 3 s
    let screenshotSub: { remove: () => void } | null = null;
    if (SC?.addScreenshotListener) {
      try { screenshotSub = SC.addScreenshotListener(() => show(3000)); } catch {}
    }

    // App switcher → overlay jusqu'au retour en foreground
    const appSub = AppState.addEventListener('change', (s: AppStateStatus) => {
      if (s === 'background' || s === 'inactive') show(0);
      else if (s === 'active') hide();
    });

    return () => {
      screenshotSub?.remove();
      appSub.remove();
      SC?.allowScreenCaptureAsync?.().catch(() => {});
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [show, hide]);

  // Sur web → toujours false (overlay non rendu)
  return Platform.OS !== 'web' && visible;
}

// // ─────────────────────────────────────────────────────────────────────────────
// // Auth guard (identique Universe — redirige vers welcome si non connecté)
// // ─────────────────────────────────────────────────────────────────────────────
// function useAuthGuard(ready: boolean) {
//   const router   = useRouter();
//   const segments = useSegments();
//   useEffect(() => {
//     if (!ready) return;
//     supabase.auth.getSession().then(({ data: { session } }) => {
//       const inAuth = segments[0] === '(auth)';
//       if (!session && !inAuth) {
//         router.replace('/(auth)/welcome' as any);
//       }
//     });
//   }, [ready, segments]);
// }

// ─────────────────────────────────────────────────────────────────────────────
// NavBarWrapper — identique Universe, sans animation /reels (pas de reels Eventure)
// ─────────────────────────────────────────────────────────────────────────────
function NavBarWrapper() {
  const pathname = usePathname();

  // Masquer sur les écrans plein-écran (identique Universe pour /reels)
  const hidden =
    pathname === '/(auth)/welcome'           ||
    pathname === '/(auth)/login'             ||
    pathname === '/(auth)/register'          ||
    pathname === '/(organizer)/create-event' ;   // formulaire plein-écran

  if (hidden) return null;

  return (
    <View style={lay.nav}>
      <CustomNavBar/>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RootLayout — identique Universe v9 sans ReelsUIProvider
// ─────────────────────────────────────────────────────────────────────────────
export default function RootLayout() {
  const [ready, setReady] = useState(false);
  const screenshotVisible = useAntiScreenshot();


  useEffect(() => {
    supabase.auth.getSession()
      .then(() => { setReady(true); SplashScreen.hideAsync().catch(() => {}); })
      .catch(() => { setReady(true); SplashScreen.hideAsync().catch(() => {}); });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {});
    return () => subscription.unsubscribe();
  }, []);

  if (!ready) return null;

  return (
    <SafeAreaProvider>
      <StatusBar style="light"/>

      <Stack
        screenOptions={{
          headerShown:      false,
          contentStyle:     { backgroundColor: '#020A06' },
          animation:        Platform.OS === 'ios' ? 'default' : 'fade',
          gestureEnabled:   true,
          gestureDirection: 'horizontal',
        }}
      >
        {/* ── Auth ── */}
        <Stack.Screen name="(auth)"
          options={{ headerShown: false }}/>

        {/* ── Organisateur ── */}
        <Stack.Screen name="(organizer)/dashboard"
          options={{ animation: 'none' }}/>
        <Stack.Screen name="(organizer)/create-event"
          options={{ animation: 'slide_from_bottom', gestureDirection: 'vertical' }}/>
        <Stack.Screen name="(organizer)/event/[id]"
          options={{ animation: Platform.OS === 'ios' ? 'default' : 'fade_from_bottom' }}/>
        <Stack.Screen name="(organizer)/applications"
          options={{ animation: Platform.OS === 'ios' ? 'default' : 'fade_from_bottom' }}/>
        <Stack.Screen name="(organizer)/staff-search"
          options={{ animation: Platform.OS === 'ios' ? 'default' : 'fade_from_bottom' }}/>
        <Stack.Screen name="(organizer)/profile"
          options={{ animation: Platform.OS === 'ios' ? 'default' : 'fade_from_bottom' }}/>
        <Stack.Screen name="(organizer)/edit-profile"
          options={{ animation: 'slide_from_bottom', gestureDirection: 'vertical' }}/>
        <Stack.Screen name="(organizer)/analytics"
          options={{ animation: 'slide_from_bottom', gestureDirection: 'vertical' }}/>

        {/* ── Staff ── */}
        <Stack.Screen name="(staff)/feed"
          options={{ animation: 'none' }}/>
        <Stack.Screen name="(staff)/mission/[id]"
          options={{ animation: Platform.OS === 'ios' ? 'default' : 'fade_from_bottom' }}/>
        <Stack.Screen name="(staff)/profile"
          options={{ animation: Platform.OS === 'ios' ? 'default' : 'fade_from_bottom' }}/>

        {/* ── Partagé ── */}
        <Stack.Screen name="(shared)/notifications"
          options={{ animation: Platform.OS === 'ios' ? 'default' : 'fade_from_bottom' }}/>
        <Stack.Screen name="(shared)/settings"
          options={{ animation: Platform.OS === 'ios' ? 'default' : 'fade_from_bottom' }}/>
        <Stack.Screen name="(shared)/chat/[id]"
          options={{ animation: Platform.OS === 'ios' ? 'default' : 'fade_from_bottom' }}/>

        <Stack.Screen name="+not-found" options={{ title: 'Page introuvable' }}/>
      </Stack>

      {/* NavBar — toujours visible sauf écrans auth/plein-écran */}
      <NavBarWrapper/>

      {/* Overlay anti-screenshot — natif uniquement, jamais rendu sur web */}
      <ScreenshotOverlay visible={screenshotVisible}/>

    </SafeAreaProvider>
  );
}

const lay = StyleSheet.create({
  nav: { position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 100 },
});