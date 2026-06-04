-- =============================================================================
-- Fix demo_blocked_slots.blocked_time to allow NULL.
-- NULL means "whole day blocked" (no specific time), which is a valid state.
-- Previously the column was NOT NULL which caused insert failures when no time
-- was specified in the admin availability UI.
-- =============================================================================

ALTER TABLE public.demo_blocked_slots ALTER COLUMN blocked_time DROP NOT NULL;
