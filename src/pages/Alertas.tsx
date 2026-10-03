import { useMemo, useState } from "react";
import { AlertTriangle, CalendarClock, MapPin, Plus, Trash2, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { NewAlertDialog } from "@/components/alerts/NewAlertDialog";
import { PhotoZoom } from "@/components/visitas/PhotoZoom";
import { cidadeComDistancia } from "@/components/clients/clientBits";
import { useData } from "@/lib/DataContext";
import { formatDateBR } from "@/lib/geo";

/** data e hora (fuso local) de um alerta registrado à mão */
function dataHora(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function Alertas() {
  const { state, role, user, deleteAlert } = useData();
  const { clients, alerts, visits } = state;
  const [novo, setNovo] = useState(false);
  // o gerente é somente leitura; coordenador e vendedor registram alertas
  const podeRegistrar = role === "coordenador" || role === "vendedor";

  const clientOf = (id: string) => clients.find((c) => c.id === id);
  const dasVisitas = useMemo(() => visits.filter((v) => v.alerta), [visits]);
  const total = alerts.length + dasVisitas.length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Alertas</h1>
          <p className="text-sm text-muted-foreground">
            Alertas apontados pela equipe, sem depender de visita. Coordenador e vendedor podem marcar
            qualquer cliente.
          </p>
        </div>
        {podeRegistrar && (
          <Button onClick={() => setNovo(true)}>
            <Plus className="mr-1.5 h-4 w-4" /> Novo alerta
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Badge className="border border-destructive/50 bg-destructive/10 text-destructive">
          <AlertTriangle className="mr-1 h-3 w-3" /> Registrados à mão {alerts.length}
        </Badge>
        <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300">
          Marcados nas visitas {dasVisitas.length}
        </Badge>
      </div>

      <Card className="card-soft border-destructive/30">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="h-4 w-4 text-destructive" /> Registrados à mão
          </CardTitle>
          <CardDescription>
            Alertas criados por você ou pelo vendedor, a qualquer momento e para qualquer cliente.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {alerts.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum alerta registrado à mão ainda.</p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {alerts.map((a) => {
                const c = clientOf(a.clientId);
                const podeExcluir = role === "coordenador" || a.createdBy === user?.id;
                return (
                  <div key={a.id} className="rounded-lg border border-destructive/40 bg-destructive/5 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate font-semibold leading-tight">
                          {c?.name ?? "Cliente removido"}
                        </div>
                        {c && (
                          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                            {c.segment && <span>{c.segment}</span>}
                            <span>· {cidadeComDistancia(c)}</span>
                          </div>
                        )}
                      </div>
                      {podeExcluir && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="shrink-0 text-muted-foreground hover:text-destructive"
                          title="Remover este alerta"
                          onClick={() => deleteAlert(a.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    <p className="mt-2 text-sm text-destructive">{a.motivo}</p>
                    {a.photoUrl && (
                      <PhotoZoom
                        src={a.photoUrl}
                        alt={`Foto do alerta de ${c?.name ?? "cliente"}`}
                        className="mt-2 block w-full"
                        imgClassName="h-32 w-full rounded-lg object-cover"
                      />
                    )}
                    <p className="mt-2 flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5" />
                        {a.createdByName || "equipe"}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <CalendarClock className="h-3.5 w-3.5" />
                        {dataHora(a.createdAt)}
                      </span>
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="card-soft">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <MapPin className="h-4 w-4 text-primary" /> Marcados na visita
          </CardTitle>
          <CardDescription>
            Alertas que o vendedor marcou ao registrar a visita (somente leitura).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {dasVisitas.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum alerta marcado nas visitas.</p>
          ) : (
            <ul className="space-y-2">
              {dasVisitas.map((v) => {
                const c = clientOf(v.clientId);
                return (
                  <li key={v.id} className="rounded-md border p-2.5 text-sm">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="font-medium">{c?.name ?? "Cliente removido"}</span>
                      <span className="text-xs text-muted-foreground">
                        {formatDateBR(v.visitedAt.slice(0, 10))}
                      </span>
                    </div>
                    <p className="mt-1 text-destructive">
                      {v.alertaMotivo || "sem motivo informado"}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {total === 0 && podeRegistrar && (
        <p className="text-sm text-muted-foreground">
          Use <b>Novo alerta</b> para apontar um cliente, mesmo que ainda não tenha feito a visita.
        </p>
      )}

      <NewAlertDialog open={novo} onClose={() => setNovo(false)} />
    </div>
  );
}
