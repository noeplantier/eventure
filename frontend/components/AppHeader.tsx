import React, { memo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

interface AppHeaderProps {
  title       : string;
  subtitle?   : string;
  showBack?   : boolean;
  notifCount? : number;
  onBell?     : () => void;
  rightNode?  : React.ReactNode;
  transparent?: boolean;
}

export default memo(function AppHeader({
  title, subtitle, showBack = false, notifCount = 0, onBell, rightNode, transparent = false,
}: AppHeaderProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <BlurView intensity={40} tint="systemUltraThinMaterialDark" style={{ overflow: 'hidden' }}>
      <View style={{
        backgroundColor: transparent ? 'transparent' : 'rgba(2,8,24,0.85)',
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: 'rgba(255,255,255,0.08)',
        paddingTop: insets.top + 10,
        paddingBottom: 14,
        paddingHorizontal: 20,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
      }}>
        {/* Back button */}
        {showBack && (
          <TouchableOpacity
            onPress={() => router.back()}
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: 'rgba(255,255,255,0.08)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="arrow-back" size={18} color="#FFFFFF" />
          </TouchableOpacity>
        )}

        {/* Title block */}
        <View style={{ flex: 1 }}>
          <Text
            style={{ color: '#FFFFFF', fontSize: 20, fontWeight: '800', letterSpacing: -0.5 }}
            numberOfLines={1}
          >
            {title}
          </Text>
          {subtitle ? (
            <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 12, fontWeight: '500', marginTop: 1 }}>
              {subtitle}
            </Text>
          ) : null}
        </View>

        {/* Right: custom node OR bell */}
        {rightNode ?? (onBell ? (
          <TouchableOpacity
            onPress={onBell}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: 'rgba(255,255,255,0.08)',
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: 'rgba(255,255,255,0.12)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="notifications-outline" size={20} color="#FFFFFF" />
            {notifCount > 0 && (
              <View style={{
                position: 'absolute',
                top: 6,
                right: 6,
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: '#FFFFFF',
                borderWidth: 1.5,
                borderColor: '#020818',
              }} />
            )}
          </TouchableOpacity>
        ) : null)}
      </View>
    </BlurView>
  );
});
