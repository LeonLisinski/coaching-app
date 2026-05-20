-- Add user_id to expo_push_tokens so the Edge Function can verify
-- the recipient is not the same person as the sender.
ALTER TABLE public.expo_push_tokens
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
