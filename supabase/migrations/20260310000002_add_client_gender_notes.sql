-- Add gender and notes columns to clients table
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS gender text CHECK (gender IN ('M', 'F')),
  ADD COLUMN IF NOT EXISTS notes  text;
