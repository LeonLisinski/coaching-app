-- Add TikTok and Facebook to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS tiktok text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS facebook text;

-- Add social visibility array to trainer_profiles (controls what shows on client mobile app)
ALTER TABLE trainer_profiles ADD COLUMN IF NOT EXISTS social_visibility text[]
  DEFAULT ARRAY['phone', 'email', 'instagram', 'website']::text[];
