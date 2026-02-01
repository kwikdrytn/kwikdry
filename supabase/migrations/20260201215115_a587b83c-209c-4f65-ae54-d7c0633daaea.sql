-- Create equipment_photos table for storing equipment images
CREATE TABLE public.equipment_photos (
  id UUID NOT NULL DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
  equipment_id UUID NOT NULL REFERENCES public.equipment(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.equipment_photos ENABLE ROW LEVEL SECURITY;

-- Users can view photos for equipment in their organization
CREATE POLICY "Users can view equipment photos"
  ON public.equipment_photos
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.equipment
      WHERE equipment.id = equipment_photos.equipment_id
      AND equipment.organization_id = get_user_organization_id()
    )
  );

-- Admins can insert photos
CREATE POLICY "Admins can insert equipment photos"
  ON public.equipment_photos
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.equipment
      WHERE equipment.id = equipment_photos.equipment_id
      AND equipment.organization_id = get_user_organization_id()
    )
    AND is_admin()
  );

-- Admins can delete photos
CREATE POLICY "Admins can delete equipment photos"
  ON public.equipment_photos
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.equipment
      WHERE equipment.id = equipment_photos.equipment_id
      AND equipment.organization_id = get_user_organization_id()
    )
    AND is_admin()
  );

-- Create storage bucket for equipment photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('equipment-photos', 'equipment-photos', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for equipment photos
CREATE POLICY "Authenticated users can view equipment photos"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'equipment-photos' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can upload equipment photos"
  ON storage.objects
  FOR INSERT
  WITH CHECK (bucket_id = 'equipment-photos' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete equipment photos"
  ON storage.objects
  FOR DELETE
  USING (bucket_id = 'equipment-photos' AND auth.role() = 'authenticated');