import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
import { AppUser, AUTH_STORAGE_KEY } from '@/lib/putInCoffeeUsers';

// ── helpers ───────────────────────────────────────────────────────────────────

function calcDurationHours(start: string, end: string): number {
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  if (isNaN(s) || isNaN(e) || e <= s) return 0;
  return (e - s) / 3_600_000;
}

function fmtCurrency(n: number): string {
  return n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}

function monthLabel(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
}

// ── types ────────────────────────────────────────────────────────────────────

interface Mission {
  id: string;
  date_start: string;
  date_end: string;
  role: string;
  status: string;
  hourly_rate: number | null;
  events: { title: string } | null;
}

interface MissionWithEarnings extends Mission {
  hours: number;
  earned: number;
}

// ── component ─────────────────────────────────────────────────────────────────

export default function Earnings() {
  const insets = useSafeAreaInsets();

  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [missions, setMissions] = useState<MissionWithEarnings[]>([]);
  const [payrollData, setPayrollData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // ── load user ─────────────────────────────────────────────────────────────
  useEffect(() => {
    AsyncStorage.getItem(AUTH_STORAGE_KEY).then(raw => {
      if (raw) setCurrentUser(JSON.parse(raw));
    });
  }, []);

  // ── fetch missions ────────────────────────────────────────────────────────
  const fetchMissions = useCallback(async () => {
    if (!currentUser?.staffId) return;
    setLoading(true);
    const { data } = await supabase
      .from('missions')
      .select('id, date_start, date_end, role, status, hourly_rate, events(title)')
      .eq('staff_id', currentUser.staffId)
      .order('date_start', { ascending: false });

    if (data) {
      const enriched: MissionWithEarnings[] = data.map((m: any) => {
        const hours = calcDurationHours(m.date_start, m.date_end);
        const earned = hours * (m.hourly_rate ?? 0);
        return { ...m, hours, earned };
      });
      setMissions(enriched);
    }

    const { data: payroll } = await supabase
      .from('payroll')
      .select('*')
      .eq('staff_id', currentUser.staffId)
      .order('week_start', { ascending: false });
    if (payroll) setPayrollData(payroll);

    setLoading(false);
  }, [currentUser]);

  useEffect(() => {
    if (currentUser?.staffId) fetchMissions();
  }, [currentUser, fetchMissions]);

  // ── aggregate stats ───────────────────────────────────────────────────────
  const totalHours = missions.reduce((a, m) => a + m.hours, 0);
  const totalEarned = missions.reduce((a, m) => a + m.earned, 0);
  const completedCount = missions.filter(m => m.status === 'confirmed').length;
  const pendingCount = missions.filter(m => m.status === 'pending').length;

  // ── group by month ────────────────────────────────────────────────────────
  const grouped: Record<string, MissionWithEarnings[]> = {};
  missions.forEach(m => {
    const key = monthLabel(m.date_start);
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(m);
  });

  // ── status color ─────────────────────────────────────────────────────────
  function statusColor(status: string) {
    if (status === 'confirmed') return '#FFFFFF';
    return 'rgba(255,255,255,0.55)';
  }
  function statusLabel(status: string) {
    if (status === 'confirmed') return 'Confirmé';
    return 'En attente';
  }

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <View style={s.root}>
      <StatusBar style="light" />

      <LinearGradient
        colors={['#010610', '#020818', '#030B1E', '#041232', '#020818', '#010610']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      <ScrollView
        style={s.scroll}
        contentContainerStyle={[s.scrollContent, { paddingTop: insets.top + 16 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── HEADER ── */}
        <View style={s.header}>
          <Text style={s.headerTitle}>Mes Gains</Text>
          <Text style={s.headerSub}>{currentUser?.name ?? 'Staff'} · Put.in Coffee</Text>
        </View>

        {/* ── MA PAIE — PAYROLL CARD ── */}
        {payrollData[0] && (
          <BlurView intensity={18} tint="systemUltraThinMaterialDark" style={[s.glassCard, { padding: 20, marginBottom: 4 }]}>
            <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '700', marginBottom: 12, letterSpacing: 0.5 }}>MA PAIE · CETTE SEMAINE</Text>
            <Text style={{ color: '#FFFFFF', fontSize: 36, fontWeight: '900', letterSpacing: -1 }}>{payrollData[0].gross_total}€</Text>
            <Text style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13, marginTop: 4 }}>{payrollData[0].hours_worked}h · {payrollData[0].hourly_rate}€/h</Text>
            <View style={{ marginTop: 14, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6, alignSelf: 'flex-start', borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)' }}>
              <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '700' }}>
                {payrollData[0].status === 'paid' ? 'Payé' : payrollData[0].status === 'approved' ? 'Approuvé par Arik' : "En attente d'approbation"}
              </Text>
            </View>
          </BlurView>
        )}

        {/* ── TOTAL SUMMARY CARD ── */}
        <BlurView intensity={18} tint="dark" style={[s.glassCard, s.summaryCard]}>
          <LinearGradient
            colors={['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.02)']}
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
          <View style={s.summaryTop}>
            <View style={s.summaryIconWrap}>
              <Ionicons name="wallet-outline" size={24} color="#FFFFFF" />
            </View>
            <Text style={s.summaryLabel}>Total gagné</Text>
          </View>
          <Text style={s.summaryAmount}>{fmtCurrency(totalEarned)}</Text>
          <Text style={s.summaryHours}>{totalHours.toFixed(1)} heures de travail</Text>
        </BlurView>

        {/* ── STATS ROW ── */}
        <View style={s.statsRow}>
          <BlurView intensity={18} tint="dark" style={[s.glassCard, s.statCard]}>
            <Ionicons name="briefcase-outline" size={18} color="#FFFFFF" />
            <Text style={s.statNum}>{missions.length}</Text>
            <Text style={s.statLbl}>Mission{missions.length > 1 ? 's' : ''}</Text>
          </BlurView>
          <BlurView intensity={18} tint="dark" style={[s.glassCard, s.statCard]}>
            <Ionicons name="checkmark-circle-outline" size={18} color="#FFFFFF" />
            <Text style={s.statNum}>{completedCount}</Text>
            <Text style={s.statLbl}>Confirmée{completedCount > 1 ? 's' : ''}</Text>
          </BlurView>
          <BlurView intensity={18} tint="dark" style={[s.glassCard, s.statCard]}>
            <Ionicons name="time-outline" size={18} color="rgba(255,255,255,0.55)" />
            <Text style={s.statNum}>{pendingCount}</Text>
            <Text style={s.statLbl}>En attente</Text>
          </BlurView>
        </View>

        {/* ── MISSION LIST BY MONTH ── */}
        {loading ? (
          <ActivityIndicator color="#FFFFFF" style={{ marginTop: 32 }} />
        ) : missions.length === 0 ? (
          <BlurView intensity={18} tint="dark" style={[s.glassCard, s.emptyCard]}>
            <Ionicons name="cash-outline" size={40} color="rgba(255,255,255,0.20)" />
            <Text style={s.emptyTxt}>Aucune mission enregistrée</Text>
            <Text style={s.emptySubTxt}>Tes gains apparaîtront ici</Text>
          </BlurView>
        ) : (
          Object.entries(grouped).map(([month, items]) => {
            const monthTotal = items.reduce((a, m) => a + m.earned, 0);
            const monthHours = items.reduce((a, m) => a + m.hours, 0);
            return (
              <View key={month} style={s.monthSection}>
                {/* month header */}
                <View style={s.monthHeader}>
                  <Text style={s.monthTitle}>{month}</Text>
                  <View style={s.monthRight}>
                    <Text style={s.monthHours}>{monthHours.toFixed(1)} h</Text>
                    <Text style={s.monthTotal}>{fmtCurrency(monthTotal)}</Text>
                  </View>
                </View>

                {/* mission rows */}
                {items.map(m => (
                  <BlurView key={m.id} intensity={18} tint="dark" style={[s.glassCard, s.missionCard]}>
                    <View style={s.missionTop}>
                      <Text style={s.missionTitle} numberOfLines={1}>{m.events?.title ?? 'Mission'}</Text>
                      <Text style={s.missionEarned}>{fmtCurrency(m.earned)}</Text>
                    </View>
                    <View style={s.missionMeta}>
                      <Ionicons name="calendar-outline" size={12} color="rgba(255,255,255,0.45)" />
                      <Text style={s.missionMetaTxt}>{fmtDate(m.date_start)}</Text>
                      <Ionicons name="time-outline" size={12} color="rgba(255,255,255,0.45)" />
                      <Text style={s.missionMetaTxt}>{m.hours.toFixed(1)} h</Text>
                      {m.hourly_rate && (
                        <>
                          <Ionicons name="cash-outline" size={12} color="rgba(255,255,255,0.45)" />
                          <Text style={s.missionMetaTxt}>{m.hourly_rate} €/h</Text>
                        </>
                      )}
                    </View>
                    <View style={s.missionBottom}>
                      <Text style={s.missionRole}>{m.role ?? currentUser?.title}</Text>
                      <View style={[s.statusBadge, { backgroundColor: `${statusColor(m.status)}1A`, borderColor: statusColor(m.status) }]}>
                        <Text style={[s.statusTxt, { color: statusColor(m.status) }]}>{statusLabel(m.status)}</Text>
                      </View>
                    </View>
                  </BlurView>
                ))}
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

// ── styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#020818',
  },
  scroll: {
    flex: 1,
    backgroundColor: '#020818',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 120,
    gap: 12,
  },

  header: {
    marginBottom: 4,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  headerSub: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '500',
    opacity: 0.55,
    marginTop: 2,
  },

  glassCard: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.12)',
  },

  // summary
  summaryCard: {
    padding: 24,
    gap: 8,
    alignItems: 'flex-start',
  },
  summaryTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  summaryIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.20)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryLabel: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    opacity: 0.7,
  },
  summaryAmount: {
    color: '#FFFFFF',
    fontSize: 38,
    fontWeight: '900',
    letterSpacing: -1,
  },
  summaryHours: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '500',
    opacity: 0.50,
  },

  // stats row
  statsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 8,
    gap: 4,
  },
  statNum: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
  },
  statLbl: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
    opacity: 0.55,
    textAlign: 'center',
  },

  // month section
  monthSection: {
    gap: 8,
  },
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  monthTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  monthRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  monthHours: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '500',
    opacity: 0.50,
  },
  monthTotal: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },

  // mission card
  missionCard: {
    padding: 14,
    gap: 8,
  },
  missionTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  missionTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    flex: 1,
    letterSpacing: -0.2,
  },
  missionEarned: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
  },
  missionMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  missionMetaTxt: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '500',
    opacity: 0.65,
  },
  missionBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  missionRole: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    opacity: 0.55,
    textTransform: 'capitalize',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
  },
  statusTxt: {
    fontSize: 11,
    fontWeight: '800',
  },

  // empty state
  emptyCard: {
    alignItems: 'center',
    gap: 10,
    paddingVertical: 40,
    padding: 24,
  },
  emptyTxt: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  emptySubTxt: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '400',
    opacity: 0.45,
  },
});
