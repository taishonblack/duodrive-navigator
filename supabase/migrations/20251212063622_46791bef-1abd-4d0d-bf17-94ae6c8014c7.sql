-- Add photo_url and bio columns to coaches table
ALTER TABLE public.coaches 
ADD COLUMN photo_url text,
ADD COLUMN bio text;

-- Allow public read access to coach photos and bios for personalization
COMMENT ON COLUMN public.coaches.photo_url IS 'Coach profile photo URL';
COMMENT ON COLUMN public.coaches.bio IS 'Coach bio/description for customer display';