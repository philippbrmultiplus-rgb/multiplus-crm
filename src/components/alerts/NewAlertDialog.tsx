import { useMemo, useState } from "react";
import { AlertTriangle, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cidadeComDistancia } from "@/components/clients/clientBits";
import { useData } from "@/lib/DataContext";
import type { Client } from "@/lib/types";

/** janela para registrar um alerta em qualquer cliente, sem precisar de visita */
export function NewAlertDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, addAlert } = useData();
  const [busca, setBusca] = useState("");
  const [client, setClient] = useState<Client | null>(null);
  const [motivo, setMotivo] = useState("");

  const resultados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const lista = q
      ? state.clients.filter((c) =>
          `${c.name} ${c.city} ${c.segment}`.toLowerCase().includes(q),
        )
      : state.clients;
    return lista.slice(0, 8);
  }, [state.clients, busca]);

  const fechar = () => {
    setBusca("");
    setClient(null);
    setMotivo("");
    onClose();
  };

  const confirmar = () => {
    if (!client || !motivo.trim()) return;
    addAlert(client.id, motivo);
    fechar();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && fechar()}>
      <DialogContent className="max-h-[calc(100dvh-2.5rem)] max-w-lg overflow-y-auto overscroll-contain">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive" /> Novo alerta
          </DialogTitle>
          <DialogDescription>
            Escolha o cliente e escreva o motivo. Não é preciso ter feito a visita — o alerta fica
            visível para toda a equipe.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Cliente</Label>
            {client ? (
              <div className="flex items-center justify-between gap-2 rounded-lg border p-2.5">
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{client.name}</span>
                  <span className="block text-xs text-muted-foreground">
                    {cidadeComDistancia(client)}
                  </span>
                </span>
                <Button variant="ghost" size="sm" onClick={() => setClient(null)}>
                  Trocar
                </Button>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    autoFocus
                    className="pl-8"
                    placeholder="Buscar por nome, cidade ou segmento…"
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                  />
                </div>
                <div className="max-h-56 space-y-1 overflow-y-auto overscroll-contain">
                  {resultados.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setClient(c)}
                      className="flex w-full flex-wrap items-center justify-between gap-2 rounded-md border p-2 text-left text-sm transition-colors hover:bg-secondary/40"
                    >
                      <span className="min-w-0 truncate font-medium">{c.name}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {cidadeComDistancia(c)}
                      </span>
                    </button>
                  ))}
                  {resultados.length === 0 && (
                    <p className="p-2 text-sm text-muted-foreground">Nenhum cliente encontrado.</p>
                  )}
                </div>
              </>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="alerta-motivo">Motivo do alerta</Label>
            <Textarea
              id="alerta-motivo"
              rows={3}
              placeholder="Ex.: cliente reclamou do preço; caçamba cheia sem coleta; pediu para não receber visita…"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={fechar}>
            Cancelar
          </Button>
          <Button variant="destructive" disabled={!client || !motivo.trim()} onClick={confirmar}>
            Registrar alerta
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
