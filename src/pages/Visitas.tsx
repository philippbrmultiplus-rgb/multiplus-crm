import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CalendarX2, ExternalLink, Search, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

/** lista de fotos da visita (novas em `photos`, antigas em `photoData`) */
function fotosOf(v: Visit): string[] {
  if (v.photos && v.photos.length > 0) return v.photos;
  return v.photoData ? [v.photoData] : [];
}

/** hora local do registro (o banco guarda em UTC) */
function horaOf(v: Visit): string {
  return new Date(v.visitedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export default function Visitas() {
  const { state, deleteVisit } = useData();
  const { clients, visits, settings } = state;
  const [params] = useSearchParams();
  const [search, setSearch] = useState("");
  const [onlyAlerta, setOnlyAlerta] = useState(params.get("alerta") === "raio");
  const [onlyRealizadas, setOnlyRealizadas] = useState(false);
  const [tipo, setTipo] = useState<"todas" | "visitas" | "prospecoes">("todas");
  const [viewing, setViewing] = useState<Visit | null>(null);
  const [toDelete, setToDelete] = useState<Visit | null>(null);
  const [photoView, setPhotoView] = useState<string | null>(null);

  const clientOf = (id: string) => clients.find((c) => c.id === id);
  const prospectClientIds = useMemo(
    () => new Set(clients.filter((c) => c.isProspecao).map((c) => c.id)),
    [clients],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return visits
      .filter((v) => (onlyAlerta ? v.withinRadius === false : true))
      .filter((v) => (onlyRealizadas ? v.status === "realizada" : true))
      .filter((v) => {
        const isProsp = prospectClientIds.has(v.clientId);
        if (tipo === "visitas") return !isProsp;
        if (tipo === "prospecoes") return isProsp;
        return true;
      })
      .filter((v) => {
        if (!q) return true;
        const c = clients.find((x) => x.id === v.clientId);
        return `${c?.name ?? ""} ${c?.city ?? ""}`.toLowerCase().includes(q);
      });
  }, [visits, search, onlyAlerta, onlyRealizadas, tipo, prospectClientIds, clients]);

  // agrupa por dia (mais recente primeiro)
  const groups = useMemo(() => {
    const map = new Map<string, Visit[]>();
    for (const v of filtered) {
      const k = v.visitedAt.slice(0, 10);
      const list = map.get(k) ?? [];
      list.push(v);
      map.set(k, list);
    }
    return [...map.entries()]
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .map(([date, items]) => ({ date, items }));
  }, [filtered]);

  const totalProsp = useMemo(
    () => visits.filter((v) => prospectClientIds.has(v.clientId)).length,
    [visits, prospectClientIds],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Visitas registradas</h1>
          <p className="text-sm text-muted-foreground">
            {visits.length} no total · {totalProsp} prospecção(ões)
          </p>
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
        <Select value={tipo} onValueChange={(v) => setTipo(v as typeof tipo)}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Visitas e prospecções</SelectItem>
            <SelectItem value="visitas">Somente visitas</SelectItem>
            <SelectItem value="prospecoes">Somente prospecções</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {groups.length === 0 ? (
        <div className="card-soft flex flex-col items-center gap-2 p-12 text-center text-muted-foreground">
          <CalendarX2 className="h-8 w-8" />
          <p>Nenhuma visita encontrada.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map(({ date, items }) => (
            <section key={date}>
              <div className="mb-2 flex items-baseline gap-2">
                <h2 className="text-sm font-semibold">{formatDateBR(date)}</h2>
                <span className="text-xs text-muted-foreground">
                  · {items.length} {items.length === 1 ? "registro" : "registros"}
                </span>
              </div>
              <div className="space-y-3">
                {items.map((v) => {
                  const c = clientOf(v.clientId);
                  const isProsp = c?.isProspecao;
                  const fotos = fotosOf(v);
                  return (
                    <div
                      key={v.id}
                      onClick={() => setViewing(v)}
                      className={`card-soft flex cursor-pointer flex-col gap-3 p-4 transition-colors hover:bg-secondary/40 sm:flex-row sm:items-start ${
                        isProsp ? "border-violet-500/40" : ""
                      }`}
                    >
                      {fotos.length > 0 ? (
                        <button onClick={() => setViewing(v)} className="relative shrink-0">
                          <img
                            src={fotos[0]}
                            alt="Comprovante"
                            className="h-24 w-32 rounded-lg object-cover"
                          />
                          {fotos.length > 1 && (
                            <span className="absolute bottom-1.5 right-1.5 rounded bg-black/65 px-1.5 py-0.5 text-[10px] text-white">
                              +{fotos.length - 1} foto(s)
                            </span>
                          )}
                        </button>
                      ) : (
                        <div className="flex h-24 w-32 items-center justify-center rounded-lg bg-secondary text-xs text-muted-foreground">
                          Sem foto
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold">{c?.name ?? "Cliente removido"}</span>
                          {isProsp && (
                            <Badge
                              variant="outline"
                              className="border-violet-500/40 text-violet-600 dark:text-violet-300"
                            >
                              Prospecção
                            </Badge>
                          )}
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
                          {formatDateBR(v.visitedAt.slice(0, 10))} às {horaOf(v)} · {c?.city}
                        </p>
                        <div className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
                          <div>
                            <div className="text-xs font-medium text-muted-foreground">
                              {v.status === "nao_realizada" ? "Justificativa" : "O que foi feito"}
                            </div>
                            <p className="line-clamp-2">{v.resultComments || "—"}</p>
                          </div>
                          <div>
                            <div className="text-xs font-medium text-muted-foreground">Próxima visita</div>
                            <p className="line-clamp-2">{v.nextActions || "—"}</p>
                          </div>
                        </div>
                        <p className="mt-2 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                          <span>
                            Visita em:{" "}
                            <span className="font-medium text-foreground">{c?.city || "—"}</span>
                          </span>
                          {v.withinRadius === false && v.distanceFromClientM != null && (
                            <span className="text-destructive">
                              {formatDistanceM(v.distanceFromClientM)} do endereço cadastrado (raio{" "}
                              {settings.visitRadiusM} m)
                            </span>
                          )}
                        </p>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        {fotos.length > 0 && (
                          <Button
                            variant="outline"
                            size="sm"
                            asChild
                            onClick={(e) => e.stopPropagation()}
                          >
                            <a href={fotos[0]} target="_blank" rel="noreferrer">
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            setToDelete(v);
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="max-h-[calc(100dvh-2.5rem)] max-w-2xl overflow-y-auto overscroll-contain">
          {viewing &&
            (() => {
              const v = viewing;
              const c = clientOf(v.clientId);
              const isProsp = c?.isProspecao;
              const fotos = fotosOf(v);
              return (
                <>
                  <DialogHeader>
                    <DialogTitle>{c?.name ?? "Cliente removido"}</DialogTitle>
                    <DialogDescription>
                      {formatDateBR(v.visitedAt.slice(0, 10))} às {horaOf(v)} · {c?.city}
                    </DialogDescription>
                  </DialogHeader>

                  <div className="flex flex-wrap items-center gap-2">
                    {isProsp && (
                      <Badge
                        variant="outline"
                        className="border-violet-500/40 text-violet-600 dark:text-violet-300"
                      >
                        Prospecção
                      </Badge>
                    )}
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

                  {c && (
                    <div className="grid gap-2 rounded-lg border p-3 text-sm sm:grid-cols-2">
                      {c.segment && (
                        <div>
                          <div className="text-xs font-medium text-muted-foreground">Segmento</div>
                          <div>{c.segment}</div>
                        </div>
                      )}
                      {c.responsavel && (
                        <div>
                          <div className="text-xs font-medium text-muted-foreground">Responsável</div>
                          <div>{c.responsavel}</div>
                        </div>
                      )}
                      {c.contato && (
                        <div>
                          <div className="text-xs font-medium text-muted-foreground">Contato</div>
                          <div>{c.contato}</div>
                        </div>
                      )}
                      {c.city && (
                        <div>
                          <div className="text-xs font-medium text-muted-foreground">Cidade</div>
                          <div>{c.city}</div>
                        </div>
                      )}
                      {c.address && (
                        <div className="sm:col-span-2">
                          <div className="text-xs font-medium text-muted-foreground">Endereço</div>
                          <div>{c.address}</div>
                        </div>
                      )}
                      {c.obs && (
                        <div className="sm:col-span-2">
                          <div className="text-xs font-medium text-muted-foreground">Observações</div>
                          <div>{c.obs}</div>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="grid gap-2 text-sm sm:grid-cols-2">
                    <div>
                      <div className="text-xs font-medium text-muted-foreground">
                        {v.status === "nao_realizada" ? "Justificativa" : "O que foi feito"}
                      </div>
                      <p className="mt-0.5">{v.resultComments || "—"}</p>
                    </div>
                    <div>
                      <div className="text-xs font-medium text-muted-foreground">Próxima visita</div>
                      <p className="mt-0.5">{v.nextActions || "—"}</p>
                    </div>
                  </div>

                  {v.withinRadius === false && v.distanceFromClientM != null && (
                    <p className="text-sm text-destructive">
                      {formatDistanceM(v.distanceFromClientM)} do endereço cadastrado (raio{" "}
                      {settings.visitRadiusM} m)
                    </p>
                  )}

                  {fotos.length > 0 && (
                    <div>
                      <div className="mb-1 text-xs font-medium text-muted-foreground">
                        Fotos ({fotos.length})
                      </div>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                        {fotos.map((f, i) => (
                          <button
                            key={i}
                            onClick={() => setPhotoView(f)}
                            title="Clique para ampliar"
                            className="cursor-zoom-in"
                          >
                            <img
                              src={f}
                              alt={`Foto ${i + 1}`}
                              className="h-32 w-full rounded-lg object-cover"
                            />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              );
            })()}
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
    </div>
  );
}
