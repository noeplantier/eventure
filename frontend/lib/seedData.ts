/**
 * lib/seedData.ts — Eventure v3
 *
 * Injecte des données de démo dans Supabase.
 * Appelé automatiquement au premier lancement (via mockUser.ts).
 *
 * Usage manuel :
 *   import { seedAll, clearSeed } from '@/lib/seedData';
 *   await seedAll(organizerId);
 *   await clearSeed();
 */
import { supabase } from './supabase';

/* ─── Staff demo ─────────────────────────────────────────────────────────── */

const SEED_STAFFS = [
  {
    display_name    : 'Alice Martin',
    role            : ['Sécurité', 'Gestion foule'],
    hourly_rate     : 15,
    rating          : 4.8,
    is_available    : true,
    experience_years: 5,
    bio             : 'Agent de sécurité certifiée, 5 ans d\'expérience en événementiel.',
  },
  {
    display_name    : 'Benoît Leclair',
    role            : ['Barman', 'Service VIP'],
    hourly_rate     : 13,
    rating          : 4.6,
    is_available    : true,
    experience_years: 3,
    bio             : 'Barman professionnel, spécialiste cocktails et service VIP.',
  },
  {
    display_name    : 'Camille Dupont',
    role            : ['Régisseur', 'Logistique'],
    hourly_rate     : 18,
    rating          : 4.9,
    is_available    : true,
    experience_years: 7,
    bio             : 'Régisseur scénique avec expertise festivals et concerts.',
  },
  {
    display_name    : 'David Nguyen',
    role            : ['Photographe', 'Vidéaste'],
    hourly_rate     : 22,
    rating          : 4.7,
    is_available    : true,
    experience_years: 4,
    bio             : 'Photographe/vidéaste événementiel freelance.',
  },
  {
    display_name    : 'Emma Bernard',
    role            : ['Hôtesse', 'Accueil'],
    hourly_rate     : 12,
    rating          : 4.4,
    is_available    : false,
    experience_years: 2,
    bio             : 'Hôtesse d\'accueil bilingue français/anglais.',
  },
  {
    display_name    : 'François Petit',
    role            : ['Technicien son', 'Éclairage'],
    hourly_rate     : 20,
    rating          : 4.5,
    is_available    : true,
    experience_years: 6,
    bio             : 'Technicien son et lumière, maîtrise régie numérique.',
  },
];

/* ─── Events demo ────────────────────────────────────────────────────────── */

function makeSeedEvents(organizerId: string) {
  const now = new Date();
  const d   = (offsetDays: number, offsetHours = 0) =>
    new Date(now.getTime() + offsetDays * 864e5 + offsetHours * 36e5).toISOString();

  return [
    {
      title       : '[SEED] Gala de Noël 2026',
      type        : 'Gala',
      date_start  : d(7),
      date_end    : d(7, 5),
      location    : 'Paris, Grande Salle Riviera',
      budget      : 12000,
      description : 'Soirée annuelle pour 250 collaborateurs avec dîner de gala et animations.',
      status      : 'published' as const,
      organizer_id: organizerId,
    },
    {
      title       : '[SEED] Festival Électro Summer',
      type        : 'Festival',
      date_start  : d(30),
      date_end    : d(32),
      location    : 'Lyon, Parc de la Tête d\'Or',
      budget      : 45000,
      description : 'Festival 2 jours, 3 scènes, artistes electro/house.',
      status      : 'published' as const,
      organizer_id: organizerId,
    },
    {
      title       : '[SEED] Conférence Tech & IA',
      type        : 'Conférence',
      date_start  : d(14),
      date_end    : d(14, 8),
      location    : 'Bordeaux, Cité du Vin',
      budget      : 8000,
      description : 'Conférence annuelle sur l\'intelligence artificielle et la tech.',
      status      : 'draft' as const,
      organizer_id: organizerId,
    },
  ];
}

/* ─── Event roles demo ───────────────────────────────────────────────────── */

function makeSeedRoles(eventIds: string[]) {
  const [galaId, festId, confId] = eventIds;
  return [
    { event_id: galaId, role: 'Sécurité',    slots: 4, hourly_rate: 15, requirements: 'SSIAP 1 requis' },
    { event_id: galaId, role: 'Barman',       slots: 3, hourly_rate: 13, requirements: 'Expérience service VIP' },
    { event_id: festId, role: 'Régisseur',    slots: 2, hourly_rate: 18, requirements: 'Expérience festival obligatoire' },
    { event_id: festId, role: 'Technicien',   slots: 4, hourly_rate: 20, requirements: 'Maîtrise console numérique' },
    { event_id: confId, role: 'Hôtesse',      slots: 2, hourly_rate: 12, requirements: 'Bilingue FR/EN' },
    { event_id: confId, role: 'Photographe',  slots: 1, hourly_rate: 22, requirements: 'Portfolio événementiel requis' },
  ].filter(r => r.event_id); // skip if eventIds too short
}

/* ─── Seed state ─────────────────────────────────────────────────────────── */

let _staffIds  : string[] = [];
let _eventIds  : string[] = [];
let _roleIds   : string[] = [];
let _appIds    : string[] = [];
let _missionIds: string[] = [];

/* ─── Public API ─────────────────────────────────────────────────────────── */

export async function seedAll(organizerId: string): Promise<{
  staffIds: string[]; eventIds: string[]; errors: string[];
}> {
  const errors: string[] = [];

  // 1. Staff
  const { data: staffData, error: staffErr } = await supabase
    .from('staff')
    .insert(SEED_STAFFS)
    .select('id');
  if (staffErr) errors.push(`staff: ${staffErr.message}`);
  _staffIds = (staffData ?? []).map((s: { id: string }) => s.id);

  // 2. Events
  const { data: eventData, error: eventErr } = await supabase
    .from('events')
    .insert(makeSeedEvents(organizerId))
    .select('id');
  if (eventErr) errors.push(`events: ${eventErr.message}`);
  _eventIds = (eventData ?? []).map((e: { id: string }) => e.id);

  // 3. Event roles (needs events)
  if (_eventIds.length >= 2) {
    const roles = makeSeedRoles(_eventIds);
    const { data: roleData, error: roleErr } = await supabase
      .from('event_roles')
      .insert(roles)
      .select('id');
    if (roleErr) errors.push(`event_roles: ${roleErr.message}`);
    _roleIds = (roleData ?? []).map((r: { id: string }) => r.id);
  }

  // 4. Applications (staff apply to event roles)
  if (_roleIds.length >= 2 && _staffIds.length >= 4) {
    const apps = [
      { event_role_id: _roleIds[0], staff_id: _staffIds[0], status: 'pending',  message: 'Disponible et motivé !', applied_at: new Date(Date.now() - 2 * 864e5).toISOString() },
      { event_role_id: _roleIds[0], staff_id: _staffIds[1], status: 'accepted', message: 'Expérience similaire l\'an dernier.', applied_at: new Date(Date.now() - 3 * 864e5).toISOString(), reviewed_at: new Date(Date.now() - 1 * 864e5).toISOString() },
      { event_role_id: _roleIds[1], staff_id: _staffIds[2], status: 'pending',  message: 'Parfaitement qualifié.', applied_at: new Date(Date.now() - 1 * 864e5).toISOString() },
      { event_role_id: _roleIds[2], staff_id: _staffIds[3], status: 'accepted', message: 'Ravi de participer.', applied_at: new Date(Date.now() - 4 * 864e5).toISOString(), reviewed_at: new Date(Date.now() - 2 * 864e5).toISOString() },
      { event_role_id: _roleIds[3], staff_id: _staffIds[4], status: 'rejected', message: 'Je suis disponible.', reject_reason: 'Profil ne correspond pas', applied_at: new Date(Date.now() - 5 * 864e5).toISOString(), reviewed_at: new Date(Date.now() - 3 * 864e5).toISOString() },
      { event_role_id: _roleIds[4], staff_id: _staffIds[5], status: 'pending',  message: 'Intéressé par cette mission.', applied_at: new Date(Date.now() - 6 * 3600e3).toISOString() },
    ];
    const { data: appData, error: appErr } = await supabase
      .from('applications')
      .insert(apps)
      .select('id');
    if (appErr) errors.push(`applications: ${appErr.message}`);
    _appIds = (appData ?? []).map((a: { id: string }) => a.id);
  }

  // 5. Missions (accepted applications become missions)
  if (_eventIds.length >= 2 && _staffIds.length >= 4) {
    const pastDate = (offsetDays: number) =>
      new Date(Date.now() - offsetDays * 864e5).toISOString();

    const missions = [
      {
        event_id      : _eventIds[0],
        staff_id      : _staffIds[1],
        application_id: _appIds[1] ?? null,
        check_in      : pastDate(10),
        check_out     : new Date(new Date(pastDate(10)).getTime() + 6 * 36e5).toISOString(),
        hours_worked  : 6,
        amount_due    : 78,
        amount_paid   : 78,
        payment_status: 'paid' as const,
      },
      {
        event_id      : _eventIds[1],
        staff_id      : _staffIds[3],
        application_id: _appIds[3] ?? null,
        check_in      : pastDate(5),
        check_out     : new Date(new Date(pastDate(5)).getTime() + 8 * 36e5).toISOString(),
        hours_worked  : 8,
        amount_due    : 160,
        amount_paid   : 0,
        payment_status: 'pending' as const,
      },
      {
        event_id      : _eventIds[0],
        staff_id      : _staffIds[2],
        application_id: null,
        check_in      : pastDate(3),
        check_out     : new Date(new Date(pastDate(3)).getTime() + 7 * 36e5).toISOString(),
        hours_worked  : 7,
        amount_due    : 126,
        amount_paid   : 63,
        payment_status: 'partial' as const,
      },
    ];

    const { data: missionData, error: missionErr } = await supabase
      .from('missions')
      .insert(missions)
      .select('id');
    if (missionErr) errors.push(`missions: ${missionErr.message}`);
    _missionIds = (missionData ?? []).map((m: { id: string }) => m.id);
  }

  return { staffIds: _staffIds, eventIds: _eventIds, errors };
}

export async function clearSeed(): Promise<string[]> {
  const errors: string[] = [];

  const del = async (table: string, ids: string[], ref: string[]) => {
    if (!ids.length) return;
    const { error } = await supabase.from(table).delete().in('id', ids);
    if (error) errors.push(`clear ${table}: ${error.message}`);
    else ref.length = 0;
  };

  await del('missions',     _missionIds, _missionIds);
  await del('applications', _appIds,     _appIds);
  await del('event_roles',  _roleIds,    _roleIds);
  await del('events',       _eventIds,   _eventIds);
  await del('staff',        _staffIds,   _staffIds);

  return errors;
}
