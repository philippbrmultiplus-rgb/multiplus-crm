import { useMemo, useState } from "react";
import { Clock, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ActivityDialog } from "@/components/rota/ActivityDialog";
import { useData } from "@/lib/DataContext";
import { formatDuracao, totalMinutos } from "@/lib/atividade";

/**
 * Atividades extras de um dia (viagem, manutenção, reunião…), separadas das visitas.
 * O coordenador monta na rota da semana; o vendedor pode lançar no dia dele.
 */
export function RouteActivities({
  weekStart,
  day,
  canEdit,
  showEmpty = false,
}: {
  weekStart: string;
  /** 1 = segunda … 6 = sábado */
  day: number;
  canEdit: boolean;
  /** mostra o aviso "nenhuma atividade" quando a lista está vazia */
  showEmpty?: boolean;
}) {
  const { state, role, user, deleteActivity } = useData();
  const [open, setOpen] = useState(false);

  const lista = useMemo(
    () =>
      state.activities
        .filter((a) => a.weekStart === weekStart && a.day === day)
        .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1)),
    [state.activities, weekStart, day],
  );

  if (lista.length === 0 && !canEdit && !showEmpty) return null;

  return (
    <div className="space-y-1.5">
      {lista.length > 0 && (
        <ul className="space-y-1.5">
          {lista.map((a) => {
            const podeExcluir = canEdit && (role === "coordenador" || a.createdBy === user?.id);
            return (
              <li key={a.id} className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-2 text-xs">
                <div className="flex items-start justify-between gap-2">
                  <span className="min-w-0 flex-1">
                    <span className="flex items-start gap-1.5 font-medium">
                      <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
                      <span className="break-words">{a.titulo}</span>
                    </span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-muted-foreground">
                      <span>{formatDuracao(a.durationMin)}</span>
                      {a.createdByName && <span>· {a.createdByName}</span>}
                    </span>
                    {a.obs && <span className="mt-0.5 block text-muted-foreground">{a.obs}</span>}
                  </span>
                  {podeExcluir && (
                    <button
                      type="button"
                      title="Remover esta atividade"
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => deleteActivity(a.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {lista.length > 0 && (
        <p className="text-[11px] text-muted-foreground">
          {formatDuracao(totalMinutos(lista))} em atividades extras
        </p>
      )}

      {lista.length === 0 && showEmpty && (
        <p className="text-xs text-muted-foreground">Nenhuma atividade extra neste dia.</p>
      )}

      {canEdit && (
        <Button variant="outline" size="sm" className="w-full text-xs" onClick={() => setOpen(true)}>
          <Plus className="mr-1 h-3.5 w-3.5" /> Atividade extra
        </Button>
      )}

      <ActivityDialog open={open} onClose={() => setOpen(false)} weekStart={weekStart} day={day} />
    </div>
  );
}
