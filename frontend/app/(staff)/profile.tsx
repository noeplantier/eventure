// app/(staff)/profile.tsx — Profil staff minimal : identité, rôle, déconnexion.
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';

export default function StaffProfile() {
  const router = useRouter();
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    router.replace('/(staff)/feed' as any);
  };

  return (
    <View style={s.root}>
      <LinearGradient colors={['#0D1A35', '#070C17']} style={StyleSheet.absoluteFill} />
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 110, gap: 20 }}>
          <View style={s.header}>
            <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
              <Ionicons name="chevron-back" size={22} color="#fff" />
            </TouchableOpacity>
            <Text style={s.headerTitle}>Profil</Text>
            <View style={{ width: 36 }} />
          </View>

          <View style={s.identityCard}>
            <Image source={{ uri: user?.avatar_url || 'https://i.pravatar.cc/96' }} style={s.avatar} contentFit="cover" />
            <Text style={s.name}>{user?.display_name || 'Invité'}</Text>
            {!!user?.role && (
              <View style={s.roleBadge}>
                <Text style={s.roleTxt}>{user.role === 'organizer' ? 'Organisateur' : 'Staff'}</Text>
              </View>
            )}
            {!!user?.location && (
              <View style={s.metaRow}>
                <Ionicons name="business-outline" size={13} color="rgba(255,255,255,0.5)" />
                <Text style={s.metaTxt}>{user.location}</Text>
              </View>
            )}
            {!user?.staff_id && (
              <View style={s.warnCard}>
                <Ionicons name="link-outline" size={18} color="#F59E0B" />
                <Text style={s.warnTxt}>Aucun compte staff lié à cet appareil.</Text>
              </View>
            )}
          </View>

          <TouchableOpacity style={s.row} onPress={() => router.push('/(shared)/settings' as any)}>
            <Ionicons name="settings-outline" size={20} color="rgba(255,255,255,0.7)" />
            <Text style={s.rowTxt}>Réglages</Text>
            <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.3)" />
          </TouchableOpacity>

          <TouchableOpacity style={s.row} onPress={() => router.push('/(shared)/notifications' as any)}>
            <Ionicons name="notifications-outline" size={20} color="rgba(255,255,255,0.7)" />
            <Text style={s.rowTxt}>Notifications</Text>
            <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.3)" />
          </TouchableOpacity>

          <TouchableOpacity style={s.logoutBtn} onPress={handleLogout} activeOpacity={0.85}>
            <Ionicons name="log-out-outline" size={22} color="#EF4444" />
            <Text style={s.logoutTxt}>Se déconnecter</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.06)' },
  headerTitle: { color: '#fff', fontSize: 17, fontWeight: '800' },
  identityCard: { alignItems: 'center', gap: 8, paddingVertical: 24 },
  avatar: { width: 84, height: 84, borderRadius: 42, borderWidth: 2, borderColor: 'rgba(167,139,250,0.5)' },
  name: { color: '#fff', fontSize: 20, fontWeight: '900', marginTop: 6 },
  roleBadge: { backgroundColor: 'rgba(167,139,250,0.16)', borderWidth: 1, borderColor: 'rgba(167,139,250,0.35)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4 },
  roleTxt: { color: '#A78BFA', fontSize: 12, fontWeight: '700' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  metaTxt: { color: 'rgba(255,255,255,0.5)', fontSize: 13 },
  warnCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(245,158,11,0.10)', borderWidth: 1, borderColor: 'rgba(245,158,11,0.30)', borderRadius: 14, padding: 12, marginTop: 12 },
  warnTxt: { color: '#F59E0B', fontSize: 12, fontWeight: '600', flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', padding: 16 },
  rowTxt: { color: '#fff', fontSize: 14, fontWeight: '600', flex: 1 },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, minHeight: 56, borderRadius: 14, borderWidth: 1.5, borderColor: 'rgba(239,68,68,0.4)', backgroundColor: 'rgba(239,68,68,0.10)', marginTop: 8 },
  logoutTxt: { color: '#EF4444', fontSize: 16, fontWeight: '800' },
});
