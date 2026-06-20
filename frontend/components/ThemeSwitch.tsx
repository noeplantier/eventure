/**
 * components/ThemeSwitch.tsx — Eventure v3
 * Bouton soleil/lune pour basculer le thème global.
 * Peut être placé dans le header de n'importe quelle page.
 */
import React, { useRef } from 'react';
import { Animated, TouchableOpacity, StyleSheet } from 'react-native';
import { Sun, Moon } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';

interface Props {
  size?: number;
  style?: any;
}

export default function ThemeSwitch({ size = 20, style }: Props) {
  const { colors, isDark, toggleTheme } = useTheme();
  const rot = useRef(new Animated.Value(isDark ? 1 : 0)).current;

  const handlePress = () => {
    Animated.spring(rot, {
      toValue: isDark ? 0 : 1,
      tension: 80, friction: 8, useNativeDriver: true,
    }).start();
    toggleTheme();
  };

  const spin = rot.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={0.75}
      style={[
        styles.btn,
        {
          backgroundColor: isDark ? colors.primaryGhost : colors.surfaceAlt,
          borderColor: isDark ? colors.primaryBorder : colors.borderLight,
        },
        style,
      ]}
    >
      <Animated.View style={{ transform: [{ rotate: spin }] }}>
        {isDark
          ? <Sun  size={size} color={colors.primary} strokeWidth={2} />
          : <Moon size={size} color={colors.primary} strokeWidth={2} />
        }
      </Animated.View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: 38, height: 38, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1,
  },
});
