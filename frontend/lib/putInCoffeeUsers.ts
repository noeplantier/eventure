// Put.in Coffee — 3 fixed users, no Supabase auth needed
export type AppRole = 'organizer' | 'staff';

export interface AppUser {
  id        : string;
  name      : string;
  role      : AppRole;
  pin       : string;
  staffId   : string;
  color     : string;
  avatarUrl : string;
  venue     : string;
  title     : string;
}

export const PUT_IN_COFFEE_USERS: AppUser[] = [
  {
    id: 'arik-pu', name: 'Arik', role: 'organizer',
    pin: '1234', staffId: '96703ac8-0ceb-4653-9f94-013989fbd0c7',
    color: '#6366F1',
    avatarUrl: 'https://ui-avatars.com/api/?name=Arik&background=6366F1&color=fff&size=200&bold=true',
    venue: 'Put.in Coffee', title: 'Gérant',
  },
  {
    id: 'oka-pu', name: 'Oka', role: 'staff',
    pin: '1111', staffId: 'c49ef2fa-7041-4ef8-988a-a3059f762744',
    color: '#10B981',
    avatarUrl: 'https://ui-avatars.com/api/?name=Oka&background=10B981&color=fff&size=200&bold=true',
    venue: 'Put.in Coffee', title: 'Barman',
  },
  {
    id: 'redo-pu', name: 'Redo', role: 'staff',
    pin: '2222', staffId: '6e3961b2-dcb8-4849-ab5f-613c20ab80b2',
    color: '#8B5CF6',
    avatarUrl: 'https://ui-avatars.com/api/?name=Redo&background=8B5CF6&color=fff&size=200&bold=true',
    venue: 'Put.in Coffee', title: 'Serveur',
  },
];

export const AUTH_STORAGE_KEY = 'pu_current_user';
