import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CalendarX2, ExternalLink, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useData } from "@/lib/DataContext";
import { formatDateBR, formatDistanceM } from "@/lib/geo";
import type { Visit } from "@/lib/types";

const STATUS_LABEL: Record<Visit["status"], string> = {
  realizada: "Realizada",
  nao_encontrado: "Não encontrado",
  recusada: "Recusado",
  nao_realizada: "Não realizada",
};

export default function Visitas() {
  const { state, deleteVisit } = useData();
  const { clients, visits, settings } = state;
  const [params] = useSearchParams();
  const [search, setSearch] = useState("");
  const [onlyAlerta, setOnlyAlerta] = useState(params.get("alerta") === "raio");
  const [onlyRealizadas, setOnlyRealizadas] = useState(false);
  const [viewing, setViewing] = useState<Visit | null>(null);
  const [toDelete, setToDelete] = useState<Visit | null>(null);

  const clientOf = (id: string) => clients.find((c) => c.id === id);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return visits
      .filter((v) => (onlyAlerta ? v.withinRadius === false : true))
      .filter((v) => (onlyRealizadas ? v.status === "realizada" : true))
      .filter((v) => {
        if (!q) return true;
        const c = clients.find((x) => x.id === v.clientId);
        return `${c?.name ?? ""} ${c?.city ?? ""}`.toLowerCase().includes(q);
      });
  }, [visits, search, onlyAlerta, onlyRealizadas, clients]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Visitas registradas</h1>
          <p className="text-sm text-muted-foreground">{visits.length} no total</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-52 flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Buscar por cliente ou cidade…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <Checkbox
            checked={onlyAlerta}
            onCheckedChange={(v) => setOnlyAlerta(!!v)}
          />
          Só fora do raio
        </label>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <Checkbox checked={onlyRealizadas} onCheckedChange={(v) => setOnlyRealizadas(!!v)} />
          Só realizadas
        </label>
      </div>

      {filtered.length === 0 ? (
        <div className="card-soft flex flex-col items-center gap-2 p-12 text-center text-muted-foreground">
          <CalendarX2 className="h-8 w-8" />
          <p>Nenhuma visita encontrada.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((v) => {
            const c = clientOf(v.clientId);
            return (
              <div key={v.id} className="card-soft flex flex-col gap-3 p-4 sm:flex-row sm:items-start">
                {v.photoData ? (
                  <button onClick={() => setViewing(v)} className="shrink-0">
                    <img
                      src={v.photoData}
                      alt="Comprovante"
                      className="h-24 w-32 rounded-lg object-cover"
                     
                    />
                  </button>
                ) : (
                  <div className="flex h-24 w-32 items-center justify-center rounded-lg bg-secondary text-xs text-muted-foreground">
                    Sem foto
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{c?.name ?? "Cliente removido"}</span>
                    <Badge
                      className={
                        v.status === "realizada"
                          ? "bg-primary/10 text-primary"
                          : v.status === "nao_encontrado"
                            ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                            : v.status === "nao_realizada"
                              ? "bg-slate-500/15 text-slate-600 dark:text-slate-300"
                              : "bg-destructive/10 text-destructive"
                      }
                    >
                      {STATUS_LABEL[v.status]}
                    </Badge>
                    {v.withinRadius === false && (
                      <Badge className="bg-destructive/10 text-destructive">Fora do raio</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {formatDateBR(v.visitedAt.slice(0, 10))} às {v.visitedAt.slice(11, 16)} · {c?.city}
                  </p>
                  <div className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
                    <div>
                      <div className="text-xs font-medium text-muted-foreground">O que foi feito</div>
                      <p className="line-clamp-2">{v.resultComments || "—"}</p>
                    </div>
                    <div>
                      <div className="text-xs font-medium text-muted-foreground">Próxima visita</div>
                      <p className="line-clamp-2">{v.nextActions || "—"}</p>
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {v.gpsLat != null &&
                      `GPS ${v.gpsLat.toFixed(5)}, ${v.gpsLng?.toFixed(5)}`}
                    {v.distanceFromClientM != null &&
                      ` · ${formatDistanceM(v.distanceFromClientM)} do endereço (raio ${settings.visitRadiusM} m)`}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  {v.photoData && (
                    <Button variant="outline" size="sm" asChild>
                      <a href={v.photoData} target="_blank" rel="noreferrer">
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" onClick={() => setToDelete(v)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Comprovante</DialogTitle>
            <DialogDescription>
              {viewing && clientOf(viewing.clientId)?.name} —{" "}
              {viewing ? formatDateBR(viewing.visitedAt.slice(0, 10)) : ""}
            </DialogDescription>
          </DialogHeader>
          {viewing?.photoData && (
            <img
              src={viewing.photoData}
              alt="Comprovante"
              className="w-full rounded-lg"
             
            />
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir visita?</AlertDialogTitle>
            <AlertDialogDescription>
              O registro ({toDelete ? clientOf(toDelete.clientId)?.name : ""}) será removido do histórico.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (toDelete) deleteVisit(toDelete.id);
                setToDelete(null);
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
