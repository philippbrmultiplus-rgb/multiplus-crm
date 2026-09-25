import { useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** foto que abre ampliada ao clicar (somente visualização — não baixa nem abre outra aba) */
export function PhotoZoom({
  src,
  alt,
  className,
  imgClassName,
  title,
}: {
  src: string;
  alt: string;
  className?: string;
  imgClassName?: string;
  title?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        title={title ?? "Clique para ampliar"}
        className={cn("cursor-zoom-in", className)}
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
      >
        <img src={src} alt={alt} className={imgClassName} />
      </button>
      {open && <PhotoOverlay src={src} alt={alt} onClose={() => setOpen(false)} />}
    </>
  );
}

/** tela cheia para visualização da foto */
export function PhotoOverlay({
  src,
  alt,
  onClose,
}: {
  src: string;
  alt: string;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-4"
      onClick={onClose}
    >
      <Button
        variant="ghost"
        size="icon"
        className="absolute right-4 top-4 text-white hover:bg-white/10 hover:text-white"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
      >
        <X className="h-6 w-6" />
      </Button>
      <img
        src={src}
        alt={alt}
        className="max-h-[90vh] max-w-full rounded-lg object-contain"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}
