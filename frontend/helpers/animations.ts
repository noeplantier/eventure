import { Animated, Easing } from 'react-native';

export const triggerHapticFeedback = async () => {
  try {
    const Haptics = await import('expo-haptics');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch {}
};

export const createScaleAnimation = (value: Animated.Value, toValue: number = 1, duration: number = 200) => {
  Animated.spring(value, {
    toValue,
    tension: 80,
    friction: 10,
    useNativeDriver: true,
  }).start();
};

export const createFadeInAnimation = (value: Animated.Value, duration: number = 300) => {
  value.setValue(0);
  Animated.timing(value, {
    toValue: 1,
    duration,
    easing: Easing.out(Easing.cubic),
    useNativeDriver: true,
  }).start();
};

export const pulseAnimation = (value: Animated.Value) => {
  Animated.loop(
    Animated.sequence([
      Animated.timing(value, { toValue: 1.05, duration: 600, useNativeDriver: true }),
      Animated.timing(value, { toValue: 1, duration: 600, useNativeDriver: true }),
    ])
  ).start();
};