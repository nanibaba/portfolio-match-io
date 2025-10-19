-- Remove experience_level column from job_positions table
ALTER TABLE public.job_positions DROP COLUMN IF EXISTS experience_level;

-- Remove experience_level column from candidate_profiles table
ALTER TABLE public.candidate_profiles DROP COLUMN IF EXISTS experience_level;