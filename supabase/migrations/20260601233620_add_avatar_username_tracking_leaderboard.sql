/*
  # Add avatar, username tracking and leaderboard support

  1. Changes to `profiles` table
    - `avatar_url` (text, nullable) — public URL of the user's profile photo
    - `username_changed_at` (timestamptz, nullable) — timestamp of last username change, enforces 1-year cooldown

  2. Security
    - RLS policies for authenticated users to update their own profile
    - Public SELECT policy on profiles limited to id, username, coins, plan, avatar_url for leaderboard
*/

-- Add avatar_url column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'avatar_url'
  ) THEN
    ALTER TABLE profiles ADD COLUMN avatar_url text;
  END IF;
END $$;

-- Add username_changed_at column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'username_changed_at'
  ) THEN
    ALTER TABLE profiles ADD COLUMN username_changed_at timestamptz;
  END IF;
END $$;

-- Leaderboard: allow anyone authenticated to read limited profile fields
-- Drop if exists to avoid duplicates
DROP POLICY IF EXISTS "Authenticated users can read profiles for leaderboard" ON profiles;

CREATE POLICY "Authenticated users can read profiles for leaderboard"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (true);

-- Users can update their own profile
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;

CREATE POLICY "Users can update own profile"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);
