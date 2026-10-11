import { useRef, useState, useEffect } from 'react';
import { Camera, Trash2, Upload } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface PhotoUploadProps {
  bucket: string;
  pathPrefix: string;
  existingPath: string | null;
  onPathChange: (path: string | null) => void;
  label?: string;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const COMPRESSED_WIDTH = 400;
const COMPRESSED_QUALITY = 0.8;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export default function PhotoUpload({
  bucket,
  pathPrefix,
  existingPath,
  onPathChange,
  label = 'Foto Profil',
}: PhotoUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPath, setCurrentPath] = useState<string | null>(existingPath);

  useEffect(() => {
    setCurrentPath(existingPath);
    if (existingPath) {
      const { data } = supabase.storage.from(bucket).getPublicUrl(existingPath);
      setPreview(data.publicUrl);
    } else {
      setPreview(null);
    }
  }, [existingPath, bucket]);

  async function compressImage(file: File): Promise<File> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const reader = new FileReader();
      reader.onload = (e) => {
        img.src = e.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let { width, height } = img;
          if (width > COMPRESSED_WIDTH) {
            height = Math.round((height * COMPRESSED_WIDTH) / width);
            width = COMPRESSED_WIDTH;
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) { reject(new Error('Canvas not supported')); return; }
          ctx.drawImage(img, 0, 0, width, height);
          canvas.toBlob(
            (blob) => {
              if (!blob) { reject(new Error('Compression failed')); return; }
              resolve(new File([blob], 'photo.webp', { type: 'image/webp' }));
            },
            'image/webp',
            COMPRESSED_QUALITY
          );
        };
        img.onerror = () => reject(new Error('Failed to load image'));
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);

    if (!ALLOWED_TYPES.includes(file.type)) {
      setError('Format file harus JPEG, PNG, atau WebP.');
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setError('Ukuran file maksimal 5MB.');
      return;
    }

    let compressed: File;
    try {
      compressed = await compressImage(file);
    } catch {
      setError('Gagal memproses gambar. Coba file lain.');
      return;
    }

    setUploading(true);
    const fileName = `${pathPrefix}/${Date.now()}.webp`;

    const { error: upErr } = await supabase.storage
      .from(bucket)
      .upload(fileName, compressed, { contentType: 'image/webp', upsert: false });

    if (upErr) {
      setError('Gagal mengunggah foto: ' + upErr.message);
      setUploading(false);
      return;
    }

    if (currentPath) {
      await supabase.storage.from(bucket).remove([currentPath]);
    }

    const { data } = supabase.storage.from(bucket).getPublicUrl(fileName);
    setPreview(data.publicUrl);
    setCurrentPath(fileName);
    onPathChange(fileName);
    setUploading(false);

    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function handleRemove() {
    if (currentPath) {
      await supabase.storage.from(bucket).remove([currentPath]);
    }
    setPreview(null);
    setCurrentPath(null);
    onPathChange(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileSelect}
        className="hidden"
        disabled={uploading}
      />

      <div
        className="relative group cursor-pointer"
        onClick={() => !uploading && fileInputRef.current?.click()}
      >
        {preview ? (
          <img
            src={preview}
            alt={label}
            className="w-24 h-24 rounded-full object-cover border-2 border-gray-200 shadow-sm"
          />
        ) : (
          <div className={`w-24 h-24 rounded-full bg-gray-100 border-2 border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-400 hover:border-emerald-400 hover:text-emerald-500 transition ${uploading ? 'opacity-50' : ''}`}>
            <Camera className="w-7 h-7" />
            <span className="text-xs mt-1">{uploading ? '...' : 'Unggah'}</span>
          </div>
        )}
        {preview && !uploading && (
          <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
            <Upload className="w-5 h-5 text-white" />
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="text-sm text-emerald-700 hover:text-emerald-800 font-medium transition disabled:opacity-50"
        >
          {preview ? 'Ganti Foto' : 'Pilih Foto'}
        </button>
        {preview && (
          <button
            type="button"
            onClick={handleRemove}
            disabled={uploading}
            className="text-sm text-red-500 hover:text-red-600 font-medium transition flex items-center gap-1 disabled:opacity-50"
          >
            <Trash2 className="w-3.5 h-3.5" /> Hapus
          </button>
        )}
      </div>

      {uploading && <p className="text-xs text-emerald-600">Mengunggah & mengompres foto...</p>}
      {error && <p className="text-xs text-red-500">{error}</p>}
      <p className="text-xs text-gray-400 text-center max-w-[200px]">
        JPEG/PNG/WebP, maks 5MB. Foto dikompres otomatis ke 400px.
      </p>
    </div>
  );
}

export function getPhotoUrl(bucket: string, path: string | null): string | null {
  if (!path) return null;
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}
