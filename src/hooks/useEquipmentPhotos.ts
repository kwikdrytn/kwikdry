import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import imageCompression from "browser-image-compression";

export interface EquipmentPhoto {
  id: string;
  equipment_id: string;
  file_path: string;
  url: string;
  created_at: string;
}

export function useEquipmentPhotos(equipmentId: string) {
  return useQuery({
    queryKey: ['equipment-photos', equipmentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('equipment_photos')
        .select('*')
        .eq('equipment_id', equipmentId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Get signed URLs for each photo
      const photosWithUrls = await Promise.all(
        (data || []).map(async (photo: any) => {
          const { data: urlData } = await supabase.storage
            .from('equipment-photos')
            .createSignedUrl(photo.file_path, 60 * 60); // 1 hour

          return {
            id: photo.id,
            equipment_id: photo.equipment_id,
            file_path: photo.file_path,
            created_at: photo.created_at,
            url: urlData?.signedUrl || '',
          } as EquipmentPhoto;
        })
      );

      return photosWithUrls;
    },
    enabled: !!equipmentId,
  });
}

export function useUploadEquipmentPhoto() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ equipmentId, file }: { equipmentId: string; file: File }) => {
      // Compress image
      const compressedFile = await imageCompression(file, {
        maxSizeMB: 1,
        maxWidthOrHeight: 1920,
        useWebWorker: true,
      });

      // Generate unique file path
      const fileExt = file.name.split('.').pop();
      const fileName = `${equipmentId}/${Date.now()}.${fileExt}`;

      // Upload to storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('equipment-photos')
        .upload(fileName, compressedFile);

      if (uploadError) throw uploadError;

      // Create database record
      const { data, error } = await supabase
        .from('equipment_photos')
        .insert({
          equipment_id: equipmentId,
          file_path: uploadData.path,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, { equipmentId }) => {
      queryClient.invalidateQueries({ queryKey: ['equipment-photos', equipmentId] });
      toast.success('Photo uploaded successfully');
    },
    onError: (error) => {
      toast.error(`Failed to upload photo: ${error.message}`);
    },
  });
}

export function useDeleteEquipmentPhoto() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (photoId: string) => {
      // Get the photo record first
      const { data: photo, error: fetchError } = await supabase
        .from('equipment_photos')
        .select('*')
        .eq('id', photoId)
        .single();

      if (fetchError) throw fetchError;

      const photoData = photo as any;

      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('equipment-photos')
        .remove([photoData.file_path]);

      if (storageError) throw storageError;

      // Delete database record
      const { error } = await supabase
        .from('equipment_photos')
        .delete()
        .eq('id', photoId);

      if (error) throw error;
      
      return photoData.equipment_id as string;
    },
    onSuccess: (equipmentId) => {
      queryClient.invalidateQueries({ queryKey: ['equipment-photos', equipmentId] });
      toast.success('Photo deleted successfully');
    },
    onError: (error) => {
      toast.error(`Failed to delete photo: ${error.message}`);
    },
  });
}
