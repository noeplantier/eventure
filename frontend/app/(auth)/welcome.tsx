import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { BlurView }                from 'expo-blur';
import { LinearGradient }          from 'expo-linear-gradient';
import { Ionicons }                from '@expo/vector-icons';
import { useSafeAreaInsets }       from 'react-native-safe-area-context';
import { StatusBar }               from 'expo-status-bar';
import { useRouter }               from 'expo-router';
import { PUT_IN_COFFEE_USERS, AppUser } from '@/lib/putInCoffeeUsers';
import { useAuth }                 from '@/lib/authContext';

// ─── Constants ───────────────────────────────────────────────────────────────
const { width: SW, height: SH } = Dimensions.get('window');
const BG = '#020818';
const PCOLS = [
  'rgba(255,255,255,0.20)',
  'rgba(255,255,255,0.10)',
  'rgba(255,255,255,0.15)',
  'rgba(255,255,255,0.08)',
  'rgba(255,255,255,0.05)',
];

// ─── Pre-computed particles ───────────────────────────────────────────────────
const PARTICLES = Array.from({ length: 20 }, (_, i) => ({
  key  : i,
  x    : ((Math.sin(i * 2.399) + 1) / 2) * SW,
  y    : ((Math.cos(i * 1.618) + 1) / 2) * SH,
  r    : i % 5 === 0 ? 2.4 : i % 3 === 0 ? 1.4 : 0.8,
  col  : PCOLS[i % PCOLS.length],
  delay: i * 180,
  dur  : 2800 + (i % 4) * 600,
}));

// ─── Animated particle dot ────────────────────────────────────────────────────
const ParticleDot = memo(function ParticleDot({
  x, y, r, col, delay, dur,
}: (typeof PARTICLES)[0]) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(anim, { toValue: 1, duration: dur, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: dur, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [anim, delay, dur]);

  const opacity = anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.08, 0.55, 0.08] });
  const scale   = anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.6, 1.4, 0.6] });

  return (
    <Animated.View
      style={{
        position       : 'absolute',
        left           : x - r,
        top            : y - r,
        width          : r * 2,
        height         : r * 2,
        borderRadius   : r,
        backgroundColor: col,
        opacity,
        transform      : [{ scale }],
      }}
      pointerEvents="none"
    />
  );
});

// ─── Particle Background ──────────────────────────────────────────────────────
const ParticleBg = memo(function ParticleBg() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient
        colors={['#010610', '#020818', '#030B1E', '#041232', '#020818', '#010610']}
        locations={[0, 0.2, 0.4, 0.6, 0.8, 1]}
        style={StyleSheet.absoluteFill}
      />
      {/* Ambient halos */}
      <View style={{
        position: 'absolute', top: SH * 0.05, left: -SW * 0.3,
        width: SW * 1.6, height: SH * 0.4, borderRadius: SW,
        backgroundColor: 'rgba(255,255,255,0.015)',
      }} />
      <View style={{
        position: 'absolute', bottom: SH * 0.1, right: -SW * 0.2,
        width: SW * 0.9, height: SW * 0.9, borderRadius: SW * 0.45,
        backgroundColor: 'rgba(255,255,255,0.008)',
      }} />
      {PARTICLES.map(({ key, ...p }) => <ParticleDot key={key} {...p} />)}
    </View>
  );
});

// ─── User Card ────────────────────────────────────────────────────────────────
interface UserCardProps {
  user    : AppUser;
  onPress : (u: AppUser) => void;
}

const UserCard = memo(function UserCard({ user, onPress }: UserCardProps) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const onPressIn = () =>
    Animated.spring(scaleAnim, { toValue: 0.97, useNativeDriver: true, speed: 40 }).start();
  const onPressOut = () =>
    Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, speed: 20 }).start();

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }], marginBottom: 14 }}>
      <Pressable
        onPress={() => onPress(user)}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        style={({ pressed }) => [{ opacity: pressed ? 0.92 : 1 }]}
      >
        <BlurView intensity={20} tint="systemUltraThinMaterialDark" style={{ borderRadius: 20, overflow: 'hidden' }}>
          <View style={[cs.card, { borderColor: 'rgba(255,255,255,0.15)' }]}>
            {/* Specular highlight */}
            <LinearGradient
              colors={['rgba(255,255,255,0.12)', 'transparent']}
              style={cs.specular}
            />

            {/* Avatar */}
            <View style={[cs.avatarRing, { borderColor: 'rgba(255,255,255,0.25)', backgroundColor: 'rgba(255,255,255,0.10)' }]}>
              <Image
                source={{ uri: user.avatarUrl }}
                style={cs.avatar}
              />
            </View>

            {/* Info */}
            <View style={cs.info}>
              <Text style={cs.name}>{user.name}</Text>
              <Text style={cs.title}>{user.title}</Text>
              {/* Role badge */}
              <View style={[cs.badge, { backgroundColor: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.25)' }]}>
                <Text style={[cs.badgeTxt, { color: '#FFFFFF' }]}>
                  {user.role === 'organizer' ? 'Organisateur' : 'Staff'}
                </Text>
              </View>
            </View>

            {/* Chevron */}
            <Ionicons name="chevron-forward" size={20} color="#FFFFFF" style={{ opacity: 0.7 }} />
          </View>
        </BlurView>
      </Pressable>
    </Animated.View>
  );
});

const cs = StyleSheet.create({
  card: {
    flexDirection  : 'row',
    alignItems     : 'center',
    gap            : 16,
    padding        : 18,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius   : 20,
    borderWidth    : 1.5,
  },
  specular: {
    position           : 'absolute',
    top                : 0, left: 0, right: 0,
    height             : 40,
    borderTopLeftRadius : 20,
    borderTopRightRadius: 20,
  },
  avatarRing: {
    width       : 64,
    height      : 64,
    borderRadius: 32,
    borderWidth : 2,
    alignItems  : 'center',
    justifyContent: 'center',
  },
  avatar: {
    width       : 60,
    height      : 60,
    borderRadius: 30,
  },
  info : { flex: 1, gap: 4 },
  name : { color: '#FFFFFF', fontSize: 19, fontWeight: '800', letterSpacing: -0.4 },
  title: { color: '#FFFFFF', fontSize: 13, fontWeight: '500' },
  badge: {
    alignSelf      : 'flex-start',
    borderRadius   : 10,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderWidth    : 1,
  },
  badgeTxt: {
    fontSize      : 10,
    fontWeight    : '700',
    textTransform : 'uppercase',
    letterSpacing : 0.5,
  },
});

// ─── PIN numpad ───────────────────────────────────────────────────────────────
const NUMPAD_KEYS = ['1','2','3','4','5','6','7','8','9','del','0',''];

interface PinPadProps {
  selectedUser : AppUser;
  onDigit      : (d: string) => void;
  onDelete     : () => void;
  pin          : string;
  error        : boolean;
  onClose      : () => void;
  sheetAnim    : Animated.Value;
}

const PinPad = memo(function PinPad({
  selectedUser, onDigit, onDelete, pin, error, onClose, sheetAnim,
}: PinPadProps) {
  const insets = useSafeAreaInsets();
  const translateY = sheetAnim.interpolate({ inputRange: [0, 1], outputRange: [700, 0] });

  return (
    <>
      {/* Backdrop */}
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose}>
        <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
      </Pressable>

      {/* Sheet */}
      <Animated.View style={[pp.sheet, { transform: [{ translateY }] }]}>
        <BlurView intensity={60} tint="systemUltraThinMaterialDark" style={{ borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden' }}>
          <View style={[pp.inner, { paddingBottom: insets.bottom + 24 }]}>

            {/* Handle */}
            <View style={pp.handle} />

            {/* User avatar mini */}
            <View style={[pp.miniAvatar, { borderColor: 'rgba(255,255,255,0.25)', backgroundColor: 'rgba(255,255,255,0.10)' }]}>
              <Image source={{ uri: selectedUser.avatarUrl }} style={pp.miniImg} />
            </View>

            {/* Header */}
            <Text style={pp.greeting}>Bonjour {selectedUser.name}</Text>
            <Text style={pp.subtitle}>Entrez votre code PIN</Text>

            {/* 4 PIN dots */}
            <View style={pp.dots}>
              {[0, 1, 2, 3].map(i => (
                <View
                  key={i}
                  style={[
                    pp.dot,
                    {
                      backgroundColor: i < pin.length
                        ? (error ? 'rgba(255,255,255,0.35)' : '#FFFFFF')
                        : 'rgba(255,255,255,0.15)',
                      borderColor: error
                        ? 'rgba(255,255,255,0.35)'
                        : i < pin.length
                          ? 'rgba(255,255,255,0.80)'
                          : 'rgba(255,255,255,0.25)',
                    },
                  ]}
                />
              ))}
            </View>

            {/* Error hint */}
            {error && (
              <Text style={pp.errorTxt}>PIN incorrect</Text>
            )}

            {/* Numpad */}
            <View style={pp.numpad}>
              {NUMPAD_KEYS.map((key, idx) => {
                if (key === '') {
                  return <View key={idx} style={pp.keyEmpty} />;
                }
                if (key === 'del') {
                  return (
                    <TouchableOpacity
                      key={idx}
                      onPress={onDelete}
                      style={pp.keyDel}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="backspace-outline" size={24} color="#FFFFFF" />
                    </TouchableOpacity>
                  );
                }
                return (
                  <TouchableOpacity
                    key={idx}
                    onPress={() => onDigit(key)}
                    style={pp.key}
                    activeOpacity={0.7}
                  >
                    <Text style={pp.keyTxt}>{key}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

          </View>
        </BlurView>
      </Animated.View>
    </>
  );
});

const pp = StyleSheet.create({
  sheet  : { position: 'absolute', bottom: 0, left: 0, right: 0 },
  inner  : {
    backgroundColor    : 'rgba(5,12,35,0.88)',
    borderTopLeftRadius : 28,
    borderTopRightRadius: 28,
    padding            : 28,
    alignItems         : 'center',
  },
  handle  : {
    width: 40, height: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 2,
    marginBottom: 22,
  },
  miniAvatar: {
    width: 62, height: 62, borderRadius: 31,
    borderWidth: 2,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 14,
  },
  miniImg   : { width: 58, height: 58, borderRadius: 29 },
  greeting  : { color: '#FFFFFF', fontSize: 22, fontWeight: '800', textAlign: 'center', marginBottom: 4 },
  subtitle  : { color: '#FFFFFF', fontSize: 14, textAlign: 'center', marginBottom: 28, fontWeight: '400' },
  dots      : { flexDirection: 'row', justifyContent: 'center', gap: 16, marginBottom: 10 },
  dot       : { width: 18, height: 18, borderRadius: 9, borderWidth: 1.5 },
  errorTxt  : { color: 'rgba(255,255,255,0.70)', fontSize: 13, fontWeight: '600', marginBottom: 10 },
  numpad    : { flexDirection: 'row', flexWrap: 'wrap', gap: 14, justifyContent: 'center', marginTop: 16 },
  key       : {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  keyDel    : {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center', justifyContent: 'center',
  },
  keyEmpty  : { width: 80, height: 80 },
  keyTxt    : { color: '#FFFFFF', fontSize: 28, fontWeight: '300' },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function WelcomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { login } = useAuth();

  const [selectedUser, setSelectedUser] = useState<AppUser | null>(null);
  const [pin, setPin]                   = useState('');
  const [error, setError]               = useState(false);
  const sheetAnim                       = useRef(new Animated.Value(0)).current;

  // Header fade-in on mount
  const headerAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(headerAnim, {
      toValue : 1,
      duration: 900,
      delay   : 200,
      useNativeDriver: true,
    }).start();
  }, []);

  const openSheet = useCallback((u: AppUser) => {
    setSelectedUser(u);
    setPin('');
    setError(false);
    Animated.spring(sheetAnim, {
      toValue   : 1,
      useNativeDriver: true,
      damping   : 20,
      stiffness : 200,
    }).start();
  }, [sheetAnim]);

  const closeSheet = useCallback(() => {
    Animated.spring(sheetAnim, { toValue: 0, useNativeDriver: true }).start(() => {
      setSelectedUser(null);
      setPin('');
    });
  }, [sheetAnim]);

  const addDigit = useCallback((d: string) => {
    setPin(prev => {
      if (prev.length >= 4) return prev;
      const next = prev + d;
      if (next.length === 4) {
        // Check PIN after state settles
        setTimeout(() => {
          setPin(cur => {
            if (cur !== next) return cur; // already reset
            return cur;
          });
          if (next === selectedUser?.pin) {
            closeSheet();
            login(selectedUser!).then(() => {
              router.replace(
                selectedUser!.role === 'organizer'
                  ? '/(organizer)/dashboard'
                  : '/(staff)/feed',
              );
            });
          } else {
            setError(true);
            setTimeout(() => { setPin(''); setError(false); }, 700);
          }
        }, 0);
      }
      return next;
    });
  }, [selectedUser, closeSheet, login, router]);

  // We need synchronous access to selectedUser in addDigit — use ref
  const selectedUserRef = useRef<AppUser | null>(null);
  useEffect(() => { selectedUserRef.current = selectedUser; }, [selectedUser]);

  const handleDigit = useCallback((d: string) => {
    setPin(prev => {
      if (prev.length >= 4) return prev;
      const next = prev + d;
      if (next.length === 4) {
        const su = selectedUserRef.current;
        if (next === su?.pin) {
          // Correct PIN
          setTimeout(() => {
            closeSheet();
            login(su!).then(() => {
              router.replace(
                su!.role === 'organizer'
                  ? '/(organizer)/dashboard'
                  : '/(staff)/feed',
              );
            });
          }, 120);
        } else {
          // Wrong PIN
          setTimeout(() => {
            setError(true);
            setTimeout(() => { setPin(''); setError(false); }, 700);
          }, 60);
        }
      }
      return next;
    });
  }, [closeSheet, login, router]);

  const delDigit = useCallback(() => setPin(p => p.slice(0, -1)), []);

  return (
    <View style={{ flex: 1, backgroundColor: '#020818' }}>
      <StatusBar style="light" />

      {/* Animated background */}
      <ParticleBg />

      <ScrollView
        contentContainerStyle={[
          sc.scroll,
          { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 120 },
        ]}
        showsVerticalScrollIndicator={false}
        scrollEnabled={!selectedUser}
      >
        {/* ── Header ── */}
        <Animated.View style={[sc.header, { opacity: headerAnim }]}>
          {/* Logo icon */}
          <View style={sc.logoBox}>
            <LinearGradient
              colors={['rgba(255,255,255,0.12)', 'rgba(255,255,255,0.04)']}
              style={StyleSheet.absoluteFill}
            />
            <Ionicons name="cafe-outline" size={32} color="#FFFFFF" />
          </View>

          <Text style={sc.wordmark}>PUT.IN COFFEE</Text>
          <Text style={sc.location}>Sanur · Bali</Text>

          {/* Indigo separator */}
          <View style={sc.separator} />

          <Text style={sc.choose}>Choisissez votre profil</Text>
        </Animated.View>

        {/* ── User cards ── */}
        <View style={sc.cards}>
          {PUT_IN_COFFEE_USERS.map(u => (
            <UserCard key={u.id} user={u} onPress={openSheet} />
          ))}
        </View>

        {/* Bottom hint */}
        <View style={sc.hintRow}>
          <Ionicons name="lock-closed-outline" size={12} color="rgba(255,255,255,0.35)" />
          <Text style={sc.hint}>Accès sécurisé par code PIN</Text>
        </View>
      </ScrollView>

      {/* ── PIN Sheet (overlay) ── */}
      {selectedUser && (
        <PinPad
          selectedUser={selectedUser}
          onDigit={handleDigit}
          onDelete={delDigit}
          pin={pin}
          error={error}
          onClose={closeSheet}
          sheetAnim={sheetAnim}
        />
      )}
    </View>
  );
}

const sc = StyleSheet.create({
  scroll: {
    paddingHorizontal: 20,
    flexGrow          : 1,
  },
  header: {
    alignItems    : 'center',
    marginBottom  : 36,
    paddingTop    : 12,
  },
  logoBox: {
    width         : 72,
    height        : 72,
    borderRadius  : 22,
    alignItems    : 'center',
    justifyContent: 'center',
    borderWidth   : 1.5,
    borderColor   : 'rgba(255,255,255,0.15)',
    overflow      : 'hidden',
    marginBottom  : 16,
  },
  wordmark: {
    color        : '#FFFFFF',
    fontSize     : 26,
    fontWeight   : '900',
    letterSpacing: 6,
    textTransform: 'uppercase',
    marginBottom : 6,
  },
  location: {
    color        : '#FFFFFF',
    fontSize     : 13,
    fontWeight   : '500',
    letterSpacing: 1.5,
    marginBottom : 20,
  },
  separator: {
    width          : 56,
    height         : 2,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius   : 1,
    marginBottom   : 16,
    opacity        : 0.7,
  },
  choose: {
    color        : '#FFFFFF',
    fontSize     : 15,
    fontWeight   : '600',
    letterSpacing: 0.3,
  },
  cards: {
    gap: 0,
  },
  hintRow: {
    flexDirection : 'row',
    alignItems    : 'center',
    justifyContent: 'center',
    gap           : 6,
    marginTop     : 24,
  },
  hint: {
    color        : 'rgba(255,255,255,0.35)',
    fontSize     : 12,
    fontWeight   : '500',
    letterSpacing: 0.3,
  },
});
