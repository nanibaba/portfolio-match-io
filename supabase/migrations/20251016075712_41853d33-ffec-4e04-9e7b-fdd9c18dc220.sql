-- Create user roles enum
CREATE TYPE public.user_role AS ENUM ('RECRUITER', 'CANDIDATE');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  email TEXT NOT NULL,
  role public.user_role NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create recruiter profiles table
CREATE TABLE public.recruiter_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  company_name TEXT NOT NULL,
  contact_info TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create candidate profiles table
CREATE TABLE public.candidate_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  experience_level TEXT NOT NULL CHECK (experience_level IN ('junior', 'mid', 'senior')),
  skills TEXT[] NOT NULL DEFAULT '{}',
  work_experience TEXT,
  cv_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create storage bucket for CVs
INSERT INTO storage.buckets (id, name, public)
VALUES ('cvs', 'cvs', false)
ON CONFLICT DO NOTHING;

-- Create job positions table
CREATE TABLE public.job_positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recruiter_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  required_skills TEXT[] NOT NULL DEFAULT '{}',
  experience_level TEXT NOT NULL CHECK (experience_level IN ('junior', 'mid', 'senior')),
  employment_type TEXT NOT NULL CHECK (employment_type IN ('full-time', 'part-time', 'contract', 'internship')),
  is_active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create candidate matches table
CREATE TABLE public.candidate_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  job_id UUID REFERENCES public.job_positions(id) ON DELETE CASCADE NOT NULL,
  match_score NUMERIC(5,2) NOT NULL CHECK (match_score >= 0 AND match_score <= 100),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(candidate_id, job_id)
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recruiter_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_matches ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = user_id);

-- Recruiter profiles policies
CREATE POLICY "Recruiters can view their own profile"
  ON public.recruiter_profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Recruiters can insert their own profile"
  ON public.recruiter_profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Recruiters can update their own profile"
  ON public.recruiter_profiles FOR UPDATE
  USING (auth.uid() = user_id);

-- Candidate profiles policies
CREATE POLICY "Candidates can view their own profile"
  ON public.candidate_profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Candidates can insert their own profile"
  ON public.candidate_profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Candidates can update their own profile"
  ON public.candidate_profiles FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Recruiters can view candidate profiles"
  ON public.candidate_profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role = 'RECRUITER'
    )
  );

-- Job positions policies
CREATE POLICY "Everyone can view active jobs"
  ON public.job_positions FOR SELECT
  USING (is_active = true);

CREATE POLICY "Recruiters can insert jobs"
  ON public.job_positions FOR INSERT
  WITH CHECK (
    auth.uid() = recruiter_id AND
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role = 'RECRUITER'
    )
  );

CREATE POLICY "Recruiters can update their own jobs"
  ON public.job_positions FOR UPDATE
  USING (
    auth.uid() = recruiter_id AND
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role = 'RECRUITER'
    )
  );

CREATE POLICY "Recruiters can delete their own jobs"
  ON public.job_positions FOR DELETE
  USING (
    auth.uid() = recruiter_id AND
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role = 'RECRUITER'
    )
  );

-- Candidate matches policies
CREATE POLICY "Candidates can view their own matches"
  ON public.candidate_matches FOR SELECT
  USING (auth.uid() = candidate_id);

CREATE POLICY "Recruiters can view matches for their jobs"
  ON public.candidate_matches FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.job_positions
      WHERE job_positions.id = candidate_matches.job_id
      AND job_positions.recruiter_id = auth.uid()
    )
  );

-- Storage policies for CVs
CREATE POLICY "Candidates can upload their own CV"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'cvs' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Candidates can view their own CV"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'cvs' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Candidates can update their own CV"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'cvs' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Recruiters can view CVs of matched candidates"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'cvs' AND
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role = 'RECRUITER'
    )
  );

-- Trigger function for updating job updated_at
CREATE OR REPLACE FUNCTION public.update_job_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger for job positions
CREATE TRIGGER update_job_positions_updated_at
  BEFORE UPDATE ON public.job_positions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_job_updated_at();

-- Function to handle new user profile creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, role)
  VALUES (
    NEW.id,
    NEW.email,
    (NEW.raw_user_meta_data->>'role')::public.user_role
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger for automatic profile creation
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();