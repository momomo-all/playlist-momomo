/*
  # Dream Pairing Playlist Archive Schema

  1. New Tables
    - `genres`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `name` (text) - genre/fandom name e.g. "주술회전"
      - `cover_url` (text) - optional cover image
      - `created_at` (timestamptz)

    - `pairings`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `genre_id` (uuid, references genres)
      - `name` (text) - pairing name
      - `description` (text)
      - `character_tags` (text[]) - array of character names
      - `cover_url` (text) - album cover image
      - `theme_color` (text) - hex color for background gradient
      - `is_favorite` (boolean)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `tracks`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `pairing_id` (uuid, references pairings)
      - `title` (text)
      - `description` (text)
      - `youtube_url` (text)
      - `order_index` (int)
      - `created_at` (timestamptz)

  2. Storage
    - `covers` bucket for album cover images

  3. Security
    - RLS enabled on all tables
    - Users can only access their own data
*/

-- Genres table
CREATE TABLE IF NOT EXISTS genres (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  cover_url text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE genres ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own genres"
  ON genres FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own genres"
  ON genres FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own genres"
  ON genres FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own genres"
  ON genres FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Pairings table
CREATE TABLE IF NOT EXISTS pairings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  genre_id uuid NOT NULL REFERENCES genres(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text DEFAULT '',
  character_tags text[] DEFAULT '{}',
  cover_url text DEFAULT '',
  theme_color text DEFAULT '#1a1a2e',
  is_favorite boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE pairings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own pairings"
  ON pairings FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own pairings"
  ON pairings FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own pairings"
  ON pairings FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own pairings"
  ON pairings FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Tracks table
CREATE TABLE IF NOT EXISTS tracks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pairing_id uuid NOT NULL REFERENCES pairings(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text DEFAULT '',
  youtube_url text DEFAULT '',
  order_index int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE tracks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own tracks"
  ON tracks FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own tracks"
  ON tracks FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own tracks"
  ON tracks FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own tracks"
  ON tracks FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_genres_user_id ON genres(user_id);
CREATE INDEX IF NOT EXISTS idx_pairings_user_id ON pairings(user_id);
CREATE INDEX IF NOT EXISTS idx_pairings_genre_id ON pairings(genre_id);
CREATE INDEX IF NOT EXISTS idx_tracks_pairing_id ON tracks(pairing_id);
CREATE INDEX IF NOT EXISTS idx_tracks_user_id ON tracks(user_id);
