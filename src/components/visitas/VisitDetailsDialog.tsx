import { useState } from "react";
import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatDateBR, formatDistanceM } from "@/lib/geo";
import type { Client, Visit, VisitStatus } from "@/lib/types";

const STATUS_LABEL: Record<VisitStatus, string> = {
  realizada: "Visita realizada",
  nao_encontrado: "Não encontrado",
  recusada: "Atendimento recusado",
  nao_realizada: "Não realizada",
};

/** janela com tudo o que o vendedor registrou naquela visita */
export function VisitDetailsDialog({
  client,
  visit,
  radiusM,
  onClose,
}: {
  client: Client;
  visit: Visit;
  radiusM: number;
  onClose: () => void;
}) {
  const [photoView, setPhotoView] = useState<string | null>(null);
  const fotos = visit.photos && visit.photos.length > 0 ? visit.photos : visit.photoData ? [visit.photoData] : [];
  const data = visit.visitedAt.slice(0, 10);
  const hora = new Date(visit.visitedAt).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[calc(100dvh-2.5rem)] max-w-lg overflow-y-auto overscroll-contain">
        <DialogHeader>
          <DialogTitle>{client.name}</DialogTitle>
          <DialogDescription>
            {formatDateBR(data)} às {hora} · {client.city || "—"}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2">
          <Badge
            className={
              visit.status === "realizada"
                ? "bg-primary/10 text-primary"
                : visit.status === "nao_encontrado"
                  ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                  : visit.status === "nao_realizada"
                    ? "bg-slate-500/15 text-slate-600 dark:text-slate-300"
                    : "bg-destructive/10 text-destructive"
            }
          >
            {STATUS_LABEL[visit.status]}
          </Badge>
          {visit.withinRadius === false && (
            <Badge className="bg-destructive/10 text-destructive">Fora do raio</Badge>
          )}
        </div>

        <div className="space-y-3 text-sm">
          <div>
            <div className="text-xs font-medium text-muted-foreground">
              {visit.status === "nao_realizada" ? "Justificativa" : "O que foi realizado"}
            </div>
            <p className="mt-0.5">{visit.resultComments || "—"}</p>
          </div>
          <div>
            <div className="text-xs font-medium text-muted-foreground">Próxima visita — o que fazer</div>
            <p className="mt-0.5">{visit.nextActions || "—"}</p>
          </div>
          <div>
            <div className="text-xs font-medium text-muted-foreground">Local</div>
            <p className="mt-0.5">
              {[client.city, client.address].filter(Boolean).join(" · ") || "—"}
            </p>
          </div>
          {visit.withinRadius === false && visit.distanceFromClientM != null && (
            <p className="text-destructive">
              {formatDistanceM(visit.distanceFromClientM)} do endereço cadastrado (raio {radiusM} m)
            </p>
          )}
        </div>

        {fotos.length > 0 && (
          <div>
            <div className="mb-1 text-xs font-medium text-muted-foreground">
              Fotos ({fotos.length}) — clique para ampliar
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {fotos.map((f, i) => (
                <button key={i} onClick={() => setPhotoView(f)} className="cursor-zoom-in">
                  <img src={f} alt={`Foto ${i + 1}`} className="h-28 w-full rounded-lg object-cover" />
                </button>
              ))}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>

      {photoView && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-4"
          onClick={() => setPhotoView(null)}
        >
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-4 top-4 text-white hover:bg-white/10 hover:text-white"
            onClick={(e) => {
              e.stopPropagation();
              setPhotoView(null);
            }}
          >
            <X className="h-6 w-6" />
          </Button>
          <img
            src={photoView}
            alt="Foto ampliada"
            className="max-h-[90vh] max-w-full rounded-lg object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </Dialog>
  );
}
