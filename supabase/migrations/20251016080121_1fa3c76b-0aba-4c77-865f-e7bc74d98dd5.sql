-- Add foreign key from job_positions to recruiter_profiles
ALTER TABLE public.job_positions
ADD CONSTRAINT fk_job_positions_recruiter_profile
FOREIGN KEY (recruiter_id)
REFERENCES public.recruiter_profiles(user_id)
ON DELETE CASCADE;

-- Add foreign key from candidate_matches to candidate_profiles
ALTER TABLE public.candidate_matches
ADD CONSTRAINT fk_candidate_matches_candidate_profile
FOREIGN KEY (candidate_id)
REFERENCES public.candidate_profiles(user_id)
ON DELETE CASCADE;