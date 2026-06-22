/**
 * payroll.tsx — Payroll management for Arik (Put.in Coffee, Sanur Bali)
 * Shows weekly earnings for Oka and Redo. Approve and mark as paid.
 * Sends WhatsApp notification when paid.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { BlurView }          from 'expo-blur';
import { LinearGradient }    from 'expo-linear-gradient';
import { Ionicons }          from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar }         from 'expo-status-bar';
import { useRouter }         from 'expo-router';
import { supabase }          from '@/lib/supabase';
import { sendWhatsApp }      from '@/lib/whatsapp';
import AppHeader             from '@/components/AppHeader';

/* ── Design tokens ──────────────────────────────────────────────────────────── */
const BG     = '#020818';
const NAVY   = '#030B1E';
const WHITE  = '#FFFFFF';
const GLASS  = 'rgba(255,255,255,0.06)';
const BORDER = 'rgba(255,255,255,0.10)';
const DIM    = 'rgba(255,255,255,0.35)';

/* ── Types ──────────────────────────────────────────────────────────────────── */
interface StaffMember {
  id              : string;
  display_name    : string;
  phone_whatsapp? : string | null;
  hourly_rate?    : number | null;
}

interface PayrollRow {
  id          : string;
  staff_id    : string;
  week_start  : string;
  week_end    : string;
  hours_worked: number;
  hourly_rate : number;
  gross_total : number;
  status      : 'pending' | 'approved' | 'paid';
  notes?      : string | null;
  paid_at?    : string | null;
}

interface Mission {
  id          : string;
  staff_id    : string;
  role_name   : string;
  date_start  : string;
  hours_worked: number;
  amount_due  : number;
  status      : boolean;
}

/* ── Helpers ────────────────────────────────────────────────────────────────── */
const isoDate = (d: Date) => d.toISOString().split('T')[0];

const fmtDate = (d: Date) =>
  d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });

/* ── WeekNavigator ──────────────────────────────────────────────────────────── */
function WeekNavigator({
  weekOffset,
  weekStart,
  weekEnd,
  onChange,
}: {
  weekOffset: number;
  weekStart : Date;
  weekEnd   : Date;
  onChange  : (offset: number) => void;
}) {
  return (
    <View style={styles.weekNav}>
      <TouchableOpacity
        onPress={() => onChange(weekOffset - 1)}
        style={styles.weekArrow}
        activeOpacity={0.7}
      >
        <Ionicons name="chevron-back" size={18} color={WHITE} />
      </TouchableOpacity>

      <Text style={styles.weekLabel}>
        Semaine du {fmtDate(weekStart)} au {fmtDate(weekEnd)}
      </Text>

      <TouchableOpacity
        onPress={() => onChange(weekOffset + 1)}
        style={styles.weekArrow}
        activeOpacity={0.7}
      >
        <Ionicons name="chevron-forward" size={18} color={WHITE} />
      </TouchableOpacity>
    </View>
  );
}

/* ── TotalSummaryCard ───────────────────────────────────────────────────────── */
function TotalSummaryCard({ totalGross }: { totalGross: number }) {
  return (
    <BlurView intensity={18} tint="systemUltraThinMaterialDark" style={{ borderRadius: 20, overflow: 'hidden', marginBottom: 16 }}>
      <View style={[styles.summaryCard]}>
        <LinearGradient
          colors={['rgba(255,255,255,0.08)', 'transparent']}
          style={styles.specular}
        />
        <Text style={styles.summaryLabel}>Total équipe · Cette semaine</Text>
        <Text style={styles.summaryAmount}>{totalGross.toFixed(0)}€</Text>
      </View>
    </BlurView>
  );
}

/* ── StaffPayrollCard ───────────────────────────────────────────────────────── */
function StaffPayrollCard({
  staff,
  payroll,
  missions,
  onApprove,
  onPay,
  onWhatsApp,
}: {
  staff    : StaffMember;
  payroll  : PayrollRow;
  missions : Mission[];
  onApprove: (id: string) => void;
  onPay    : (id: string, staff: StaffMember) => void;
  onWhatsApp: (staff: StaffMember) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const roleLabel = staff.display_name === 'Oka' ? 'Barman' : 'Serveur';

  const statusLabel =
    payroll.status === 'paid'     ? 'Payé'       :
    payroll.status === 'approved' ? 'Approuvé'   : 'En attente';

  const statusBorderColor =
    payroll.status === 'paid' ? 'rgba(255,255,255,0.40)' : BORDER;
  const statusBg =
    payroll.status === 'paid' ? 'rgba(255,255,255,0.15)' : 'transparent';

  return (
    <BlurView intensity={18} tint="systemUltraThinMaterialDark" style={{ borderRadius: 20, overflow: 'hidden', marginBottom: 12 }}>
      <View style={styles.staffCard}>
        <LinearGradient
          colors={['rgba(255,255,255,0.08)', 'transparent']}
          style={styles.specular}
        />

        {/* Header row */}
        <View style={styles.staffHeader}>
          <View style={styles.staffAvatar}>
            <Text style={styles.staffAvatarText}>
              {staff.display_name[0]?.toUpperCase() ?? '?'}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.staffName}>{staff.display_name}</Text>
            <Text style={styles.staffRole}>
              {roleLabel} · {payroll.hourly_rate}€/h
            </Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusBg, borderColor: statusBorderColor }]}>
            <Text style={styles.statusBadgeText}>{statusLabel}</Text>
          </View>
        </View>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{payroll.hours_worked}h</Text>
            <Text style={styles.statLabel}>Heures</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{payroll.gross_total.toFixed(0)}€</Text>
            <Text style={styles.statLabel}>Total brut</Text>
          </View>
        </View>

        {/* Missions accordion */}
        {missions.length > 0 && (
          <TouchableOpacity
            onPress={() => setExpanded(e => !e)}
            style={styles.accordionToggle}
            activeOpacity={0.7}
          >
            <Text style={styles.accordionLabel}>
              {missions.length} mission{missions.length > 1 ? 's' : ''}
            </Text>
            <Ionicons
              name={expanded ? 'chevron-up' : 'chevron-down'}
              size={14}
              color={DIM}
            />
          </TouchableOpacity>
        )}
        {expanded && missions.map(m => (
          <View key={m.id} style={styles.missionRow}>
            <Text style={styles.missionRole} numberOfLines={1}>{m.role_name}</Text>
            <Text style={styles.missionDetail}>{m.hours_worked}h · {m.amount_due}€</Text>
          </View>
        ))}

        {/* Action buttons */}
        {payroll.status === 'pending' && (
          <TouchableOpacity
            onPress={() => onApprove(payroll.id)}
            style={styles.btnApprove}
            activeOpacity={0.8}
          >
            <Text style={styles.btnApproveText}>Approuver</Text>
          </TouchableOpacity>
        )}
        {payroll.status === 'approved' && (
          <TouchableOpacity
            onPress={() => onPay(payroll.id, staff)}
            style={styles.btnPay}
            activeOpacity={0.8}
          >
            <Text style={styles.btnPayText}>Marquer comme payé</Text>
          </TouchableOpacity>
        )}

        {/* WhatsApp button */}
        <TouchableOpacity
          onPress={() => onWhatsApp(staff)}
          style={styles.btnWhatsApp}
          activeOpacity={0.75}
        >
          <Ionicons name="logo-whatsapp" size={16} color={WHITE} />
          <Text style={styles.btnWhatsAppText}>Envoyer via WhatsApp</Text>
        </TouchableOpacity>
      </View>
    </BlurView>
  );
}

/* ── PaymentHistoryItem ─────────────────────────────────────────────────────── */
function PaymentHistoryItem({ payroll, staffName }: { payroll: PayrollRow; staffName: string }) {
  if (payroll.status !== 'paid' || !payroll.paid_at) return null;

  const paidDate = new Date(payroll.paid_at).toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric',
  });

  return (
    <View style={styles.historyRow}>
      <View style={styles.historyDot} />
      <View style={{ flex: 1 }}>
        <Text style={styles.historyName}>{staffName}</Text>
        <Text style={styles.historyMeta}>Payé le {paidDate} · {payroll.gross_total.toFixed(0)}€</Text>
      </View>
      <Ionicons name="checkmark-circle" size={18} color="rgba(255,255,255,0.60)" />
    </View>
  );
}

/* ── Main Screen ────────────────────────────────────────────────────────────── */
export default function PayrollScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [weekOffset, setWeekOffset]   = useState(0);
  const [staffList,  setStaffList]    = useState<StaffMember[]>([]);
  const [payrollData, setPayrollData] = useState<PayrollRow[]>([]);
  const [missions,   setMissions]     = useState<Mission[]>([]);

  /* ── Computed dates ── */
  const weekStart = useMemo(() => {
    const d = new Date();
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff + weekOffset * 7);
    d.setHours(0, 0, 0, 0);
    return d;
  }, [weekOffset]);

  const weekEnd = useMemo(() => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + 6);
    return d;
  }, [weekStart]);

  const totalGross = useMemo(
    () => payrollData.reduce((sum, p) => sum + (p.gross_total ?? 0), 0),
    [payrollData],
  );

  /* ── Fetch ── */
  const fetchStaff = useCallback(async () => {
    const { data } = await supabase
      .from('staff')
      .select('id, display_name, phone_whatsapp, hourly_rate')
      .in('display_name', ['Oka', 'Redo']);
    if (data) setStaffList(data as StaffMember[]);
  }, []);

  const fetchPayroll = useCallback(async () => {
    const start = isoDate(weekStart);
    const end   = isoDate(weekEnd);
    const { data } = await supabase
      .from('payroll')
      .select('*')
      .gte('week_start', start)
      .lte('week_end',   end);
    if (data) setPayrollData(data as PayrollRow[]);
  }, [weekStart, weekEnd]);

  const fetchMissions = useCallback(async () => {
    const start = isoDate(weekStart);
    const end   = isoDate(weekEnd);
    const { data } = await supabase
      .from('missions')
      .select('*')
      .gte('date_start', start)
      .lte('date_start', end);
    if (data) setMissions(data as Mission[]);
  }, [weekStart, weekEnd]);

  useEffect(() => {
    fetchStaff();
  }, [fetchStaff]);

  useEffect(() => {
    fetchPayroll();
    fetchMissions();
  }, [fetchPayroll, fetchMissions]);

  /* ── Handlers ── */
  const handleApprove = useCallback(async (payrollId: string) => {
    await supabase
      .from('payroll')
      .update({ status: 'approved' })
      .eq('id', payrollId);
    fetchPayroll();
  }, [fetchPayroll]);

  const handlePay = useCallback(async (payrollId: string, staff: StaffMember) => {
    await supabase
      .from('payroll')
      .update({ status: 'paid', paid_at: new Date().toISOString() })
      .eq('id', payrollId);
    await sendWhatsApp(staff.id, 'payroll_approved');
    fetchPayroll();
  }, [fetchPayroll]);

  const handleWhatsApp = useCallback((staff: StaffMember) => {
    sendWhatsApp(staff.id, 'availability_ask').then(result => {
      if (!result.configured) {
        Alert.alert(
          'WhatsApp',
          'Configurez Twilio dans Supabase > Settings > Secrets pour activer les notifications.',
        );
      } else if (!result.ok) {
        Alert.alert('Erreur', result.error ?? 'Échec envoi WhatsApp');
      } else {
        Alert.alert('Envoyé !', `Message WhatsApp envoyé à ${staff.display_name}`);
      }
    });
  }, []);

  /* ── Render helpers ── */
  const getPayrollForStaff = (staffId: string): PayrollRow | undefined =>
    payrollData.find(p => p.staff_id === staffId);

  const getMissionsForStaff = (staffId: string): Mission[] =>
    missions.filter(m => m.staff_id === staffId);

  const paidHistory = payrollData.filter(p => p.status === 'paid');

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <LinearGradient
        colors={[BG, NAVY, BG]}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* Header */}
      <AppHeader
        title="Paie"
        subtitle="Gestion de la rémunération"
        showBack={true}
      />

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Week navigator */}
        <WeekNavigator
          weekOffset={weekOffset}
          weekStart={weekStart}
          weekEnd={weekEnd}
          onChange={setWeekOffset}
        />

        {/* Total summary card */}
        <TotalSummaryCard totalGross={totalGross} />

        {/* Staff payroll cards */}
        {staffList.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="people-outline" size={44} color="rgba(255,255,255,0.20)" />
            <Text style={styles.emptyTitle}>Aucun staff trouvé</Text>
          </View>
        ) : (
          staffList.map(staff => {
            const payroll = getPayrollForStaff(staff.id);
            if (!payroll) {
              return (
                <BlurView
                  key={staff.id}
                  intensity={18}
                  tint="systemUltraThinMaterialDark"
                  style={{ borderRadius: 20, overflow: 'hidden', marginBottom: 12 }}
                >
                  <View style={styles.staffCard}>
                    <LinearGradient
                      colors={['rgba(255,255,255,0.08)', 'transparent']}
                      style={styles.specular}
                    />
                    <View style={styles.staffHeader}>
                      <View style={styles.staffAvatar}>
                        <Text style={styles.staffAvatarText}>
                          {staff.display_name[0]?.toUpperCase() ?? '?'}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.staffName}>{staff.display_name}</Text>
                        <Text style={styles.staffRole}>Aucune donnée cette semaine</Text>
                      </View>
                    </View>
                    <TouchableOpacity
                      onPress={() => handleWhatsApp(staff)}
                      style={styles.btnWhatsApp}
                      activeOpacity={0.75}
                    >
                      <Ionicons name="logo-whatsapp" size={16} color={WHITE} />
                      <Text style={styles.btnWhatsAppText}>Envoyer via WhatsApp</Text>
                    </TouchableOpacity>
                  </View>
                </BlurView>
              );
            }
            return (
              <StaffPayrollCard
                key={staff.id}
                staff={staff}
                payroll={payroll}
                missions={getMissionsForStaff(staff.id)}
                onApprove={handleApprove}
                onPay={handlePay}
                onWhatsApp={handleWhatsApp}
              />
            );
          })
        )}

        {/* Payment history */}
        {paidHistory.length > 0 && (
          <View style={styles.historySection}>
            <Text style={styles.historyTitle}>Historique des paiements</Text>
            {paidHistory.map(p => {
              const s = staffList.find(st => st.id === p.staff_id);
              return (
                <PaymentHistoryItem
                  key={p.id}
                  payroll={p}
                  staffName={s?.display_name ?? 'Inconnu'}
                />
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

/* ── Styles ─────────────────────────────────────────────────────────────────── */
const styles = StyleSheet.create({
  root: {
    flex           : 1,
    backgroundColor: BG,
  },
  scroll: {
    paddingHorizontal: 16,
    paddingTop       : 8,
  },

  /* Week navigator */
  weekNav: {
    flexDirection  : 'row',
    alignItems     : 'center',
    justifyContent : 'space-between',
    paddingVertical: 14,
    gap            : 8,
  },
  weekArrow: {
    width          : 36,
    height         : 36,
    borderRadius   : 18,
    backgroundColor: GLASS,
    borderWidth    : 1,
    borderColor    : BORDER,
    alignItems     : 'center',
    justifyContent : 'center',
  },
  weekLabel: {
    color     : WHITE,
    fontSize  : 14,
    fontWeight: '700',
    flex      : 1,
    textAlign : 'center',
  },

  /* Summary card */
  summaryCard: {
    backgroundColor: GLASS,
    borderRadius   : 20,
    borderWidth    : 1,
    borderColor    : BORDER,
    padding        : 24,
    alignItems     : 'center',
    overflow       : 'hidden',
  },
  summaryLabel: {
    color     : DIM,
    fontSize  : 13,
    fontWeight: '500',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  summaryAmount: {
    color     : WHITE,
    fontSize  : 40,
    fontWeight: '900',
    letterSpacing: -1,
  },

  /* Specular highlight */
  specular: {
    position        : 'absolute',
    top             : 0,
    left            : 0,
    right           : 0,
    height          : 40,
    borderTopLeftRadius : 20,
    borderTopRightRadius: 20,
  },

  /* Staff card */
  staffCard: {
    backgroundColor: GLASS,
    borderRadius   : 20,
    borderWidth    : 1,
    borderColor    : BORDER,
    padding        : 20,
    overflow       : 'hidden',
  },
  staffHeader: {
    flexDirection: 'row',
    alignItems   : 'center',
    gap          : 12,
    marginBottom : 16,
  },
  staffAvatar: {
    width          : 48,
    height         : 48,
    borderRadius   : 24,
    backgroundColor: 'rgba(255,255,255,0.10)',
    alignItems     : 'center',
    justifyContent : 'center',
    borderWidth    : 1,
    borderColor    : BORDER,
  },
  staffAvatarText: {
    color     : WHITE,
    fontSize  : 18,
    fontWeight: '800',
  },
  staffName: {
    color     : WHITE,
    fontSize  : 17,
    fontWeight: '800',
  },
  staffRole: {
    color   : DIM,
    fontSize: 13,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical  : 5,
    borderRadius     : 20,
    borderWidth      : 1,
  },
  statusBadgeText: {
    color     : WHITE,
    fontSize  : 11,
    fontWeight: '700',
  },

  /* Stats */
  statsRow: {
    flexDirection: 'row',
    gap          : 12,
    marginBottom : 16,
  },
  statBox: {
    flex           : 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius   : 12,
    padding        : 14,
    alignItems     : 'center',
  },
  statValue: {
    color     : WHITE,
    fontSize  : 22,
    fontWeight: '900',
  },
  statLabel: {
    color   : DIM,
    fontSize: 11,
  },

  /* Accordion */
  accordionToggle: {
    flexDirection   : 'row',
    alignItems      : 'center',
    justifyContent  : 'space-between',
    paddingVertical : 10,
    marginBottom    : 4,
    borderTopWidth  : 1,
    borderTopColor  : BORDER,
  },
  accordionLabel: {
    color     : DIM,
    fontSize  : 13,
    fontWeight: '600',
  },
  missionRow: {
    flexDirection  : 'row',
    justifyContent : 'space-between',
    alignItems     : 'center',
    paddingVertical: 8,
    paddingLeft    : 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  missionRole: {
    color    : WHITE,
    fontSize : 13,
    fontWeight: '600',
    flex     : 1,
  },
  missionDetail: {
    color   : DIM,
    fontSize: 12,
  },

  /* Buttons */
  btnApprove: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius   : 12,
    padding        : 14,
    alignItems     : 'center',
    borderWidth    : 1,
    borderColor    : 'rgba(255,255,255,0.20)',
    marginTop      : 8,
    marginBottom   : 8,
  },
  btnApproveText: {
    color     : WHITE,
    fontSize  : 15,
    fontWeight: '700',
  },
  btnPay: {
    backgroundColor: WHITE,
    borderRadius   : 12,
    padding        : 14,
    alignItems     : 'center',
    marginTop      : 8,
    marginBottom   : 8,
  },
  btnPayText: {
    color     : BG,
    fontSize  : 15,
    fontWeight: '800',
  },
  btnWhatsApp: {
    flexDirection  : 'row',
    gap            : 8,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius   : 12,
    padding        : 12,
    alignItems     : 'center',
    justifyContent : 'center',
    borderWidth    : 1,
    borderColor    : BORDER,
  },
  btnWhatsAppText: {
    color     : WHITE,
    fontSize  : 13,
    fontWeight: '600',
  },

  /* History */
  historySection: {
    marginTop: 24,
  },
  historyTitle: {
    color        : WHITE,
    fontSize     : 16,
    fontWeight   : '800',
    marginBottom : 12,
    letterSpacing: -0.3,
  },
  historyRow: {
    flexDirection  : 'row',
    alignItems     : 'center',
    gap            : 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  historyDot: {
    width          : 8,
    height         : 8,
    borderRadius   : 4,
    backgroundColor: WHITE,
  },
  historyName: {
    color     : WHITE,
    fontSize  : 14,
    fontWeight: '700',
  },
  historyMeta: {
    color   : DIM,
    fontSize: 12,
  },

  /* Empty */
  emptyContainer: {
    alignItems    : 'center',
    justifyContent: 'center',
    gap           : 16,
    paddingVertical: 48,
  },
  emptyTitle: {
    color     : WHITE,
    fontSize  : 16,
    fontWeight: '700',
  },
});
