-- Fix gender check constraint to accept uppercase 'M' and 'F'
-- (previously only allowed lowercase 'm' and 'f', but the app uses uppercase)
ALTER TABLE clients DROP CONSTRAINT IF EXISTS clients_gender_check;
ALTER TABLE clients ADD CONSTRAINT clients_gender_check CHECK (gender IN ('M', 'F'));
