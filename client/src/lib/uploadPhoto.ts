import { createClient } from '@supabase/supabase-js';

export async function uploadPhotoDirectly(
  file: File,
  projectId: string
): Promise<string> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      'VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set'
    );
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Get the current session token from storage
  // Supabase stores it under this key by default
  const sessionKey = Object.keys(localStorage).find(k =>
    k.startsWith('sb-') && k.endsWith('-auth-token')
  );
  const sessionRaw = sessionKey
    ? localStorage.getItem(sessionKey)
    : null;
  const session = sessionRaw ? JSON.parse(sessionRaw) : null;

  // Set the session so uploads are authenticated
  if (session?.access_token) {
    await supabase.auth.setSession({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
    });
  }

  // Compress if > 1MB
  let uploadFile = file;
  if (file.size > 1_000_000) {
    uploadFile = await compressImage(file, 0.7);
  }

  const ext = file.name.split('.').pop() || 'jpg';
  const filename = `${projectId}/${Date.now()}.${ext}`;

  const { error } = await supabase.storage
    .from('site-photos')
    .upload(filename, uploadFile, {
      contentType: file.type || 'image/jpeg',
      upsert: false,
    });

  if (error) throw new Error(error.message);

  const { data: { publicUrl } } = supabase.storage
    .from('site-photos')
    .getPublicUrl(filename);

  return publicUrl;
}

export async function compressImage(
  file: File,
  quality: number
): Promise<File> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const img = new Image();
    img.onload = () => {
      const ratio = Math.min(1, 1200 / img.width);
      canvas.width = img.width * ratio;
      canvas.height = img.height * ratio;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => resolve(
          new File([blob!], file.name, { type: 'image/jpeg' })
        ),
        'image/jpeg',
        quality
      );
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = URL.createObjectURL(file);
  });
}
