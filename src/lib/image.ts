/** Comprime uma imagem (câmera/galeria) para base64 JPEG pequeno. */
export function compressImage(
  file: File,
  maxWidth = 800,
  quality = 0.62,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width);
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("canvas indisponível"));
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = () => reject(new Error("imagem inválida"));
      img.src = String(reader.result);
    };
    reader.onerror = () => reject(new Error("falha ao ler arquivo"));
    reader.readAsDataURL(file);
  });
}
export function estimateKb(dataUrl: string): number {
  return Math.round((dataUrl.length * 3) / 4 / 1024);
}
