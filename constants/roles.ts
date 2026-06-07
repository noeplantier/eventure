// constants/roles.ts — Catalogue des rôles métier
export const ROLES_CATALOGUE = [
  'Serveur·se', 'Barman / Barmaid', 'Chef de rang',
  "Hôte·sse d'accueil", 'Agent de sécurité', 'Coordinateur·rice',
  'Runner', 'Sommelier·ère', 'Valet parking',
  'Technicien·ne son/lumière', 'Photographe', 'Vidéaste',
] as const;

export const EVENT_TYPES = [
  { key:'wedding',   label:'Mariage',    icon:'heart-outline'         },
  { key:'corporate', label:'Corporate',  icon:'business-outline'      },
  { key:'concert',   label:'Concert',    icon:'musical-notes-outline' },
  { key:'sport',     label:'Sport',      icon:'trophy-outline'        },
  { key:'gala',      label:'Gala',       icon:'sparkles-outline'      },
  { key:'festival',  label:'Festival',   icon:'color-palette-outline' },
  { key:'private',   label:'Privé',      icon:'home-outline'          },
  { key:'other',     label:'Autre',      icon:'calendar-outline'      },
] as const;

export const ROLE_ICONS: Record<string, string> = {
  'Serveur·se':            'restaurant-outline',
  'Barman / Barmaid':      'beer-outline',
  'Chef de rang':          'star-outline',
  "Hôte·sse d'accueil":   'person-outline',
  'Agent de sécurité':     'shield-outline',
  'Coordinateur·rice':     'clipboard-outline',
  'Runner':                'walk-outline',
  'Sommelier·ère':         'wine-outline',
  'Valet parking':         'car-outline',
  'Technicien·ne son/lumière':'musical-note-outline',
  'Photographe':           'camera-outline',
  'Vidéaste':              'videocam-outline',
};
