import { useRef, useState } from "react";
import { Upload } from "lucide-react";
import { uploadFile } from "@/lib/cms-api";
import { Button } from "@/components/ui/button";

export function ImageUpload({ value, onChange }: { value?: string; onChange: (url: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setIsUploading(true);
    setError(null);
    try {
      const url = await uploadFile(file);
      onChange(url);
    } catch {
      setError("Upload failed — check file type (jpg/png/webp/gif) and size (max 5MB).");
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      {value && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={value} alt="" className="h-14 w-14 rounded-xl object-cover" />
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />
      <Button type="button" variant="glass" size="sm" disabled={isUploading} onClick={() => inputRef.current?.click()}>
        <Upload className="h-3.5 w-3.5" /> {isUploading ? "Uploading..." : value ? "Replace image" : "Upload image"}
      </Button>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
