/**
 * app/(organizer)/dashboard.tsx — EVENTURE v6 (Ultra-Premium)
 * Sophisticated Event Cards & Glass Modal Detail View
 * Dark navy theme — BG #050E1B + Liquid Glass
 */
import React, { memo, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated, Dimensions, FlatList, Image, ScrollView,
  StyleSheet, Text, TouchableOpacity, View, Pressable, Modal
} from 'react-native';
import { BlurView }        from 'expo-blur';
import { LinearGradient }  from 'expo-linear-gradient';
import { Ionicons }        from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar }       from 'expo-status-bar';

/* ─── Design tokens ──────────────────────────────────────────────────────── */
const { width: SW, height: SH } = Dimensions.get('window');
const BG      = '#050E1B';
const BLUE    = '#1A9FE3';
const WHITE   = '#FFFFFF';
const MUTED   = 'rgba(255,255,255,0.55)';
const SUCCESS = '#00E676';
const WARNING = '#FFD54F';
const DANGER  = '#FF5252';

const EDGE = 20;
const CARD_WIDTH = SW * 0.82; 
const CARD_HEIGHT = 440;

/* ─── Types ──────────────────────────────────────────────────────────────── */
interface DashEvent {
  id: string;
  title: string;
  date_start: string;
  location: string;
  status: 'published' | 'draft' | 'completed';
  cover_url: string;
  description: string;
  staff_needed: number;
  staff_assigned: number;
}

interface StaffMember {
  id: string;
  display_name: string;
  avatar_url: string | null;
  status: 'available' | 'assigned' | 'unavailable';
  current_event_id?: string;
  role: string;
}

/* ─── Helpers ────────────────────────────────────────────────────────────── */
const daysUntil = (iso: string) => Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
const formatDate = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

/* ─── Liquid Glass Card ──────────────────────────────────────────────────── */
function GlassCard({
  children, style, radius = 24, tint = 'dark', noBorder = false,
}: {
  children: React.ReactNode; style?: any; radius?: number; tint?: 'blue' | 'white' | 'dark' | 'glass'; noBorder?: boolean;
}) {
  const tintMap = {
    blue:   ['rgba(26, 159, 227, 0.15)', 'rgba(26, 159, 227, 0.02)'],
    white:  ['rgba(255,255,255,0.12)', 'rgba(255,255,255,0.02)'],
    dark:   ['rgba(5, 14, 27, 0.6)', 'rgba(5, 14, 27, 0.2)'],
    glass:  ['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.0)'],
  } as const;
  
  return (
    <View style={[{ borderRadius: radius, overflow: 'hidden' }, style]}>
      {(tint === 'dark' || tint === 'blue') && <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(5,14,27,0.40)' }]}/>}
      <BlurView intensity={65} tint="dark" style={StyleSheet.absoluteFill}/>
      <LinearGradient colors={tintMap[tint] as any} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 0.4, y: 1 }} />
      {!noBorder && (
        <View style={[StyleSheet.absoluteFill, { borderRadius: radius, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' }]} pointerEvents="none"/>
      )}
      {children}
    </View>
  );
}

/* ─── Event Detail Modal ─────────────────────────────────────────────────── */
const EventDetailModal = ({ 
  visible, evt, onClose, staff 
}: { 
  visible: boolean; evt: DashEvent | null; onClose: () => void; staff: StaffMember[] 
}) => {
  const insets = useSafeAreaInsets();
  if (!evt) return null;

  const assignedStaff = staff.filter(s => s.current_event_id === evt.id);
  const fillRatio = Math.min((evt.staff_assigned / (evt.staff_needed || 1)) * 100, 100);

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <BlurView intensity={90} tint="dark" style={StyleSheet.absoluteFill} />
      <View style={{ flex: 1, backgroundColor: 'rgba(5,14,27,0.75)' }}>
        
        {/* Header Image & Close Button */}
        <View style={{ height: SH * 0.4, width: '100%' }}>
          <Image source={{ uri: evt.cover_url }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          <LinearGradient colors={['rgba(0,0,0,0.5)', 'transparent', BG]} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
          
          <TouchableOpacity onPress={onClose} style={{ position: 'absolute', top: insets.top + 10, right: 20, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(10px)' }}>
            <Ionicons name="close" size={24} color={WHITE} />
          </TouchableOpacity>
        </View>

        {/* Content Body */}
        <ScrollView style={{ flex: 1, marginTop: -40 }} contentContainerStyle={{ padding: EDGE, paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
          
          <View style={{ gap: 16, marginBottom: 32 }}>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, backgroundColor: `${BLUE}33`, borderWidth: 1, borderColor: BLUE }}>
                <Text style={{ color: BLUE, fontSize: 12, fontWeight: '800', textTransform: 'uppercase' }}>{evt.location}</Text>
              </View>
              <View style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.1)' }}>
                <Text style={{ color: WHITE, fontSize: 12, fontWeight: '700' }}>{formatDate(evt.date_start)}</Text>
              </View>
            </View>

            <Text style={{ color: WHITE, fontSize: 36, fontWeight: '900', lineHeight: 40 }}>{evt.title}</Text>
            <Text style={{ color: MUTED, fontSize: 15, lineHeight: 24, fontWeight: '500' }}>{evt.description}</Text>
          </View>

          {/* Staff Analytics Card */}
          <GlassCard tint="dark" radius={20} style={{ padding: 20, marginBottom: 32 }}>
            <Text style={{ color: WHITE, fontSize: 18, fontWeight: '800', marginBottom: 16 }}>Ressources Humaines</Text>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 8 }}>
              <View>
                <Text style={{ color: WHITE, fontSize: 24, fontWeight: '900' }}>{evt.staff_assigned} <Text style={{ fontSize: 16, color: MUTED }}>/ {evt.staff_needed}</Text></Text>
                <Text style={{ color: MUTED, fontSize: 13, fontWeight: '600' }}>Staff assigné vs Requis</Text>
              </View>
              <Text style={{ color: fillRatio === 100 ? SUCCESS : BLUE, fontSize: 16, fontWeight: '800' }}>{Math.round(fillRatio)}%</Text>
            </View>
            
            <View style={{ height: 8, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 4, overflow: 'hidden', marginVertical: 12 }}>
              <View style={{ height: '100%', width: `${fillRatio}%`, backgroundColor: fillRatio >= 100 ? SUCCESS : BLUE, borderRadius: 4 }} />
            </View>

            {/* Avatars de l'équipe assignée */}
            {assignedStaff.length > 0 && (
              <View style={{ flexDirection: 'row', marginTop: 12 }}>
                {assignedStaff.slice(0, 5).map((s, i) => (
                  <View key={s.id} style={{ marginLeft: i > 0 ? -12 : 0, borderWidth: 2, borderColor: '#101B2E', borderRadius: 20 }}>
                    {s.avatar_url ? 
                      <Image source={{ uri: s.avatar_url }} style={{ width: 36, height: 36, borderRadius: 18 }} /> :
                      <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: BLUE, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: WHITE, fontSize: 14, fontWeight: 'bold' }}>{s.display_name[0]}</Text></View>
                    }
                  </View>
                ))}
                {assignedStaff.length > 5 && (
                  <View style={{ marginLeft: -12, borderWidth: 2, borderColor: '#101B2E', borderRadius: 20, width: 36, height: 36, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ color: WHITE, fontSize: 12, fontWeight: 'bold' }}>+{assignedStaff.length - 5}</Text>
                  </View>
                )}
              </View>
            )}
          </GlassCard>

          {/* Action Button */}
          <TouchableOpacity style={{ backgroundColor: BLUE, borderRadius: 16, paddingVertical: 18, alignItems: 'center', shadowColor: BLUE, shadowOpacity: 0.4, shadowRadius: 15, shadowOffset: { width: 0, height: 8 } }}>
            <Text style={{ color: WHITE, fontSize: 16, fontWeight: '800' }}>Gérer le Staff pour cet Événement</Text>
          </TouchableOpacity>

        </ScrollView>
      </View>
    </Modal>
  );
};

/* ─── Interactive Event Card (Ultra Sophisticated) ───────────────────────── */
const EventCard = memo(({ evt, isActive, onPress }: { evt: DashEvent; isActive: boolean; onPress: () => void }) => {
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.spring(scale, { toValue: isActive ? 1 : 0.92, friction: 6, tension: 40, useNativeDriver: true }).start();
  }, [isActive]);

  const days = daysUntil(evt.date_start);
  const fillRatio = Math.min((evt.staff_assigned / (evt.staff_needed || 1)) * 100, 100);

  return (
    <Pressable onPress={onPress}>
      <Animated.View style={{ transform: [{ scale }], marginRight: 20, width: CARD_WIDTH, opacity: isActive ? 1 : 0.5 }}>
        {isActive && (
          <LinearGradient colors={[BLUE, 'transparent']} style={[StyleSheet.absoluteFill, { top: -10, bottom: -10, left: -10, right: -10, borderRadius: 34, opacity: 0.3, filter: 'blur(20px)' }]} pointerEvents="none" />
        )}
        
        <GlassCard tint="dark" radius={28} style={{ height: CARD_HEIGHT }}>
          <Image source={{ uri: evt.cover_url }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          <LinearGradient colors={['rgba(5,14,27,0.1)', 'rgba(5,14,27,0.7)', '#050E1B']} locations={[0, 0.4, 1]} style={StyleSheet.absoluteFill} />
          
          <View style={{ padding: 24, flex: 1, justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <GlassCard tint="glass" radius={14} noBorder style={{ paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' }}>
                <Text style={{ color: WHITE, fontSize: 12, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1 }}>
                  {days <= 0 ? "AUJOURD'HUI" : `J-${days}`}
                </Text>
              </GlassCard>
            </View>

            <View style={{ gap: 16 }}>
              <View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <Ionicons name="location" size={14} color={BLUE} />
                  <Text style={{ color: BLUE, fontSize: 13, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 }}>{evt.location}</Text>
                </View>
                <Text style={{ color: WHITE, fontSize: 32, fontWeight: '900', lineHeight: 36, textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 4 }} numberOfLines={2}>
                  {evt.title}
                </Text>
              </View>
              
              <GlassCard tint="glass" radius={20} style={{ padding: 16 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <Text style={{ color: MUTED, fontSize: 13, fontWeight: '600' }}>Équipe mobilisée</Text>
                  <Text style={{ color: WHITE, fontSize: 15, fontWeight: '900' }}>{evt.staff_assigned} <Text style={{ color: MUTED, fontSize: 13, fontWeight: '600' }}>/ {evt.staff_needed}</Text></Text>
                </View>
                <View style={{ height: 6, backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 3, overflow: 'hidden' }}>
                  <View style={{ height: '100%', width: `${fillRatio}%`, backgroundColor: fillRatio >= 100 ? SUCCESS : BLUE, borderRadius: 3 }} />
                </View>
              </GlassCard>
            </View>
          </View>
          
          {isActive && <View style={[StyleSheet.absoluteFill, { borderRadius: 28, borderWidth: 1.5, borderColor: BLUE }]} pointerEvents="none" />}
        </GlassCard>
      </Animated.View>
    </Pressable>
  );
});

/* ─── Staff Card (Carousel) ──────────────────────────────────────────────── */
const StaffCard = memo(({ member }: { member: StaffMember }) => {
  const statusColors = { available: SUCCESS, assigned: WARNING, unavailable: DANGER };
  const statusLabels = { available: 'Disponible', assigned: 'En mission', unavailable: 'Indisponible' };
  const color = statusColors[member.status];

  return (
    <GlassCard tint="white" radius={20} style={{ width: 140, marginRight: 14, height: 180 }}>
      <View style={{ padding: 16, alignItems: 'center', flex: 1, justifyContent: 'center', gap: 12 }}>
        <View style={{ position: 'relative' }}>
          {member.avatar_url ? (
            <Image source={{ uri: member.avatar_url }} style={{ width: 68, height: 68, borderRadius: 34 }} />
          ) : (
            <View style={{ width: 68, height: 68, borderRadius: 34, backgroundColor: 'rgba(255,255,255,0.05)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}>
              <Text style={{ color: WHITE, fontWeight: '800', fontSize: 24 }}>{member.display_name.charAt(0)}</Text>
            </View>
          )}
          <View style={{ position: 'absolute', bottom: 2, right: 2, width: 18, height: 18, borderRadius: 9, backgroundColor: color, borderWidth: 3, borderColor: '#101B2E' }}/>
        </View>

        <View style={{ alignItems: 'center', gap: 4 }}>
          <Text style={{ color: WHITE, fontSize: 14, fontWeight: '800', textAlign: 'center' }} numberOfLines={1}>{member.display_name}</Text>
          <Text style={{ color: MUTED, fontSize: 11, textAlign: 'center', fontWeight: '600' }}>{member.role}</Text>
        </View>
      </View>
    </GlassCard>
  );
});

/* ─── SCREEN ─────────────────────────────────────────────────────────────── */
export default function Dashboard() {
  const insets  = useSafeAreaInsets();
  
  // --- MOCK DATA : 15 Événements ---
  const [events] = useState<DashEvent[]>([
    { id: 'e1', title: 'PUFFERS Visual Exhibition', date_start: new Date(Date.now() + 86400000 * 2).toISOString(), location: 'Galerie Perrotin', status: 'published', description: "Vernissage exclusif de la série thématique 'PUFFERS'. Mise en place des 5 décors distincts générés par IA. Requiert un staff spécialisé en scénographie et accueil VIP.", cover_url: 'https://images.unsplash.com/photo-1513364776144-60967b0f800f?q=80&w=1000', staff_needed: 12, staff_assigned: 10 },
    { id: 'e2', title: 'Le Compagnon de Voyage Launch', date_start: new Date(Date.now() + 86400000 * 5).toISOString(), location: 'Station F, Paris', status: 'published', description: "Événement de lancement officiel pour l'application mobile 'Culturel' Travel Companion. Démonstrations en direct des workflows IA et GitHub.", cover_url: 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?q=80&w=1000', staff_needed: 20, staff_assigned: 20 },
    { id: 'e3', title: 'Solidays 2026', date_start: new Date(Date.now() + 86400000 * 12).toISOString(), location: 'Paris Longchamp', status: 'published', description: "Festival majeur de l'été. Gros besoin en sécurité, bar, et logistique pour gérer le flux continu de festivaliers sur 3 jours.", cover_url: 'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?q=80&w=1000', staff_needed: 55, staff_assigned: 42 },
    { id: 'e4', title: 'Tech Gala Night', date_start: new Date(Date.now() + 86400000 * 18).toISOString(), location: 'Lyon Confluence', status: 'published', description: "Soirée de gala pour les acteurs de la tech lyonnaise. Tenue correcte exigée pour le staff, service au plateau de rigueur.", cover_url: 'https://images.unsplash.com/photo-1540039155733-d7696c4bc063?q=80&w=1000', staff_needed: 15, staff_assigned: 15 },
    { id: 'e5', title: 'Mobile Dev Workflow Con', date_start: new Date(Date.now() + 86400000 * 25).toISOString(), location: 'Lille Grand Palais', status: 'draft', description: "Convention dédiée aux stacks techniques AI-first et à l'intégration Google AI Studio. Besoin d'hôtes techniques pour assister les speakers.", cover_url: 'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?q=80&w=1000', staff_needed: 18, staff_assigned: 5 },
    { id: 'e6', title: 'Summer Vibe Fest', date_start: new Date(Date.now() + 86400000 * 30).toISOString(), location: 'Plage du Prado', status: 'published', description: "Festival électro les pieds dans le sable. Nécessite une équipe endurante pour la gestion des bars et des accès VIP.", cover_url: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=1000', staff_needed: 30, staff_assigned: 12 },
    { id: 'e7', title: 'E-Sport Championship', date_start: new Date(Date.now() + 86400000 * 40).toISOString(), location: 'Accor Arena', status: 'published', description: "Finale européenne. Énorme dispositif technique et régie. Le staff doit être bilingue anglais.", cover_url: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=1000', staff_needed: 40, staff_assigned: 38 },
    { id: 'e8', title: 'Paris Fashion Week', date_start: new Date(Date.now() + 86400000 * 45).toISOString(), location: 'Grand Palais', status: 'draft', description: "Défilés de haute couture. Staff trié sur le volet, discrétion absolue et réactivité requises pour l'accueil des célébrités.", cover_url: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?q=80&w=1000', staff_needed: 50, staff_assigned: 10 },
    { id: 'e9', title: 'Food & Wine Expo', date_start: new Date(Date.now() + 86400000 * 50).toISOString(), location: 'Bordeaux', status: 'published', description: "Salon de dégustation. Recherche de sommeliers et d'animateurs de stands culinaires.", cover_url: 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?q=80&w=1000', staff_needed: 35, staff_assigned: 30 },
    { id: 'e10', title: 'Startup Pitch Night', date_start: new Date(Date.now() + 86400000 * 60).toISOString(), location: 'Nantes', status: 'published', description: "Soirée networking pour identifier les concepts mobiles de 2026. Staff d'accueil dynamique.", cover_url: 'https://images.unsplash.com/photo-1559136555-e46be3620950?q=80&w=1000', staff_needed: 12, staff_assigned: 8 },
    { id: 'e11', title: 'Crypto & Web3 Meetup', date_start: new Date(Date.now() + 86400000 * 65).toISOString(), location: 'Strasbourg', status: 'draft', description: "Conférence technique sur la blockchain. Besoin de modérateurs pour les salles de conférence.", cover_url: 'https://images.unsplash.com/photo-1621416894569-0f39ed31d247?q=80&w=1000', staff_needed: 15, staff_assigned: 2 },
    { id: 'e12', title: 'Yoga & Wellness Retreat', date_start: new Date(Date.now() + 86400000 * 75).toISOString(), location: 'Annecy', status: 'published', description: "Retraite de 4 jours. Staff d'encadrement doux et discret pour la logistique des repas et des ateliers.", cover_url: 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?q=80&w=1000', staff_needed: 8, staff_assigned: 8 },
    { id: 'e13', title: 'Future of Design Symposium', date_start: new Date(Date.now() + 86400000 * 80).toISOString(), location: 'Toulouse', status: 'draft', description: "Symposium sur la direction artistique générative. Profils tech & art demandés.", cover_url: 'https://images.unsplash.com/photo-1561070791-2526d30994b5?q=80&w=1000', staff_needed: 20, staff_assigned: 0 },
    { id: 'e14', title: 'AI Ethics Round Table', date_start: new Date(Date.now() + 86400000 * 90).toISOString(), location: 'Genève', status: 'published', description: "Sommet international. Haute sécurité et hôtesses d'accueil VIP.", cover_url: 'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?q=80&w=1000', staff_needed: 25, staff_assigned: 15 },
    { id: 'e15', title: 'Jazz Festival Finale', date_start: new Date(Date.now() - 86400000 * 5).toISOString(), location: 'Montreux', status: 'completed', description: "Clôture du festival de Jazz. Démontage et gestion des foules de fin de soirée.", cover_url: 'https://images.unsplash.com/photo-1511192336575-5a79af67a629?q=80&w=1000', staff_needed: 25, staff_assigned: 25 },
  ]);

  // --- MOCK DATA : 15 Staff ---
  const [staff] = useState<StaffMember[]>([
    { id: 's1', display_name: 'Léa Martin', avatar_url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200', status: 'assigned', current_event_id: 'e1', role: 'Scénographe' },
    { id: 's2', display_name: 'Tom Dubois', avatar_url: 'https://images.unsplash.com/photo-1599566150163-29194dcaad36?w=200', status: 'available', role: 'Sécurité' },
    { id: 's3', display_name: 'Sarah Connor', avatar_url: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200', status: 'assigned', current_event_id: 'e3', role: 'Barman' },
    { id: 's4', display_name: 'Hugo Lloris', avatar_url: null, status: 'unavailable', role: 'Technicien Son' },
    { id: 's5', display_name: 'Emma Watson', avatar_url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=200', status: 'available', role: 'Accueil VIP' },
    { id: 's6', display_name: 'Marc Z.', avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200', status: 'assigned', current_event_id: 'e2', role: 'Développeur IA' },
    { id: 's7', display_name: 'Julie D.', avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200', status: 'assigned', current_event_id: 'e1', role: 'Directrice Artistique' },
    { id: 's8', display_name: 'Antoine G.', avatar_url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200', status: 'available', role: 'Logistique' },
    { id: 's9', display_name: 'Clara M.', avatar_url: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200', status: 'unavailable', role: 'Coordinatrice' },
    { id: 's10', display_name: 'Lucas B.', avatar_url: 'https://images.unsplash.com/photo-1552058544-f2b08422138a?w=200', status: 'assigned', current_event_id: 'e7', role: 'Régisseur Général' },
    { id: 's11', display_name: 'Sophie T.', avatar_url: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=200', status: 'assigned', current_event_id: 'e2', role: 'Guide Culturel' },
    { id: 's12', display_name: 'Maxime R.', avatar_url: null, status: 'assigned', current_event_id: 'e5', role: 'Intégrateur Tech' },
    { id: 's13', display_name: 'Chloé P.', avatar_url: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=200', status: 'assigned', current_event_id: 'e9', role: 'Sommelière' },
    { id: 's14', display_name: 'Alex V.', avatar_url: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=200', status: 'available', role: 'Sécurité' },
    { id: 's15', display_name: 'Nina K.', avatar_url: 'https://images.unsplash.com/photo-1517365830460-955ce3ccd263?w=200', status: 'unavailable', role: 'Photographe' },
  ]);

  const [selectedEventId, setSelectedEventId] = useState<string | null>(events[0].id);
  const [modalEvent, setModalEvent] = useState<DashEvent | null>(null);

  // Gère le double comportement : sélectionner pour le filtre + ouvrir la modale
  const handleEventPress = (evt: DashEvent) => {
    setSelectedEventId(evt.id);
    setModalEvent(evt);
  };

  const filteredStaff = useMemo(() => {
    if (!selectedEventId) return staff;
    return staff.filter(s => s.current_event_id === selectedEventId || s.status === 'available')
                .sort((a, b) => (a.current_event_id === selectedEventId ? -1 : 1));
  }, [selectedEventId, staff]);

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <StatusBar style="light"/>

      {/* Header */}
      <View style={{ paddingTop: insets.top + 20, paddingHorizontal: EDGE, paddingBottom: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View>
          <Text style={{ color: WHITE, fontSize: 30, fontWeight: '900', letterSpacing: -1 }}>Eventure Hub</Text>
          <Text style={{ color: BLUE, fontSize: 14, marginTop: 4, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 }}>{events.length} Projets Actifs</Text>
        </View>
        <TouchableOpacity style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}>
          <Ionicons name="options" size={22} color={WHITE} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        
        {/* Carrousel Événements (La pièce maîtresse) */}
        <View style={{ marginBottom: 40 }}>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: EDGE, paddingVertical: 10 }}
            snapToInterval={CARD_WIDTH + 20}
            decelerationRate="fast"
            data={events}
            keyExtractor={item => item.id}
            renderItem={({ item }) => (
              <EventCard 
                evt={item} 
                isActive={selectedEventId === item.id} 
                onPress={() => handleEventPress(item)} 
              />
            )}
          />
        </View>

        {/* Section Staff Roster filtré */}
        <View style={{ paddingHorizontal: EDGE }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 20 }}>
            <View style={{ gap: 4 }}>
              <Text style={{ color: WHITE, fontSize: 22, fontWeight: '900' }}>
                {selectedEventId ? 'Équipe Mobilisable' : 'Équipe Globale'}
              </Text>
              <Text style={{ color: MUTED, fontSize: 13, fontWeight: '500' }}>
                {filteredStaff.length} membres correspondent aux critères
              </Text>
            </View>
            {selectedEventId && (
              <TouchableOpacity onPress={() => setSelectedEventId(null)} style={{ paddingVertical: 6, paddingHorizontal: 12, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 20 }}>
                <Text style={{ color: WHITE, fontSize: 12, fontWeight: '700' }}>Voir tout</Text>
              </TouchableOpacity>
            )}
          </View>

          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={filteredStaff}
            keyExtractor={item => item.id}
            renderItem={({ item }) => <StaffCard member={item} />}
            contentContainerStyle={{ paddingBottom: 20 }}
          />
        </View>
      </ScrollView>

      {/* Modal Détail Événement */}
      <EventDetailModal 
        visible={!!modalEvent} 
        evt={modalEvent} 
        onClose={() => setModalEvent(null)} 
        staff={staff} 
      />
    </View>
  );
}