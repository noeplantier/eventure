/**
 * components/Aura.tsx
 * Halo interactif "amovible" : au tap (ou survol sur web), un glow coloré
 * s'illumine derrière l'élément puis s'estompe automatiquement au relâchement.
 * Native-driven (opacity + scale) pour rester fluide sur toutes plateformes.
 */
import React, { useRef } from 'react';
import { Animated, GestureResponderEvent, Pressable, StyleSheet, ViewStyle } from 'react-native';
import { AURA } from '@/constants/aura-theme';

interface AuraProps {
  color?: string;
  radius?: number;
  bleed?: number;
  onPress?: (e: GestureResponderEvent) => void;
  onPressIn?: (e: GestureResponderEvent) => void;
  onPressOut?: (e: GestureResponderEvent) => void;
  disabled?: boolean;
  style?: ViewStyle | ViewStyle[];
  children: React.ReactNode;
}

export default function Aura({
  color = AURA.primaryGlow, radius = 20, bleed = 10,
  onPress, onPressIn, onPressOut, disabled, style, children,
}: AuraProps) {
  const glow = useRef(new Animated.Value(0)).current;

  const glowIn  = () => Animated.timing(glow, { toValue: 1, duration: 180, useNativeDriver: true }).start();
  const glowOut = () => Animated.timing(glow, { toValue: 0, duration: 500, useNativeDriver: true }).start();
  const handlePressIn  = (e: GestureResponderEvent) => { glowIn(); onPressIn?.(e); };
  const handlePressOut = (e: GestureResponderEvent) => { glowOut(); onPressOut?.(e); };

  return (
    <Pressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onHoverIn={glowIn}
      onHoverOut={glowOut}
      onPress={onPress}
      disabled={disabled}
      style={style}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFillObject,
          {
            margin: -bleed,
            borderRadius: radius + bleed,
            backgroundColor: color,
            opacity: glow.interpolate({ inputRange: [0, 1], outputRange: [0, 1] }),
            transform: [{ scale: glow.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.05] }) }],
          },
        ]}
      />
      {children}
    </Pressable>
  );
}
