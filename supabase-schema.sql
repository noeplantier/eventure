-- ─────────────────────────────────────────────────────────────────────────────
-- EVENTURE — Schéma Supabase
-- À exécuter dans : Supabase > SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE organizers (
  id            uuid PRIMARY KEY REFERENCES auth.users,
  company_name  text, contact_name text, phone text,
  avatar_url    text, rating numeric(2,1) DEFAULT 0,
  events_count  int DEFAULT 0, verified boolean DEFAULT false,
  siret         text, created_at timestamptz DEFAULT now()
);

CREATE TABLE staff (
  id              uuid PRIMARY KEY REFERENCES auth.users,
  display_name    text, avatar_url text,
  role            text[], hourly_rate numeric(6,2),
  experience_years int, location text,
  latitude float, longitude float,
  rating          numeric(2,1) DEFAULT 0,
  missions_count  int DEFAULT 0,
  is_available    boolean DEFAULT true,
  stripe_account  text, verified boolean DEFAULT false,
  created_at      timestamptz DEFAULT now()
);

CREATE TABLE events (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizer_id  uuid REFERENCES organizers,
  title         text NOT NULL, description text,
  location      text NOT NULL, latitude float, longitude float,
  date_start    timestamptz NOT NULL, date_end timestamptz NOT NULL,
  type          text, status text DEFAULT 'draft',
  cover_url     text, created_at timestamptz DEFAULT now()
);

CREATE TABLE event_roles (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id      uuid REFERENCES events ON DELETE CASCADE,
  role          text NOT NULL, slots int NOT NULL,
  slots_filled  int DEFAULT 0, hourly_rate numeric(6,2),
  dress_code    text, requirements text
);

CREATE TABLE applications (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_role_id uuid REFERENCES event_roles ON DELETE CASCADE,
  staff_id      uuid REFERENCES staff,
  status        text DEFAULT 'pending',
  message       text, applied_at timestamptz DEFAULT now(),
  UNIQUE(event_role_id, staff_id)
);

CREATE TABLE missions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid REFERENCES applications,
  staff_id      uuid REFERENCES staff,
  event_id      uuid REFERENCES events,
  check_in      timestamptz, check_out timestamptz,
  hours_worked  numeric(4,2), amount_due numeric(8,2),
  amount_paid   numeric(8,2) DEFAULT 0,
  payment_status text DEFAULT 'pending',
  stripe_transfer text, created_at timestamptz DEFAULT now()
);

CREATE TABLE reviews (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id  uuid REFERENCES missions,
  reviewer_id uuid REFERENCES auth.users,
  reviewee_id uuid REFERENCES auth.users,
  rating      int CHECK (rating BETWEEN 1 AND 5),
  comment     text, created_at timestamptz DEFAULT now(),
  UNIQUE(mission_id, reviewer_id)
);

-- RLS basique
ALTER TABLE events       ENABLE ROW LEVEL SECURITY;
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE missions      ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public events" ON events FOR SELECT USING (status = 'published');
CREATE POLICY "Own events"    ON events FOR ALL    USING (organizer_id = auth.uid());
