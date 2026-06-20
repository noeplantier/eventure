/**
 * lib/mockUser.ts — Eventure v3
 *
 * Fournit un user fictif persisté pour éviter le blocage auth en dev.
 * Auto-seed au premier lancement : crée l'organisateur + insère des données démo.
 *
 * Usage : const uid = await getWorkingUid();
 * Priorité : session Supabase réelle > refresh > getUser > mock UUID persisté
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase }  from './supabase';
import { seedAll }   from './seedData';

const MOCK_UID_KEY   = '@eventure:mock_uid';
const MOCK_ORG_KEY   = '@eventure:mock_org_id';
const SEED_DONE_KEY  = '@eventure:seed_done';

let _seedingInProgress = false;

/** Génère un UUID v4 simple */
function uuidv4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/** Retourne un UUID persisté (constant across restarts) */
async function getMockUid(): Promise<string> {
  try {
    const stored = await AsyncStorage.getItem(MOCK_UID_KEY);
    if (stored) return stored;
    const fresh = uuidv4();
    await AsyncStorage.setItem(MOCK_UID_KEY, fresh);
    return fresh;
  } catch {
    return uuidv4();
  }
}

/**
 * Récupère l'UID utilisateur avec 3 niveaux de fallback :
 *   1. Session Supabase en cache
 *   2. Refresh token
 *   3. getUser() server round-trip
 *   4. Mock UUID persisté (NO-AUTH dev mode)
 */
export async function getWorkingUid(): Promise<string> {
  try {
    const { data: s1 } = await supabase.auth.getSession();
    if (s1.session?.user?.id) return s1.session.user.id;

    const { data: s2 } = await supabase.auth.refreshSession();
    if (s2.session?.user?.id) return s2.session.user.id;

    const { data: s3 } = await supabase.auth.getUser();
    if (s3.user?.id) return s3.user.id;
  } catch {}

  return getMockUid();
}

/**
 * Retourne l'ID de l'organisateur (row dans la table organizers).
 * Crée l'entrée + seed les données démo si premier lancement.
 */
export async function getWorkingOrganizerId(): Promise<string | null> {
  try {
    const uid = await getWorkingUid();

    // Check si l'organisateur existe déjà
    const { data: existing } = await supabase
      .from('organizers')
      .select('id')
      .eq('id', uid)
      .maybeSingle();

    if (existing?.id) return existing.id;

    // Créer la row organisateur demo (pas de FK auth.users dans la nouvelle SQL)
    const { data: created, error } = await supabase
      .from('organizers')
      .insert({
        id          : uid,
        display_name: 'Demo Organisateur',
        company_name: 'Eventure Demo',
        verified    : false,
        events_count: 0,
        rating      : 4.5,
        bio         : 'Organisateur événementiel passionné, spécialisé en festivals et galas.',
        specialties : ['Festival', 'Gala', 'Conférence'],
      })
      .select('id')
      .single();

    if (error) {
      console.warn('[mockUser] Impossible de créer l\'organisateur:', error.message);
      return uid;
    }

    // Seed des données démo — awaité pour que les pages voient les données dès le 1er affichage
    if (!_seedingInProgress) {
      _seedingInProgress = true;
      try {
        const { errors } = await seedAll(uid);
        if (errors.length > 0) console.warn('[mockUser] Seed partiel:', errors);
      } catch (e) {
        console.warn('[mockUser] Seed error:', e);
      } finally {
        _seedingInProgress = false;
      }
    }

    await AsyncStorage.setItem(MOCK_ORG_KEY, created?.id ?? uid);
    return created?.id ?? uid;
  } catch (e) {
    console.warn('[mockUser] getWorkingOrganizerId error:', e);
    return null;
  }
}

/**
 * Réinitialise le seed (utile pour relancer la démo depuis zéro).
 * Appeler depuis un bouton debug dans les settings.
 */
export async function resetSeed(): Promise<void> {
  await AsyncStorage.multiRemove([MOCK_UID_KEY, MOCK_ORG_KEY, SEED_DONE_KEY]);
}

/** Mock user object for display purposes */
export const MOCK_USER = {
  email  : 'demo@eventure.app',
  name   : 'Demo Organisateur',
  company: 'Eventure Demo',
  role   : 'organizer' as const,
  avatar : null as string | null,
};
