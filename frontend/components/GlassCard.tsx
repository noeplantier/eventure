/**
 * GlassCard — Apple iOS 26 "Liquid Glass" material for React Native
 * Usage: <GlassCard style={...}>{children}</GlassCard>
 *        <GlassPad style={...}>{children}</GlassPad>  ← with 18px built-in padding
 */
import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';

interface GlassCardProps {
  children    : React.ReactNode;
  style?      : ViewStyle | ViewStyle[];
  intensity?  : number;   // blur intensity, default 18
  radius?     : number;   // border radius, default 22
  specular?   : boolean;  // show top specular highlight, default true
  tint?       : 'dark' | 'light' | 'default' | 'systemUltraThinMaterialDark' | 'systemChromeMaterialDark';
  accentColor?: string;   // border color, default undefined (white glass)
  padding?    : number;   // inner padding, default 0 (let consumer handle it)
}

export default function GlassCard({
  children,
  style,
  intensity   = 18,
  radius      = 22,
  specular    = true,
  tint        = 'systemUltraThinMaterialDark',
  accentColor,
  padding     = 0,
}: GlassCardProps) {
  return (
    <BlurView
      intensity={intensity}
      tint={tint}
      style={[{ borderRadius: radius, overflow: 'hidden' }, style]}
    >
      <View
        style={{
          backgroundColor : 'rgba(255,255,255,0.06)',
          borderRadius    : radius,
          borderWidth     : StyleSheet.hairlineWidth,
          borderColor     : accentColor ? accentColor + '70' : 'rgba(255,255,255,0.10)',
          padding         : padding,
          overflow        : 'hidden',
        }}
      >
        {specular && (
          <LinearGradient
            colors={['rgba(255,255,255,0.10)', 'rgba(255,255,255,0.02)', 'transparent']}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={{
              position          : 'absolute',
              top               : 0,
              left              : 0,
              right             : 0,
              height            : 56,
              borderTopLeftRadius : radius,
              borderTopRightRadius: radius,
            }}
          />
        )}
        {children}
      </View>
    </BlurView>
  );
}

// Convenience variant with built-in padding
export function GlassPad({ children, style, ...props }: GlassCardProps) {
  return (
    <GlassCard padding={18} style={style} {...props}>
      {children}
    </GlassCard>
  );
}
