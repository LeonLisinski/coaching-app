-- Fix existing clients where gender was stored as empty string instead of NULL.
-- The check constraint (gender IN ('M', 'F')) allows NULL but rejects ''.
-- This caused every UPDATE on those rows to fail constraint validation.
UPDATE clients
SET gender = NULL
WHERE gender IS NOT NULL
  AND gender NOT IN ('M', 'F');
