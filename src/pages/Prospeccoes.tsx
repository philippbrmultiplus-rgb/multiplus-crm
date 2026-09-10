import { useMemo, useState } from "react";
import { Building2, Phone, Search, Target, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useData } from "@/lib/DataContext";
import { formatDateBR } from "@/lib/geo";
import type { Client, ProspeccaoStatus, Visit } from "@/lib/types";

const STATUS_LABEL: Record<ProspeccaoStatus, string> = {
  em_negociacao: "Em negociação",
  fechado: "Fechado",
  perdido: "Perdido",
};

const STATUS_TONE: Record<ProspeccaoStatus, string> = {
  em_negociacao: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  fechado: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  perdido: "bg-destructive/15 text-destructive",
};

export default function Prospeccoes() {
  const { state, setProspeccaoStatus } = useData();
  const { clients, visits } = state;

  const [search, setSearch] = useState("");
  const [situ, setSitu] = useState("todas");

  const lastVisitOf = useMemo(() => {
    const map = new Map<string, Visit>();
    for (const v of visits) {
      const cur = map.get(v.clientId);
      if (!cur || v.visitedAt > cur.visitedAt) map.set(v.clientId, v);
    }
    return map;
  }, [visits]);

  const prospects = useMemo(() => {
    const q = search.trim().toLowerCase();
    return clients
      .filter((c) => c.isProspecao)
      .filter((c) => {
        if (situ === "todas") return true;
        return (c.prospeccaoStatus ?? "em_negociacao") === situ;
      })
      .filter((c) => (q ? `${c.name} ${c.responsavel ?? ""} ${c.city} ${c.segment}`.toLowerCase().includes(q) : true))
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }, [clients, search, situ]);

  const counts = useMemo(() => {
    const all = clients.filter((c) => c.isProspecao);
    return {
      total: all.length,
      em_negociacao: all.filter((c) => (c.prospeccaoStatus ?? "em_negociacao") === "em_negociacao").length,
      fechado: all.filter((c) => c.prospeccaoStatus === "fechado").length,
      perdido: all.filter((c) => c.prospeccaoStatus === "perdido").length,
    };
  }, [clients]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Prospecções</h1>
          <p className="text-sm text-muted-foreground">
            Todos os clientes prospectados, com a situação atual. Atualiza automaticamente.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Badge className={STATUS_TONE.em_negociacao}>Em negociação {counts.em_negociacao}</Badge>
          <Badge className={STATUS_TONE.fechado}>Fechado {counts.fechado}</Badge>
          <Badge className={STATUS_TONE.perdido}>Perdido {counts.perdido}</Badge>
        </div>
      </div>

      <div className="card-soft flex flex-wrap items-end gap-2 p-3">
        <div className="relative min-w-56 flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Buscar por cliente, responsável, cidade ou segmento…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={situ} onValueChange={setSitu}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Situação" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as situações</SelectItem>
            <SelectItem value="em_negociacao">Em negociação</SelectItem>
            <SelectItem value="fechado">Fechado</SelectItem>
            <SelectItem value="perdido">Perdido</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {prospects.length === 0 ? (
        <div className="card-soft flex flex-col items-center gap-3 p-12 text-center">
          <Target className="h-8 w-8 text-muted-foreground" />
          <p className="max-w-md text-sm text-muted-foreground">
            {counts.total === 0
              ? "Nenhuma prospecção registrada ainda. Registre em “Nova prospecção” na sua rota (hoje ou semana)."
              : "Nenhuma prospecção corresponde aos filtros atuais."}
          </p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {prospects.map((c) => (
            <ProspectCard
              key={c.id}
              client={c}
              visit={lastVisitOf.get(c.id)}
              onStatus={(s) => setProspeccaoStatus(c.id, s)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ProspectCard({
  client,
  visit,
  onStatus,
}: {
  client: Client;
  visit?: Visit;
  onStatus: (s: ProspeccaoStatus) => void;
}) {
  const status: ProspeccaoStatus = client.prospeccaoStatus ?? "em_negociacao";
  const photo = visit?.photoUrl ?? visit?.photoData ?? null;

  return (
    <div className="card-soft flex flex-col gap-3 p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate font-semibold leading-tight">{client.name}</div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
            {client.segment && <span>{client.segment}</span>}
            {client.city && <span>· {client.city}</span>}
          </div>
        </div>
        <Badge className={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge>
      </div>

      {photo && (
        <img src={photo} alt="Foto da prospecção" className="h-36 w-full rounded-lg object-cover" crossOrigin="anonymous" />
      )}

      <div className="space-y-1 text-sm">
        {client.responsavel && (
          <p className="flex items-center gap-1.5">
            <User className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="truncate">{client.responsavel}</span>
          </p>
        )}
        {client.contato && (
          <p className="flex items-center gap-1.5">
            <Phone className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="truncate">{client.contato}</span>
          </p>
        )}
        {(client.address || client.city) && (
          <p className="flex items-center gap-1.5 text-muted-foreground">
            <Building2 className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{[client.address, client.city].filter(Boolean).join(" · ")}</span>
          </p>
        )}
        {client.obs && <p className="line-clamp-2 text-xs text-muted-foreground">{client.obs}</p>}
        {visit && (
          <p className="text-xs text-muted-foreground">
            Prospecção registrada em {formatDateBR(visit.visitedAt.slice(0, 10))}
          </p>
        )}
      </div>

      <div className="mt-auto flex flex-wrap gap-2 border-t pt-3">
        {(["em_negociacao", "fechado", "perdido"] as ProspeccaoStatus[]).map((s) => (
          <Button
            key={s}
            size="sm"
            variant={status === s ? "default" : "outline"}
            onClick={() => onStatus(s)}
          >
            {STATUS_LABEL[s]}
          </Button>
        ))}
      </div>
    </div>
  );
}
