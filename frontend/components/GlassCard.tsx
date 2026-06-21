/**
 * GlassCard — Apple Liquid Glass material for React Native
 * Usage: <GlassCard style={...}>{children}</GlassCard>
 */
import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';

interface GlassCardProps {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  radius?: number;
  intensity?: number;
  /** 'blue' = blue-tinted glass, 'white' = neutral, 'gold' = warm tint */
  tint?: 'blue' | 'white' | 'gold';
  border?: boolean;
}

const TINT_COLORS: Record<string, [string, string, string]> = {
  blue:  ['rgba(26,159,227,0.18)', 'rgba(26,159,227,0.06)', 'rgba(26,159,227,0.02)'],
  white: ['rgba(255,255,255,0.14)', 'rgba(255,255,255,0.05)', 'rgba(255,255,255,0.01)'],
  gold:  ['rgba(255,255,255,0.10)',  'rgba(255,255,255,0.04)',  'rgba(245,200,66,0.01)'],
};

const BORDER_COLORS: Record<string, string> = {
  blue:  'rgba(26,159,227,0.28)',
  white: 'rgba(255,255,255,0.18)',
  gold:  'rgba(255,255,255,0.16)',
};

export default function GlassCard({
  children, style, radius = 20, intensity = 50, tint = 'blue', border = true,
}: GlassCardProps) {
  const colors = TINT_COLORS[tint];
  const borderColor = BORDER_COLORS[tint];

  return (
    <View style={[{ borderRadius: radius, overflow: 'hidden' }, style]}>
      {/* Dark base */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(5,14,27,0.72)', borderRadius: radius }]} />
      {/* Blur layer */}
      <BlurView intensity={intensity} tint="dark" style={[StyleSheet.absoluteFill, { borderRadius: radius }]} />
      {/* Color tint gradient */}
      <LinearGradient
        colors={colors}
        locations={[0, 0.5, 1]}
        style={[StyleSheet.absoluteFill, { borderRadius: radius }]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.4, y: 1 }}
      />
      {/* Top sheen */}
      <View style={{
        position: 'absolute', top: 0, left: radius * 0.5, right: radius * 0.5,
        height: 1, backgroundColor: 'rgba(255,255,255,0.32)', borderRadius: 1,
      }} />
      {/* Border overlay */}
      {border && (
        <View style={[StyleSheet.absoluteFill, {
          borderRadius: radius,
          borderWidth: 1,
          borderColor,
        }]} />
      )}
      {/* Content */}
      {children}
    </View>
  );
}
