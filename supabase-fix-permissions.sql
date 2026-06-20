-- ═══════════════════════════════════════════════════════════════════════════
-- EVENTURE — SQL v2 CLEAN — Supabase SQL Editor
-- IMPORTANT : coller intégralement dans SQL Editor > Run
-- Corrige définitivement les 404 / PGRST205
-- Supprime la contrainte auth.users, désactive RLS pour le dev
-- ═══════════════════════════════════════════════════════════════════════════

-- Extension UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─────────────────────────────────────────────────────────────────────────
-- ÉTAPE 1 — Supprimer les anciennes tables (ordre inverse des FK)
-- ─────────────────────────────────────────────────────────────────────────

DROP VIEW  IF EXISTS public.v_application_details;
DROP TABLE IF EXISTS public.reviews        CASCADE;
DROP TABLE IF EXISTS public.missions       CASCADE;
DROP TABLE IF EXISTS public.applications   CASCADE;
DROP TABLE IF EXISTS public.event_roles    CASCADE;
DROP TABLE IF EXISTS public.events         CASCADE;
DROP TABLE IF EXISTS public.organizers     CASCADE;
DROP TABLE IF EXISTS public.staff          CASCADE;

-- ─────────────────────────────────────────────────────────────────────────
-- ÉTAPE 2 — Recréer les tables SANS contrainte auth.users
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE public.organizers (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name  text,
  company_name  text,
  contact_name  text,
  phone         text,
  avatar_url    text,
  bio           text,
  website       text,
  specialties   text[],
  rating        numeric(2,1) DEFAULT 0,
  events_count  int          DEFAULT 0,
  verified      boolean      DEFAULT false,
  siret         text,
  created_at    timestamptz  DEFAULT now(),
  updated_at    timestamptz  DEFAULT now()
);

CREATE TABLE public.staff (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name     text,
  avatar_url       text,
  bio              text,
  role             text[],
  hourly_rate      numeric(6,2),
  experience_years int,
  location         text,
  latitude         float,
  longitude        float,
  rating           numeric(2,1) DEFAULT 0,
  missions_count   int          DEFAULT 0,
  is_available     boolean      DEFAULT true,
  stripe_account   text,
  verified         boolean      DEFAULT false,
  created_at       timestamptz  DEFAULT now(),
  updated_at       timestamptz  DEFAULT now()
);

CREATE TABLE public.events (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizer_id  uuid         REFERENCES public.organizers(id) ON DELETE CASCADE,
  title         text         NOT NULL,
  description   text,
  location      text         NOT NULL DEFAULT '',
  latitude      float,
  longitude     float,
  date_start    timestamptz  NOT NULL,
  date_end      timestamptz  NOT NULL,
  type          text,
  status        text         DEFAULT 'draft',
  budget        numeric,
  cover_url     text,
  created_at    timestamptz  DEFAULT now(),
  updated_at    timestamptz  DEFAULT now()
);

CREATE TABLE public.event_roles (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id     uuid         REFERENCES public.events(id) ON DELETE CASCADE,
  role         text         NOT NULL,
  slots        int          NOT NULL DEFAULT 1,
  slots_filled int          DEFAULT 0,
  hourly_rate  numeric(6,2),
  dress_code   text,
  requirements text,
  created_at   timestamptz  DEFAULT now()
);

CREATE TABLE public.applications (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_role_id uuid         REFERENCES public.event_roles(id) ON DELETE CASCADE,
  staff_id      uuid         REFERENCES public.staff(id) ON DELETE CASCADE,
  status        text         DEFAULT 'pending',
  message       text,
  reject_reason text,
  applied_at    timestamptz  DEFAULT now(),
  reviewed_at   timestamptz,
  UNIQUE(event_role_id, staff_id)
);

CREATE TABLE public.missions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id  uuid         REFERENCES public.applications(id) ON DELETE SET NULL,
  staff_id        uuid         REFERENCES public.staff(id) ON DELETE SET NULL,
  event_id        uuid         REFERENCES public.events(id) ON DELETE CASCADE,
  check_in        timestamptz,
  check_out       timestamptz,
  hours_worked    numeric(4,2),
  amount_due      numeric(8,2),
  amount_paid     numeric(8,2) DEFAULT 0,
  payment_status  text         DEFAULT 'pending',
  stripe_transfer text,
  created_at      timestamptz  DEFAULT now(),
  updated_at      timestamptz  DEFAULT now()
);

CREATE TABLE public.reviews (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id  uuid         REFERENCES public.missions(id) ON DELETE CASCADE,
  reviewer_id uuid,
  reviewee_id uuid,
  rating      int          CHECK (rating BETWEEN 1 AND 5),
  comment     text,
  created_at  timestamptz  DEFAULT now(),
  UNIQUE(mission_id, reviewer_id)
);

-- ─────────────────────────────────────────────────────────────────────────
-- ÉTAPE 3 — Accès schéma (critique pour PGRST205)
-- ─────────────────────────────────────────────────────────────────────────

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────
-- ÉTAPE 4 — Grants complets sur toutes les tables
-- ─────────────────────────────────────────────────────────────────────────

GRANT ALL ON public.organizers   TO anon, authenticated, service_role;
GRANT ALL ON public.staff        TO anon, authenticated, service_role;
GRANT ALL ON public.events       TO anon, authenticated, service_role;
GRANT ALL ON public.event_roles  TO anon, authenticated, service_role;
GRANT ALL ON public.applications TO anon, authenticated, service_role;
GRANT ALL ON public.missions     TO anon, authenticated, service_role;
GRANT ALL ON public.reviews      TO anon, authenticated, service_role;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────
-- ÉTAPE 5 — Désactiver RLS (accès total pour dev / demo sans auth)
-- ─────────────────────────────────────────────────────────────────────────

ALTER TABLE public.organizers   DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff        DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.events       DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_roles  DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.applications DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.missions     DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews      DISABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────────────────
-- ÉTAPE 6 — Vue dénormalisée v_application_details
-- ─────────────────────────────────────────────────────────────────────────

CREATE VIEW public.v_application_details AS
SELECT
  a.id,
  a.status,
  a.message,
  a.reject_reason,
  a.applied_at,
  a.reviewed_at,
  er.role,
  er.hourly_rate,
  er.slots,
  er.slots_filled,
  er.event_id,
  e.title       AS event_title,
  e.date_start,
  e.location    AS event_location,
  e.organizer_id,
  a.staff_id,
  s.display_name AS staff_name,
  s.avatar_url   AS staff_avatar,
  s.rating       AS staff_rating,
  s.missions_count,
  s.experience_years,
  s.bio          AS staff_bio
FROM public.applications  a
JOIN public.event_roles   er ON er.id = a.event_role_id
JOIN public.events        e  ON e.id  = er.event_id
JOIN public.staff         s  ON s.id  = a.staff_id;

GRANT SELECT ON public.v_application_details TO anon, authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────
-- ÉTAPE 7 — Trigger updated_at automatique
-- ─────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['organizers','staff','events','missions']
  LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_updated_at ON public.%I;
       CREATE TRIGGER trg_updated_at
         BEFORE UPDATE ON public.%I
         FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();',
      t, t
    );
  END LOOP;
END $$;

-- ─────────────────────────────────────────────────────────────────────────
-- ÉTAPE 8 — Rafraîchir le cache PostgREST (corrige PGRST205)
-- ─────────────────────────────────────────────────────────────────────────

NOTIFY pgrst, 'reload schema';

-- ═══════════════════════════════════════════════════════════════════════════
-- VÉRIFICATION — exécuter après pour confirmer :
--   SELECT table_name FROM information_schema.tables
--   WHERE table_schema = 'public' ORDER BY table_name;
-- ═══════════════════════════════════════════════════════════════════════════
