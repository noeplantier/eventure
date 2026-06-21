/**
 * InteractiveBg — Ultra-fine particle field + touch ripples
 * Usage:
 *   const { bgProps, BgLayer } = useInteractiveBg();
 *   <View style={{flex:1}} {...bgProps}>
 *     <BgLayer/>
 *     {children}
 *   </View>
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const { width: W, height: H } = Dimensions.get('window');

const BG   = '#050E1B';
const BLUE = '#1A9FE3';

/* ── Pre-computed ultra-fine particles (deterministic) ─────────────────── */
const N = 65;
const PCOLS = [
  'rgba(26,159,227,0.55)',
  'rgba(26,159,227,0.30)',
  'rgba(26,159,227,0.15)',
  'rgba(255,255,255,0.18)',
  'rgba(255,255,255,0.10)',
  'rgba(26,159,227,0.08)',
  'rgba(255,255,255,0.06)',
];

/* Very fine particles: max 2px, most at 0.5–1.2px */
const PARTICLES = Array.from({ length: N }, (_, i) => {
  const t = i / N;
  return {
    x:   (Math.sin(i * 2.39996) * 0.5 + 0.5) * 100,
    y:   (Math.cos(i * 1.61803) * 0.5 + 0.5) * 100,
    /* Occasional slightly larger accent dots */
    sz:  i % 23 === 0 ? 2.0 : i % 11 === 0 ? 1.4 : i % 5 === 0 ? 1.0 : 0.6,
    col: PCOLS[i % PCOLS.length],
    /* Slow breathe: 4000–8400ms */
    dur: 4000 + (i % 13) * 340,
    del: (i % 17) * 230,
    /* Max opacity: ultra-subtle */
    maxO: i % 23 === 0 ? 0.28 : i % 11 === 0 ? 0.20 : 0.12,
  };
});

/* ── Ripple type ─────────────────────────────────────────────────────────── */
interface Ripple { id: number; x: number; y: number }

/* ── Single ripple ───────────────────────────────────────────────────────── */
function RippleView({ x, y, onDone }: Ripple & { onDone: () => void }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1, duration: 700, useNativeDriver: true,
    }).start(({ finished }) => { if (finished) onDone(); });
  }, []);

  const scale   = anim.interpolate({ inputRange: [0, 1], outputRange: [0, 4.5] });
  const opacity = anim.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 0.22, 0] });

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: x - 30, top: y - 30,
        width: 60, height: 60,
        borderRadius: 30,
        backgroundColor: BLUE,
        opacity,
        transform: [{ scale }],
      }}
    />
  );
}

/* ── Particle layer ──────────────────────────────────────────────────────── */
function ParticleLayer() {
  const anims = useRef(PARTICLES.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    const loops = anims.map((anim, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(PARTICLES[i].del),
          Animated.timing(anim, { toValue: 1, duration: PARTICLES[i].dur / 2, useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0, duration: PARTICLES[i].dur / 2, useNativeDriver: true }),
        ])
      )
    );
    loops.forEach(l => l.start());
    return () => loops.forEach(l => l.stop());
  }, []);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient
        colors={[BG, '#071325', '#050F20', BG]}
        locations={[0, 0.35, 0.65, 1]}
        style={StyleSheet.absoluteFill}
      />
      {/* Subtle central halo */}
      <View style={{
        position: 'absolute',
        top: H * 0.1, left: -W * 0.2, right: -W * 0.2, height: H * 0.45,
        borderRadius: W,
        backgroundColor: 'rgba(26,159,227,0.025)',
      }} />
      {PARTICLES.map((p, i) => {
        const opacity = anims[i].interpolate({
          inputRange: [0, 1],
          outputRange: [0.04, p.maxO],
        });
        const scale = anims[i].interpolate({
          inputRange: [0, 1],
          outputRange: [0.7, 1.3],
        });
        return (
          <Animated.View
            key={i}
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: `${p.x}%` as any,
              top: `${p.y}%` as any,
              width: p.sz, height: p.sz,
              borderRadius: p.sz / 2,
              backgroundColor: p.col,
              opacity,
              transform: [{ scale }],
            }}
          />
        );
      })}
    </View>
  );
}

/* ── Hook ────────────────────────────────────────────────────────────────── */
export function useInteractiveBg() {
  const [ripples, setRipples] = useState<Ripple[]>([]);
  const nextId = useRef(0);

  const addRipple = useCallback((x: number, y: number) => {
    const id = ++nextId.current;
    setRipples(prev => [...prev.slice(-5), { id, x, y }]);
  }, []);

  const removeRipple = useCallback((id: number) => {
    setRipples(prev => prev.filter(r => r.id !== id));
  }, []);

  const bgProps = {
    onTouchStart: (e: any) => {
      const t = e.nativeEvent.touches?.[0] ?? e.nativeEvent;
      addRipple(t.pageX ?? t.locationX ?? 0, t.pageY ?? t.locationY ?? 0);
    },
  };

  const BgLayer = useCallback(() => (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <ParticleLayer />
      {ripples.map(r => (
        <RippleView key={r.id} {...r} onDone={() => removeRipple(r.id)} />
      ))}
    </View>
  ), [ripples, removeRipple]);

  return { bgProps, BgLayer };
}

export default ParticleLayer;
