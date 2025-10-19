-- ============================================
-- COMPREHENSIVE SECURITY FIX MIGRATION
-- Addresses 5 critical security vulnerabilities
-- ============================================

-- ============================================
-- ISSUE 1: Fix Role System (Privilege Escalation)
-- ============================================

-- Create app_role enum
CREATE TYPE public.app_role AS ENUM ('RECRUITER', 'CANDIDATE');

-- Create user_roles table (separate from profiles)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Only users can view their own roles
CREATE POLICY "Users can view their own roles"
ON public.user_roles FOR SELECT
USING (auth.uid() = user_id);

-- Migrate existing roles from profiles to user_roles
INSERT INTO public.user_roles (user_id, role)
SELECT user_id, 
  CASE 
    WHEN role::text = 'RECRUITER' THEN 'RECRUITER'::public.app_role
    WHEN role::text = 'CANDIDATE' THEN 'CANDIDATE'::public.app_role
  END as role
FROM public.profiles
WHERE role IS NOT NULL
ON CONFLICT (user_id, role) DO NOTHING;

-- Create security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- ============================================
-- Update RLS policies before dropping role column
-- ============================================

-- Update job_positions policies
DROP POLICY IF EXISTS "Recruiters can insert jobs" ON public.job_positions;
CREATE POLICY "Recruiters can insert jobs"
ON public.job_positions FOR INSERT
WITH CHECK (
  auth.uid() = recruiter_id 
  AND public.has_role(auth.uid(), 'RECRUITER'::public.app_role)
);

DROP POLICY IF EXISTS "Recruiters can update their own jobs" ON public.job_positions;
CREATE POLICY "Recruiters can update their own jobs"
ON public.job_positions FOR UPDATE
USING (
  auth.uid() = recruiter_id 
  AND public.has_role(auth.uid(), 'RECRUITER'::public.app_role)
);

DROP POLICY IF EXISTS "Recruiters can delete their own jobs" ON public.job_positions;
CREATE POLICY "Recruiters can delete their own jobs"
ON public.job_positions FOR DELETE
USING (
  auth.uid() = recruiter_id 
  AND public.has_role(auth.uid(), 'RECRUITER'::public.app_role)
);

DROP POLICY IF EXISTS "Recruiters can view matches for their jobs" ON public.candidate_matches;
CREATE POLICY "Recruiters can view matches for their jobs"
ON public.candidate_matches FOR SELECT
USING (
  auth.uid() = candidate_id
  OR
  (
    public.has_role(auth.uid(), 'RECRUITER'::public.app_role)
    AND EXISTS (
      SELECT 1 
      FROM public.job_positions 
      WHERE job_positions.id = candidate_matches.job_id 
        AND job_positions.recruiter_id = auth.uid()
    )
  )
);

-- ============================================
-- ISSUE 2: Restrict Candidate Data Access
-- ============================================

-- Drop the overly permissive recruiter policy
DROP POLICY IF EXISTS "Recruiters can view candidate profiles" ON public.candidate_profiles;

-- Add restricted policy: only matched candidates visible
CREATE POLICY "Recruiters can view matched candidates only"
ON public.candidate_profiles FOR SELECT
USING (
  -- Candidates can see their own profile
  auth.uid() = user_id
  OR
  -- Recruiters can only see candidates matched to their jobs
  (
    public.has_role(auth.uid(), 'RECRUITER'::public.app_role)
    AND EXISTS (
      SELECT 1 
      FROM public.candidate_matches cm
      JOIN public.job_positions jp ON cm.job_id = jp.id
      WHERE cm.candidate_id = candidate_profiles.user_id
        AND jp.recruiter_id = auth.uid()
    )
  )
);

-- ============================================
-- ISSUE 5: Secure CV Storage
-- ============================================

-- Drop any existing storage policies that might depend on profiles.role
DROP POLICY IF EXISTS "Recruiters can view CVs of matched candidates" ON storage.objects;
DROP POLICY IF EXISTS "Candidates can access their own CVs" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload CVs" ON storage.objects;

-- Make cvs bucket private
UPDATE storage.buckets 
SET public = false 
WHERE id = 'cvs';

-- Add new RLS policies for CV storage
CREATE POLICY "Candidates can upload their own CVs"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'cvs' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Candidates can update their own CVs"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'cvs' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Candidates can delete their own CVs"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'cvs' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Candidates can view their own CVs"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'cvs' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Recruiters can view matched candidate CVs"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'cvs'
  AND (
    -- Extract user_id from path (format: user_id/filename)
    (storage.foldername(name))[1] IN (
      SELECT cm.candidate_id::text
      FROM public.candidate_matches cm
      JOIN public.job_positions jp ON cm.job_id = jp.id
      WHERE jp.recruiter_id = auth.uid()
    )
  )
);

-- Now safe to remove role column from profiles
ALTER TABLE public.profiles DROP COLUMN IF EXISTS role;