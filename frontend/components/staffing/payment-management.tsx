/**
 * Payment Management
 * - Suivi des paiements staff
 * - Bulk payment
 * - Stripe integration
 * - Factures
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  Dimensions, FlatList, RefreshControl, ScrollView,
  StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { COLORS, SPACING } from '@/constants/theme';

const BG = COLORS.background;
const GREEN = COLORS.primary;
const T = {
  white: '#FFFFFF',
  muted: 'rgba(255,255,255,0.50)',
  navy: '#0A2218',
  success: COLORS.success,
  warning: COLORS.amber,
  error: COLORS.red,
};

interface PaymentItem {
  id: string;
  staff_name: string;
  amount_due: number;
  amount_paid: number;
  status: 'pending' | 'partial' | 'paid';
  mission_title: string;
}

export default function PaymentManagementScreen() {
  const [payments, setPayments] = useState<PaymentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data } = await supabase
        .from('missions')
        .select('id, staff_id, amount_due, amount_paid, payment_status')
        .eq('organizer_id', session.user.id);

      // Process payments
      if (data) {
        setPayments(
          (data as any[]).map(m => ({
            id: m.id,
            staff_name: 'Staff',
            amount_due: m.amount_due || 0,
            amount_paid: m.amount_paid || 0,
            status: m.payment_status || 'pending',
            mission_title: 'Mission',
          }))
        );
      }
    } catch (e) {
      console.error('[payments]', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, []);

  const totalDue = payments.reduce((s, p) => s + p.amount_due, 0);
  const totalPaid = payments.reduce((s, p) => s + p.amount_paid, 0);
  const pending = payments.filter(p => p.status === 'pending').length;

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 100 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => {
              setRefreshing(true);
              load();
            }} tintColor={GREEN} />
          }
        >
          {/* KPIs */}
          <View style={{ paddingHorizontal: SPACING.screenEdge, paddingVertical: 16, gap: 12 }}>
            <Text style={{ color: T.white, fontSize: 24, fontWeight: '900' }}>Paiements</Text>

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{
                flex: 1,
                padding: 14,
                borderRadius: 14,
                backgroundColor: T.navy,
                borderWidth: 1,
                borderColor: 'rgba(0,217,126,0.15)',
              }}>
                <Text style={{ color: T.muted, fontSize: 11, marginBottom: 6 }}>Dû</Text>
                <Text style={{ color: T.white, fontSize: 18, fontWeight: '900' }}>
                  {totalDue.toLocaleString('fr-FR')}€
                </Text>
              </View>

              <View style={{
                flex: 1,
                padding: 14,
                borderRadius: 14,
                backgroundColor: T.navy,
                borderWidth: 1,
                borderColor: `${GREEN}20`,
              }}>
                <Text style={{ color: T.muted, fontSize: 11, marginBottom: 6 }}>Payé</Text>
                <Text style={{ color: GREEN, fontSize: 18, fontWeight: '900' }}>
                  {totalPaid.toLocaleString('fr-FR')}€
                </Text>
              </View>
            </View>

            {pending > 0 && (
              <TouchableOpacity style={{
                padding: 14,
                borderRadius: 14,
                backgroundColor: `${T.warning}15`,
                borderWidth: 1,
                borderColor: `${T.warning}30`,
              }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Ionicons name="warning-outline" size={20} color={T.warning} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: T.warning, fontSize: 13, fontWeight: '900' }}>
                      {pending} paiement{pending > 1 ? 's' : ''} en attente
                    </Text>
                    <Text style={{ color: T.muted, fontSize: 11 }}>
                      Effectuez les paiements pour garder votre staff motivé
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={T.warning} />
                </View>
              </TouchableOpacity>
            )}
          </View>

          {/* Payment List */}
          <View style={{ paddingHorizontal: SPACING.screenEdge }}>
            {payments.map(p => (
              <View
                key={p.id}
                style={{
                  padding: 14,
                  borderRadius: 12,
                  backgroundColor: T.navy,
                  marginBottom: 10,
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.08)',
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ color: T.white, fontSize: 13, fontWeight: '900' }}>
                    {p.staff_name}
                  </Text>
                  <Text style={{ color: T.muted, fontSize: 11, marginTop: 2 }}>
                    {p.mission_title}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ color: T.white, fontSize: 14, fontWeight: '900' }}>
                    {p.amount_due}€
                  </Text>
                  <View style={{
                    paddingHorizontal: 6,
                    paddingVertical: 2,
                    borderRadius: 6,
                    backgroundColor: p.status === 'paid' ? `${GREEN}20` : `${T.warning}20`,
                    marginTop: 4,
                  }}>
                    <Text
                      style={{
                        fontSize: 9,
                        fontWeight: '700',
                        color: p.status === 'paid' ? GREEN : T.warning,
                      }}
                    >
                      {p.status === 'paid' ? 'Payé' : p.status === 'partial' ? 'Partiel' : 'En attente'}
                    </Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}