-- ============================================================
-- InterviewOnAI — Supabase Schema
-- Run this in the Supabase SQL Editor (supabase.com/dashboard)
-- ============================================================

-- 1. Profiles table (extends auth.users)
CREATE TABLE public.profiles (
    id                      UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username                TEXT UNIQUE NOT NULL,
    display_name            TEXT,
    is_free_tier_exhausted  BOOLEAN DEFAULT FALSE NOT NULL,
    created_at              TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at              TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 2. Interviews table
CREATE TABLE public.interviews (
    id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id           UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    mode              TEXT NOT NULL CHECK (mode IN ('jd', 'topic')),
    topic             TEXT NOT NULL,
    jd_text           TEXT,
    difficulty        TEXT NOT NULL,
    total_questions   INTEGER NOT NULL,
    overall_score     INTEGER,
    accuracy          INTEGER,
    depth             INTEGER,
    clarity           INTEGER,
    relevance         INTEGER,
    practical         INTEGER,
    grade             TEXT,
    status            TEXT DEFAULT 'in_progress' NOT NULL CHECK (status IN ('in_progress', 'completed')),
    started_at        TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    completed_at      TIMESTAMPTZ
);

-- 3. Questions table
CREATE TABLE public.questions (
    id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    interview_id      UUID NOT NULL REFERENCES public.interviews(id) ON DELETE CASCADE,
    question_number   INTEGER NOT NULL,
    question_text     TEXT NOT NULL,
    answer_text       TEXT,
    feedback          TEXT,
    accuracy          INTEGER DEFAULT 0,
    depth             INTEGER DEFAULT 0,
    clarity           INTEGER DEFAULT 0,
    relevance         INTEGER DEFAULT 0,
    practical         INTEGER DEFAULT 0,
    overall           INTEGER DEFAULT 0,
    answered_at       TIMESTAMPTZ
);

-- ============================================================
-- Indexes
-- ============================================================

CREATE INDEX idx_interviews_user_id ON public.interviews(user_id);
CREATE INDEX idx_interviews_status ON public.interviews(status);
CREATE INDEX idx_questions_interview_id ON public.questions(interview_id);

-- ============================================================
-- Row Level Security
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;

-- Profiles: users can read/update only their own row
CREATE POLICY "profiles_select_own"
    ON public.profiles FOR SELECT
    USING (id = auth.uid());

CREATE POLICY "profiles_insert_own"
    ON public.profiles FOR INSERT
    WITH CHECK (id = auth.uid());

CREATE POLICY "profiles_update_own"
    ON public.profiles FOR UPDATE
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

-- Interviews: users can CRUD only their own
CREATE POLICY "interviews_select_own"
    ON public.interviews FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "interviews_insert_own"
    ON public.interviews FOR INSERT
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "interviews_update_own"
    ON public.interviews FOR UPDATE
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "interviews_delete_own"
    ON public.interviews FOR DELETE
    USING (user_id = auth.uid());

-- Questions: users can CRUD only questions belonging to their interviews
CREATE POLICY "questions_select_own"
    ON public.questions FOR SELECT
    USING (interview_id IN (SELECT id FROM public.interviews WHERE user_id = auth.uid()));

CREATE POLICY "questions_insert_own"
    ON public.questions FOR INSERT
    WITH CHECK (interview_id IN (SELECT id FROM public.interviews WHERE user_id = auth.uid()));

CREATE POLICY "questions_update_own"
    ON public.questions FOR UPDATE
    USING (interview_id IN (SELECT id FROM public.interviews WHERE user_id = auth.uid()))
    WITH CHECK (interview_id IN (SELECT id FROM public.interviews WHERE user_id = auth.uid()));

-- ============================================================
-- Auto-create profile on signup (trigger)
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    INSERT INTO public.profiles (id, username, display_name)
    VALUES (
        NEW.id,
        COALESCE(
            NEW.raw_user_meta_data ->> 'username',
            NEW.raw_user_meta_data ->> 'full_name',
            split_part(NEW.email, '@', 1)
        ),
        COALESCE(
            NEW.raw_user_meta_data ->> 'display_name',
            NEW.raw_user_meta_data ->> 'full_name',
            NEW.raw_user_meta_data ->> 'name',
            split_part(NEW.email, '@', 1)
        )
    );
    RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- Updated_at auto-update trigger for profiles
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at();
