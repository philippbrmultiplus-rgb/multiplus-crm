import { Loader2 } from "lucide-react";

/** tela de carregamento enquanto a página (carregada sob demanda) chega */
export function PageLoading() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}
