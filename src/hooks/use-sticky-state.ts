import { useEffect, useState } from "react";

/**
 * Estado que sobrevive à navegação entre páginas: guardado no navegador e
 * restaurado quando a tela volta a abrir.
 */
export function useStickyState<T>(key: string, initial: T): [T, (v: T) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw != null ? (JSON.parse(raw) as T) : initial;
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // storage indisponível — ignora
    }
  }, [key, value]);

  return [value, setValue];
}
