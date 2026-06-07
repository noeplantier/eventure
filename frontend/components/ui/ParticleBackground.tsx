import React, { memo, useEffect, useRef, useState } from 'react';
import { View, Animated, StyleSheet, Dimensions, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const { width: W, height: H } = Dimensions.get('window');

// Particule flottante
interface Particle {
  id:    number;
  x:     number;
  y:     number;
  size:  number;
  color: string;
  speed: number;
  delay: number;
}

const PARTICLE_COLORS = [
  '#00D97E',              // vert néon
  'rgba(0,217,126,0.60)', // vert translucide
  '#F5C842',              // or
  'rgba(245,200,66,0.50)',// or translucide
  'rgba(255,255,255,0.30)',// blanc subtil
];

const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

// Génère 35 particules fixes
const PARTICLES: Particle[] = Array.from({ length: 35 }, (_, i) => ({
  id:    i,
  x:     rnd(0, W),
  y:     rnd(0, H),
  size:  rnd(1.5, 4.5),
  color: pick(PARTICLE_COLORS),
  speed: rnd(3000, 8000),
  delay: rnd(0, 4000),
}));

// Particule individuelle animée
const FloatingParticle = memo(function FloatingParticle({ p }: { p: Particle }) {
  const opacity = useRef(new Animated.Value(0.1)).current;
  const translateY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.delay(p.delay),
        Animated.parallel([
          Animated.sequence([
            Animated.timing(opacity, { toValue: 1,   duration: p.speed * 0.4, useNativeDriver: true }),
            Animated.timing(opacity, { toValue: 0.1, duration: p.speed * 0.6, useNativeDriver: true }),
          ]),
          Animated.sequence([
            Animated.timing(translateY, { toValue: -rnd(20, 60), duration: p.speed, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
            Animated.timing(translateY, { toValue: 0,            duration: p.speed, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          ]),
        ]),
      ])
    ).start();
  }, []);

  // Halo lumineux pour les grosses particules
  const isGlowing = p.size > 3;

  return (
    <Animated.View style={{
      position:  'absolute',
      left:       p.x,
      top:        p.y,
      opacity,
      transform: [{ translateY }],
    }}>
      {isGlowing && (
        <View style={{
          position:        'absolute',
          width:            p.size * 6,
          height:           p.size * 6,
          borderRadius:     p.size * 3,
          backgroundColor: p.color,
          opacity:          0.15,
          top:             -p.size * 2.5,
          left:            -p.size * 2.5,
        }}/>
      )}
      <View style={{
        width:           p.size,
        height:          p.size,
        borderRadius:    p.size / 2,
        backgroundColor: p.color,
      }}/>
    </Animated.View>
  );
});

// Lignes de grille futuristes (optionnel)
const GridLines = memo(function GridLines() {
  const lines = Array.from({ length: 6 }, (_, i) => i);
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {lines.map(i => (
        <View key={`h${i}`} style={{
          position:        'absolute',
          top:              (H / 6) * i,
          left:             0, right: 0,
          height:           StyleSheet.hairlineWidth,
          backgroundColor: 'rgba(0,217,126,0.04)',
        }}/>
      ))}
      {lines.map(i => (
        <View key={`v${i}`} style={{
          position:        'absolute',
          left:             (W / 6) * i,
          top:              0, bottom: 0,
          width:            StyleSheet.hairlineWidth,
          backgroundColor: 'rgba(0,217,126,0.04)',
        }}/>
      ))}
    </View>
  );
});

// Composant principal
export default memo(function ParticleBackground() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* Fond dégradé profond */}
      <LinearGradient
        colors={['#020A06', '#051A0E', '#020A06']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      {/* Halo vert central */}
      <View style={{
        position:        'absolute',
        top:              H * 0.1,
        left:             W * 0.2,
        width:            W * 0.6,
        height:           W * 0.6,
        borderRadius:     W * 0.3,
        backgroundColor: 'rgba(0,217,126,0.06)',
      }}/>

      {/* Halo or bas droite */}
      <View style={{
        position:        'absolute',
        bottom:           H * 0.1,
        right:           -W * 0.2,
        width:            W * 0.7,
        height:           W * 0.7,
        borderRadius:     W * 0.35,
        backgroundColor: 'rgba(245,200,66,0.04)',
      }}/>

      {/* Grille */}
      <GridLines/>

      {/* Particules */}
      {PARTICLES.map(p => <FloatingParticle key={p.id} p={p}/>)}
    </View>
  );
});
