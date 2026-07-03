// components/staffing/MissionPriorityCard.tsx
// Carte mission du jour — code couleur par urgence/statut, gros boutons (usage terrain, pouce).
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { MyMission } from '@/hooks/useMyMissions';
import { isRegisseur } from '@/hooks/useMyMissions';

const CARD_BG = '#0D1A35';
const BORDER  = 'rgba(167,139,250,0.20)';
const VIOLET  = '#A78BFA';

type Accent = { color: string; label: string; icon: keyof typeof Ionicons.glyphMap };

function getAccent(m: MyMission): Accent {
  if (m.mission_status === 'completed')   return { color: '#10B981', label: 'Terminée',   icon: 'checkmark-circle' };
  if (m.mission_status === 'in_progress') return { color: '#6366F1', label: 'En cours',    icon: 'time' };
  if (m.mission_status === 'cancelled')   return { color: '#EF4444', label: 'Annulée',     icon: 'close-circle' };

  // À venir : imminent (< 60 min) ou déjà en retard sans check-in → urgence visuelle.
  // Pas de borne basse : tant que le staff n'a pas validé sa présence, un créneau
  // dépassé reste urgent plutôt que de repasser discrètement à "à venir".
  const start = m.scheduled_start ? new Date(m.scheduled_start) : null;
  if (start) {
    const minsUntil = (start.getTime() - Date.now()) / 60000;
    if (minsUntil <= 60) return { color: '#EF4444', label: minsUntil < 0 ? 'En retard' : 'Imminent', icon: 'alert-circle' };
  }
  return { color: '#F59E0B', label: 'À venir', icon: 'calendar' };
}

function fmtTime(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

interface Props {
  mission: MyMission;
  onCheckIn: (id: string) => void;
  onCheckOut: (id: string) => void;
  busy?: boolean;
}

export default function MissionPriorityCard({ mission, onCheckIn, onCheckOut, busy }: Props) {
  const accent = getAccent(mission);
  const start = fmtTime(mission.scheduled_start);
  const end = fmtTime(mission.scheduled_end);
  const regisseur = isRegisseur(mission);
  const notStarted = mission.mission_status === 'assigned' || mission.mission_status === 'confirmed';
  const inProgress = mission.mission_status === 'in_progress';

  return (
    <View style={[s.card, { borderColor: accent.color + '55' }]}>
      <View style={s.headerRow}>
        <View style={[s.badge, { backgroundColor: accent.color + '22', borderColor: accent.color + '66' }]}>
          <Ionicons name={accent.icon} size={14} color={accent.color} />
          <Text style={[s.badgeTxt, { color: accent.color }]}>{accent.label}</Text>
        </View>
        {regisseur && (
          <View style={s.regisseurBadge}>
            <Ionicons name="shield-checkmark" size={12} color={VIOLET} />
            <Text style={s.regisseurTxt}>Régisseur</Text>
          </View>
        )}
      </View>

      <Text style={s.eventTitle} numberOfLines={2}>{mission.event_title}</Text>

      <View style={s.metaRow}>
        {mission.role && (
          <View style={s.metaItem}>
            <Ionicons name="briefcase-outline" size={13} color="rgba(255,255,255,0.5)" />
            <Text style={s.metaTxt}>{mission.role}</Text>
          </View>
        )}
        {(start || end) && (
          <View style={s.metaItem}>
            <Ionicons name="time-outline" size={13} color="rgba(255,255,255,0.5)" />
            <Text style={s.metaTxt}>{start ?? '—'}{end ? ` - ${end}` : ''}</Text>
          </View>
        )}
        {!!mission.event_location && (
          <View style={s.metaItem}>
            <Ionicons name="location-outline" size={13} color="rgba(255,255,255,0.5)" />
            <Text style={s.metaTxt} numberOfLines={1}>{mission.event_location.split(',')[0]}</Text>
          </View>
        )}
      </View>

      {(notStarted || inProgress) && (
        <TouchableOpacity
          style={[s.actionBtn, { backgroundColor: inProgress ? '#10B98122' : accent.color + '22', borderColor: inProgress ? '#10B98166' : accent.color + '66' }]}
          onPress={() => (inProgress ? onCheckOut(mission.id) : onCheckIn(mission.id))}
          disabled={busy}
          activeOpacity={0.82}
        >
          <Ionicons name={inProgress ? 'checkmark-done' : 'checkmark-circle-outline'} size={24} color={inProgress ? '#10B981' : accent.color} />
          <Text style={[s.actionTxt, { color: inProgress ? '#10B981' : accent.color }]}>
            {inProgress ? 'Terminer la mission' : 'Valider ma présence'}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: CARD_BG,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: BORDER,
    padding: 16,
    gap: 10,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1,
  },
  badgeTxt: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.3 },
  regisseurBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20,
    backgroundColor: 'rgba(167,139,250,0.14)', borderWidth: 1, borderColor: 'rgba(167,139,250,0.35)',
  },
  regisseurTxt: { color: VIOLET, fontSize: 11, fontWeight: '800' },
  eventTitle: { color: '#fff', fontSize: 18, fontWeight: '900', letterSpacing: -0.3 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 5, maxWidth: '100%' },
  metaTxt: { color: 'rgba(255,255,255,0.55)', fontSize: 13, fontWeight: '600' },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    minHeight: 56, borderRadius: 14, borderWidth: 1.5, marginTop: 4,
  },
  actionTxt: { fontSize: 16, fontWeight: '800' },
});
