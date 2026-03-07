import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

function getSupabase(): SupabaseClient {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set for photo uploads');
  }
  return createClient(supabaseUrl, supabaseAnonKey);
}

/** Compress image to JPEG with max width 1200px and given quality. */
export async function compressImage(file: File, quality: number): Promise<File> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const img = new Image();
    img.onload = () => {
      const ratio = Math.min(1, 1200 / img.width);
      canvas.width = img.width * ratio;
      canvas.height = img.height * ratio;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(file);
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' }));
          else resolve(file);
        },
        'image/jpeg',
        quality
      );
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = URL.createObjectURL(file);
  });
}

/**
 * Upload a photo file directly to Supabase Storage (site-photos bucket).
 * Compresses if file size > 1MB. Returns the public URL.
 */
export async function uploadPhotoDirectly(file: File, projectId: string): Promise<string> {
  const supabase = getSupabase();
  let uploadFile = file;
  if (file.size > 1_000_000) {
    uploadFile = await compressImage(file, 0.7);
  }
  const safeName = file.name.replace(/[^a-zA-Z0-9.]/g, '-');
  const filename = `${projectId}/${Date.now()}-${safeName}`;
  const { error } = await supabase.storage
    .from('site-photos')
    .upload(filename, uploadFile, {
      contentType: uploadFile.type || 'image/jpeg',
      upsert: false,
    });
  if (error) throw new Error(error.message);
  const { data: { publicUrl } } = supabase.storage.from('site-photos').getPublicUrl(filename);
  return publicUrl;
}
