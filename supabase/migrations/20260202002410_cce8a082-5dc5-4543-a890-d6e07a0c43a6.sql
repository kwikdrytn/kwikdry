-- Training categories table
CREATE TABLE public.training_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT DEFAULT 'folder',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- Training videos table
CREATE TABLE public.training_videos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.training_categories(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  youtube_video_id TEXT NOT NULL,
  thumbnail_url TEXT,
  duration_seconds INTEGER,
  is_required BOOLEAN NOT NULL DEFAULT false,
  required_for_roles TEXT[] DEFAULT '{}',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- Training progress table (per user per video)
CREATE TABLE public.training_progress (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  video_id UUID NOT NULL REFERENCES public.training_videos(id) ON DELETE CASCADE,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  progress_percent INTEGER NOT NULL DEFAULT 0,
  last_position_seconds INTEGER NOT NULL DEFAULT 0,
  last_watched_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, video_id)
);

-- Indexes for performance
CREATE INDEX idx_training_videos_org ON public.training_videos(organization_id);
CREATE INDEX idx_training_videos_category ON public.training_videos(category_id);
CREATE INDEX idx_training_progress_user ON public.training_progress(user_id);
CREATE INDEX idx_training_progress_video ON public.training_progress(video_id);

-- Enable RLS
ALTER TABLE public.training_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_progress ENABLE ROW LEVEL SECURITY;

-- RLS policies for training_categories
CREATE POLICY "Users can view categories in their org"
  ON public.training_categories FOR SELECT
  USING (organization_id = get_user_organization_id() AND deleted_at IS NULL);

CREATE POLICY "Admins can insert categories"
  ON public.training_categories FOR INSERT
  WITH CHECK (organization_id = get_user_organization_id() AND is_admin());

CREATE POLICY "Admins can update categories"
  ON public.training_categories FOR UPDATE
  USING (organization_id = get_user_organization_id() AND is_admin());

-- RLS policies for training_videos
CREATE POLICY "Users can view active videos in their org"
  ON public.training_videos FOR SELECT
  USING (organization_id = get_user_organization_id() AND is_active = true AND deleted_at IS NULL);

CREATE POLICY "Admins can insert videos"
  ON public.training_videos FOR INSERT
  WITH CHECK (organization_id = get_user_organization_id() AND is_admin());

CREATE POLICY "Admins can update videos"
  ON public.training_videos FOR UPDATE
  USING (organization_id = get_user_organization_id() AND is_admin());

-- RLS policies for training_progress
CREATE POLICY "Users can view their own progress"
  ON public.training_progress FOR SELECT
  USING (user_id = (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert their own progress"
  ON public.training_progress FOR INSERT
  WITH CHECK (user_id = (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can update their own progress"
  ON public.training_progress FOR UPDATE
  USING (user_id = (SELECT id FROM profiles WHERE user_id = auth.uid()));

-- Admins can view all progress for reporting
CREATE POLICY "Admins can view all progress in org"
  ON public.training_progress FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM training_videos v 
      WHERE v.id = video_id 
      AND v.organization_id = get_user_organization_id()
    ) AND is_admin()
  );

-- Updated at triggers
CREATE TRIGGER update_training_categories_updated_at
  BEFORE UPDATE ON public.training_categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_training_videos_updated_at
  BEFORE UPDATE ON public.training_videos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_training_progress_updated_at
  BEFORE UPDATE ON public.training_progress
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();