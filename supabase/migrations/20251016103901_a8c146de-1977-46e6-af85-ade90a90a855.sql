-- Remove skills and work_experience columns, add cv_text for storing extracted CV content
ALTER TABLE public.candidate_profiles 
DROP COLUMN IF EXISTS skills,
DROP COLUMN IF EXISTS work_experience,
ADD COLUMN IF NOT EXISTS cv_text TEXT;