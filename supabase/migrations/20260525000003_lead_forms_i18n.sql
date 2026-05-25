-- Add multilingual (HR/EN) support to lead forms
ALTER TABLE public.lead_forms ADD COLUMN IF NOT EXISTS title_en text;
ALTER TABLE public.lead_forms ADD COLUMN IF NOT EXISTS description_en text;
ALTER TABLE public.lead_form_questions ADD COLUMN IF NOT EXISTS label_en text;
