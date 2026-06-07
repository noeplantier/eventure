/**
 * lib/mockData.ts
 * Données factices — utilisées quand EXPO_PUBLIC_MOCK_MODE=true
 * L'app fonctionne intégralement sans Supabase en mode mock.
 */

export const MOCK_USER = {
  id:           'mock-user-001',
  email:        'hugo@eventure.app',
  display_name: 'Hugo Chassaing',
  username:     'hugo.chassaing',
  avatar_url:   'https://i.pravatar.cc/150?img=33',
  role:         'organizer',   // 'organizer' | 'staff'
  is_pro:       true,
};

export const MOCK_STAFF = [
  { id:'s1', display_name:'Lucie Martin',    avatar_url:'https://i.pravatar.cc/60?img=9',  role:['Serveur·se','Barman / Barmaid'], hourly_rate:16, rating:4.8, missions_count:34, location:'Paris 11e', is_available:true  },
  { id:'s2', display_name:'Marc Lefebvre',   avatar_url:'https://i.pravatar.cc/60?img=12', role:['Agent de sécurité'],              hourly_rate:18, rating:4.6, missions_count:21, location:'Paris 8e',  is_available:true  },
  { id:'s3', display_name:'Anaëlle Cornu',   avatar_url:'https://i.pravatar.cc/60?img=22', role:["Hôte·sse d'accueil",'Coordinateur·rice'], hourly_rate:15, rating:4.9, missions_count:52, location:'Boulogne', is_available:false },
  { id:'s4', display_name:'Thomas Garnier',  avatar_url:'https://i.pravatar.cc/60?img=33', role:['Barman / Barmaid','Sommelier·ère'], hourly_rate:17, rating:4.7, missions_count:28, location:'Paris 3e',  is_available:true  },
  { id:'s5', display_name:'Sophie Artaud',   avatar_url:'https://i.pravatar.cc/60?img=47', role:['Photographe','Vidéaste'],          hourly_rate:45, rating:5.0, missions_count:12, location:'Paris 2e',  is_available:true  },
];

export const MOCK_EVENTS = [
  {
    id:          'e1',
    title:       'Gala Annuel Société Vinci',
    description: 'Dîner de gala pour 250 personnes au Grand Palais. Ambiance luxe, service 5 étoiles requis.',
    location:    'Grand Palais, Paris 8e',
    latitude:    48.8660,
    longitude:   2.3133,
    date_start:  new Date(Date.now() + 7*24*3600*1000).toISOString(),
    date_end:    new Date(Date.now() + 7*24*3600*1000 + 5*3600*1000).toISOString(),
    type:        'gala',
    status:      'published',
    cover_url:   'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=800&q=80',
    distance_km: 2.4,
    organizer:   { company_name:'Vinci Events', avatar_url:'https://i.pravatar.cc/40?img=50', rating:4.8 },
    roles: [
      { id:'r1', role:'Serveur·se',   slots:8, slots_filled:3, hourly_rate:16, dress_code:'Tenue noire ceinture blanche' },
      { id:'r2', role:'Barman / Barmaid', slots:3, slots_filled:1, hourly_rate:18, dress_code:'Chemise blanche nœud papillon' },
      { id:'r3', role:"Hôte·sse d'accueil", slots:4, slots_filled:4, hourly_rate:15, dress_code:'Robe noire fournie' },
    ],
  },
  {
    id:          'e2',
    title:       'Conférence Tech Summit 2025',
    description: 'Conférence internationale 500 personnes. Accueil, vestiaire, coordination salle.',
    location:    'Palais des Congrès, Paris 17e',
    latitude:    48.8783,
    longitude:   2.2826,
    date_start:  new Date(Date.now() + 14*24*3600*1000).toISOString(),
    date_end:    new Date(Date.now() + 14*24*3600*1000 + 8*3600*1000).toISOString(),
    type:        'corporate',
    status:      'published',
    cover_url:   'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800&q=80',
    distance_km: 5.1,
    organizer:   { company_name:'TechEvents Paris', avatar_url:'https://i.pravatar.cc/40?img=60', rating:4.5 },
    roles: [
      { id:'r4', role:"Hôte·sse d'accueil", slots:6, slots_filled:2, hourly_rate:15, dress_code:'Tenue fournie bleue' },
      { id:'r5', role:'Agent de sécurité',  slots:4, slots_filled:0, hourly_rate:19, dress_code:'Costume noir' },
      { id:'r6', role:'Runner',             slots:5, slots_filled:5, hourly_rate:14, dress_code:'Polo gris' },
    ],
  },
  {
    id:          'e3',
    title:       'Mariage Dupont × Leroy',
    description: 'Mariage 120 personnes au château. Service dîner + cocktail.',
    location:    'Château de Vaux-le-Vicomte, Maincy',
    latitude:    48.5676,
    longitude:   2.7128,
    date_start:  new Date(Date.now() + 21*24*3600*1000).toISOString(),
    date_end:    new Date(Date.now() + 21*24*3600*1000 + 7*3600*1000).toISOString(),
    type:        'wedding',
    status:      'published',
    cover_url:   'https://images.unsplash.com/photo-1519741497674-611481863552?w=800&q=80',
    distance_km: 52,
    organizer:   { company_name:'Dupont Family', avatar_url:'https://i.pravatar.cc/40?img=70', rating:4.2 },
    roles: [
      { id:'r7', role:'Serveur·se',         slots:5, slots_filled:2, hourly_rate:17, dress_code:'Smoking noir' },
      { id:'r8', role:'Sommelier·ère',      slots:2, slots_filled:0, hourly_rate:22, dress_code:'Tablier blanc' },
      { id:'r9', role:'Photographe',        slots:1, slots_filled:1, hourly_rate:50, dress_code:'Libre' },
    ],
  },
  {
    id:          'e4',
    title:       'Concert Coldplay — Stade de France',
    description: 'Mission concert 70 000 personnes. Sécurité, placement public, gestion flux.',
    location:    'Stade de France, Saint-Denis',
    latitude:    48.9244,
    longitude:   2.3601,
    date_start:  new Date(Date.now() + 3*24*3600*1000).toISOString(),
    date_end:    new Date(Date.now() + 3*24*3600*1000 + 6*3600*1000).toISOString(),
    type:        'concert',
    status:      'published',
    cover_url:   'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=800&q=80',
    distance_km: 8.7,
    organizer:   { company_name:'Live Nation France', avatar_url:'https://i.pravatar.cc/40?img=80', rating:4.9 },
    roles: [
      { id:'r10', role:'Agent de sécurité', slots:40, slots_filled:32, hourly_rate:20, dress_code:'Gilet jaune fourni' },
      { id:'r11', role:'Coordinateur·rice', slots:8,  slots_filled:5,  hourly_rate:22, dress_code:'Badge + polo LN' },
    ],
  },
  {
    id:          'e5',
    title:       'Brouillon — Festival Été 2025',
    description: 'Festival 3 jours en cours de préparation.',
    location:    'À définir',
    date_start:  new Date(Date.now() + 60*24*3600*1000).toISOString(),
    date_end:    new Date(Date.now() + 63*24*3600*1000).toISOString(),
    type:        'festival',
    status:      'draft',
    organizer:   { company_name:'Hugo Chassaing', rating:0 },
    roles: [
      { id:'r12', role:'Serveur·se', slots:20, slots_filled:0, hourly_rate:15, dress_code:'' },
    ],
  },
];

export const MOCK_APPLICATIONS = [
  { id:'a1', event_role_id:'r1', staff_id:'s1', status:'pending',  applied_at:new Date(Date.now()-2*3600*1000).toISOString(), staff:MOCK_STAFF[0] },
  { id:'a2', event_role_id:'r1', staff_id:'s4', status:'pending',  applied_at:new Date(Date.now()-5*3600*1000).toISOString(), staff:MOCK_STAFF[3] },
  { id:'a3', event_role_id:'r2', staff_id:'s2', status:'accepted', applied_at:new Date(Date.now()-24*3600*1000).toISOString(), staff:MOCK_STAFF[1] },
  { id:'a4', event_role_id:'r4', staff_id:'s3', status:'rejected', applied_at:new Date(Date.now()-48*3600*1000).toISOString(), staff:MOCK_STAFF[2] },
];

export const MOCK_MISSIONS = [
  { id:'m1', staff_id:'s1', event_id:'e1', check_in:null, check_out:null, hours_worked:0, amount_due:80, payment_status:'pending' },
];

export const MOCK_STATS = {
  organizer: { active:4, pending:2, hired:47, revenue:8420 },
  staff:     { missions_done:12, earnings_month:1840, rating:4.8, upcoming:2 },
};
