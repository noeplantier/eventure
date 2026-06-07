/**
 * components/CustomNavBar.tsx — EVENTURE
 *
 * ★ Architecture IDENTIQUE Universe v4 : floating pill, BlurView, MaterialCommunityIcons
 * ★ supabase.auth.getSession() + onAuthStateChange
 * ★ Avatar live : Realtime profiles UPDATE + SecureStore 'profile_dirty'
 * ★ Canal nav_{mountId}_{uid} unique par montage (.on() AVANT .subscribe())
 * ★ Monté après 1 tick (contexte navigation initialisé)
 *
 * NAVIGATION ORGANISATEUR :
 *   Hub       → /(organizer)/dashboard     vue globale missions + stats
 *   Talents   → /(organizer)/staff-search  chercher du staff qualifié
 *   ✦ Poster  → /(organizer)/create-event  BOUTON CENTRAL — poster une mission
 *   Équipe    → /(organizer)/applications  candidatures + recrutés (badge)
 *   Agence    → /(organizer)/profile       mon agence / profil organisateur
 */
import React, {
    memo, useCallback, useEffect, useRef, useState,
  } from 'react';
  import {
    Image, Platform, StyleSheet,
    Text, TouchableOpacity, View,
  } from 'react-native';
  import { BlurView }               from 'expo-blur';
  import { Ionicons }               from '@expo/vector-icons';
  import { MaterialCommunityIcons } from '@expo/vector-icons';
  import { supabase }               from '@/lib/supabase';
  
  // useRouter chargé dynamiquement (évite crash si contexte pas prêt)
  let _useRouter: (() => { push: (p: any) => void }) | null = null;
  try { _useRouter = require('expo-router').useRouter; } catch {}
  
  // SecureStore — natif uniquement
  const SecureStore: any = Platform.select({
    native:  () => { try { return require('expo-secure-store'); } catch { return null; } },
    default: () => null,
  })?.() ?? null;
  
  // ─── Palette Eventure ─────────────────────────────────────────────────────────
  const GREEN     = '#00D97E';
  const GREEN_DIM = 'rgba(0,217,126,0.18)';
  const GREEN_BD  = 'rgba(0,217,126,0.32)';
  const WHITE_78  = 'rgba(255,255,255,0.78)';
  const WHITE_55  = 'rgba(255,255,255,0.55)';
  const AMBER     = '#F59E0B';
  
  // ─── Types ────────────────────────────────────────────────────────────────────
  interface ProfileMini {
    avatar_url:   string;
    display_name: string;
    company_name: string;
    username:     string;
  }
  
  // ─── AVATAR ───────────────────────────────────────────────────────────────────
  const NavAvatar = memo(function NavAvatar({ profile }: { profile: ProfileMini | null }) {
    const [imgErr, setImgErr] = useState(false);
    useEffect(() => { setImgErr(false); }, [profile?.avatar_url]);
  
    const name     = profile?.company_name || profile?.display_name || profile?.username || '?';
    const initials = name.trim().split(/\s+/).map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
    const hasAvatar = !!(profile?.avatar_url) && !imgErr;
  
    return (
      <View style={ns.avatarWrap}>
        {hasAvatar ? (
          <Image
            source={{ uri: profile!.avatar_url }}
            style={ns.avatar}
            resizeMode="cover"
            onError={() => setImgErr(true)}
          />
        ) : (
          <View style={[ns.avatar, ns.monogram]}>
            <Text style={ns.mono}>{initials}</Text>
          </View>
        )}
        {/* Point vert "organisateur actif" */}
        <View style={ns.onlineDot}/>
      </View>
    );
  });
  
  // ─── NAV ITEM ─────────────────────────────────────────────────────────────────
  const NavItem = memo(function NavItem({
    icon, label, badge = 0, onPress,
  }: { icon: React.ReactNode; label?: string; badge?: number; onPress: () => void }) {
    return (
      <TouchableOpacity style={ns.item} onPress={onPress} activeOpacity={0.65}>
        <View style={{ position: 'relative' }}>
          {icon}
          {badge > 0 && (
            <View style={ns.badge}>
              <Text style={ns.badgeTxt}>{badge > 9 ? '9+' : badge}</Text>
            </View>
          )}
        </View>
        {!!label && <Text style={ns.label}>{label}</Text>}
      </TouchableOpacity>
    );
  });
  
  // ─── INNER ───────────────────────────────────────────────────────────────────
  function CustomNavBarInner() {
    const router = _useRouter!();
  
    const [profile,   setProfile]   = useState<ProfileMini | null>(null);
    const [uid,       setUid]       = useState<string | null>(null);
    const [pendingN,  setPendingN]  = useState(0);  // candidatures en attente
  
    const rtRef     = useRef<ReturnType<typeof supabase.channel> | null>(null);
    const mountId   = useRef(Date.now());
    const pollRef   = useRef<ReturnType<typeof setInterval> | null>(null);
    const lastDirty = useRef<string | null>(null);
  
    // ── Fetch profil organisateur ──────────────────────────────────────────────
    const loadProfile = useCallback(async (userId: string) => {
      try {
        const { data } = await supabase
          .from('profiles')
          .select('avatar_url,display_name,company_name,username')
          .eq('id', userId)
          .maybeSingle();
        if (data) {
          setProfile({
            avatar_url:   data.avatar_url                 ?? '',
            display_name: data.display_name               ?? '',
            company_name: (data as any).company_name      ?? '',
            username:     data.username                   ?? '',
          });
        }
      } catch {}
    }, []);
  
    // ── Candidatures en attente → badge Équipe ────────────────────────────────
    const loadPending = useCallback(async (userId: string) => {
      try {
        const { data: evts } = await supabase
          .from('events').select('id')
          .eq('organizer_id', userId).eq('status', 'published');
        if (!evts?.length) { setPendingN(0); return; }
        const evtIds = evts.map((e: any) => e.id);
        const { data: roles } = await supabase
          .from('event_roles').select('id').in('event_id', evtIds);
        if (!roles?.length) { setPendingN(0); return; }
        const { count } = await supabase
          .from('applications')
          .select('id', { count: 'exact', head: true })
          .in('event_role_id', roles.map((r: any) => r.id))
          .eq('status', 'pending');
        setPendingN(count ?? 0);
      } catch {}
    }, []);
  
    // ── ★ Init — supabase.auth.getSession() (remplace getDeviceId) ────────────
    useEffect(() => {
      let alive = true;
  
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (!alive) return;
        const userId = session?.user?.id;
        if (userId) {
          setUid(userId);
          loadProfile(userId);
          loadPending(userId);
        }
      });
  
      const { data: { subscription } } = supabase.auth.onAuthStateChange((_, s) => {
        const userId = s?.user?.id;
        if (userId) {
          setUid(userId);
          loadProfile(userId);
          loadPending(userId);
        }
      });
  
      return () => {
        alive = false;
        subscription.unsubscribe();
        if (rtRef.current)   { supabase.removeChannel(rtRef.current); rtRef.current  = null; }
        if (pollRef.current) { clearInterval(pollRef.current);        pollRef.current = null; }
      };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
  
    // ── ★ Realtime — profiles UPDATE + applications INSERT ────────────────────
    // Tous les .on() AVANT .subscribe() (évite "cannot add callbacks after subscribe")
    useEffect(() => {
      if (!uid) return;
      if (rtRef.current) { supabase.removeChannel(rtRef.current); rtRef.current = null; }
  
      rtRef.current = supabase
        .channel(`nav_${mountId.current}_${uid}`)
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${uid}` },
          ({ new: row }) => {
            const r = row as any;
            setProfile(prev => ({
              avatar_url:   r.avatar_url   ?? prev?.avatar_url   ?? '',
              display_name: r.display_name ?? prev?.display_name ?? '',
              company_name: r.company_name ?? prev?.company_name ?? '',
              username:     r.username     ?? prev?.username     ?? '',
            }));
          },
        )
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'applications' },
          () => { if (uid) loadPending(uid); },
        )
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'applications' },
          () => { if (uid) loadPending(uid); },
        )
        .subscribe();
  
      return () => {
        if (rtRef.current) { supabase.removeChannel(rtRef.current); rtRef.current = null; }
      };
    }, [uid, loadPending]);
  
    // ── ★ SecureStore polling (1.2s) — détecte save edit-profile.tsx ──────────
    // edit-profile.tsx écrit SecureStore('profile_dirty', timestamp) → re-fetch
    useEffect(() => {
      if (!uid || !SecureStore || Platform.OS === 'web') return;
  
      pollRef.current = setInterval(async () => {
        try {
          const val = await SecureStore.getItemAsync('profile_dirty');
          if (val && val !== lastDirty.current) {
            lastDirty.current = val;
            loadProfile(uid);
          }
        } catch {}
      }, 1200);
  
      return () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } };
    }, [uid, loadProfile]);
  
    const go = useCallback((path: string) => {
      try { router.push(path as any); } catch {}
    }, [router]);
  
    return (
      <View style={ns.bar}>
        <BlurView intensity={Platform.OS === 'ios' ? 40 : 20} tint="dark" style={ns.blur}>
  
          {/* ── Hub — tableau de bord missions ── */}
          <NavItem
            icon={<MaterialCommunityIcons name="view-dashboard-outline" size={22} color={WHITE_78}/>}
            label="Hub"
            onPress={() => go('/(organizer)/dashboard')}
          />
  
          {/* ── Talents — chercher du staff qualifié ── */}
          <NavItem
            icon={<MaterialCommunityIcons name="account-search-outline" size={23} color={WHITE_78}/>}
            label="Talents"
            onPress={() => go('/(organizer)/staff-search')}
          />
  
          {/* ── ✦ Bouton central — Poster une mission ── */}
          <TouchableOpacity style={ns.center} onPress={() => go('/(organizer)/create-event')} activeOpacity={0.75}>
            <MaterialCommunityIcons name="calendar-plus" size={28} color={GREEN}/>
          </TouchableOpacity>
  
          {/* ── Équipe — candidatures + recrutés (badge candidatures en attente) ── */}
          <NavItem
            badge={pendingN}
            icon={<MaterialCommunityIcons name="account-group-outline" size={23} color={WHITE_78}/>}
            label="Équipe"
            onPress={() => go('/(organizer)/applications')}
          />
  
          {/* ── Mon Agence — profil organisateur + avatar live ── */}
          <NavItem
            icon={
              profile?.avatar_url ? (
                <NavAvatar profile={profile}/>
              ) : (
                <MaterialCommunityIcons name="office-building-outline" size={24} color={WHITE_78}/>
              )
            }
            label="Agence"
            onPress={() => go('/(organizer)/profile')}
          />
  
        </BlurView>
      </View>
    );
  }
  
  // ─── EXPORT — monté après 1 tick ──────────────────────────────────────────────
  function CustomNavBar() {
    const [ready, setReady] = useState(false);
    useEffect(() => {
      const t = setTimeout(() => setReady(true), 0);
      return () => clearTimeout(t);
    }, []);
    if (!ready || !_useRouter) return null;
    return <CustomNavBarInner/>;
  }
  
  export default memo(CustomNavBar);
  
  // ─── STYLES — floating pill identique Universe v4, accent vert ───────────────
  const ns = StyleSheet.create({
    bar: {
      position:     'absolute',
      bottom:        12,
      left:          10,
      right:         10,
      height:        66,
      borderRadius:  20,
      overflow:     'hidden',
      borderWidth:   StyleSheet.hairlineWidth,
      borderColor:  'rgba(0,217,126,0.10)',
    },
    blur: {
      flex:               1,
      flexDirection:     'row',
      justifyContent:    'space-around',
      alignItems:        'center',
      paddingHorizontal:  8,
      backgroundColor:   'rgba(2,10,6,0.30)',
    },
    item: {
      alignItems:        'center',
      justifyContent:    'center',
      height:            '100%',
      paddingTop:         6,
      paddingHorizontal:  6,
    },
    label: {
      color:         WHITE_55,
      fontSize:       9.5,
      marginTop:      3,
      fontWeight:    '500',
      letterSpacing:  0.2,
    },
    // Bouton central — cercle vert (remplace star-four-points blanc Universe)
    center: {
      width:           52,
      height:          52,
      borderRadius:    26,
      alignItems:      'center',
      justifyContent:  'center',
      backgroundColor: GREEN_DIM,
      borderWidth:     1.5,
      borderColor:     GREEN_BD,
    },
    // Badge candidatures en attente
    badge: {
      position:        'absolute',
      top:             -3,
      right:           -5,
      minWidth:         14,
      height:           14,
      borderRadius:     7,
      backgroundColor:  AMBER,
      alignItems:      'center',
      justifyContent:  'center',
      paddingHorizontal:2,
    },
    badgeTxt: {
      color:      '#020A06',
      fontSize:    6.5,
      fontWeight: '900',
    },
    // Avatar
    avatarWrap: { width: 26, height: 26, position: 'relative' },
    avatar:     { width: 26, height: 26, borderRadius: 13 },
    monogram:   { backgroundColor: 'rgba(0,217,126,0.18)', alignItems: 'center', justifyContent: 'center' },
    mono:       { color: GREEN, fontSize: 9, fontWeight: '900' },
    onlineDot:  {
      position:        'absolute',
      bottom:           0,
      right:            0,
      width:            7,
      height:           7,
      borderRadius:     3.5,
      backgroundColor:  GREEN,
      borderWidth:      1.5,
      borderColor:     '#020A06',
    },
  });