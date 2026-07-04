/**
 * components/CenteredModal.tsx
 * Modal centrée à l'écran (pas un bottom-sheet) avec fond flouté —
 * remplace le pattern "slide from bottom" utilisé jusqu'ici dans l'app.
 */
import React, { useEffect, useRef } from 'react';
import { Animated, Platform, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Modal } from 'react-native';
import { BlurView } from 'expo-blur';
import { AURA } from '@/constants/aura-theme';

const C = { border: AURA.border, surface: AURA.surface };

interface CenteredModalProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  maxWidth?: number;
}

export default function CenteredModal({ visible, onClose, children, maxWidth = 420 }: CenteredModalProps) {
  const scale = useRef(new Animated.Value(0.92)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = React.useState(visible);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.parallel([
        Animated.spring(scale, { toValue: 1, tension: 140, friction: 14, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(scale, { toValue: 0.92, duration: 160, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration: 160, useNativeDriver: true }),
      ]).start(({ finished }) => { if (finished) setMounted(false); });
    }
  }, [visible]);

  if (!mounted) return null;

  return (
    <Modal transparent visible animationType="none" onRequestClose={onClose}>
      <View style={StyleSheet.absoluteFill}>
        <Animated.View style={[StyleSheet.absoluteFill, { opacity }]}>
          <BlurView intensity={Platform.OS === 'ios' ? 40 : 60} tint="dark" style={StyleSheet.absoluteFill}/>
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(5,6,9,0.55)' }]}/>
        </Animated.View>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose}/>
        <View style={styles.center} pointerEvents="box-none">
          <Animated.View
            style={[
              styles.card,
              { maxWidth, opacity, transform: [{ scale }] },
            ]}
          >
            {children}
          </Animated.View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: {
    width: '100%', backgroundColor: C.surface, borderRadius: 24, padding: 20,
    borderWidth: 1, borderColor: C.border,
    shadowColor: AURA.primaryGlow, shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.35, shadowRadius: 34, elevation: 12,
  },
});
