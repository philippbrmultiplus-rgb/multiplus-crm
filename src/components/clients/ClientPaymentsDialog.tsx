import { Wallet } from "lucide-react";
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
import { useData } from "@/lib/DataContext";
import type { Client } from "@/lib/types";

/** condições de pagamento do cliente, conforme a planilha de pagamentos */
export function ClientPaymentsDialog({
  client,
  onClose,
}: {
  client: Client | null;
  onClose: () => void;
}) {
  const { state } = useData();
  if (!client) return null;

  const pagamentos = state.payments.filter((p) => p.clientId === client.id);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[calc(100dvh-2.5rem)] max-w-lg overflow-y-auto overscroll-contain">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="h-4 w-4 text-primary" /> Pago
          </DialogTitle>
          <DialogDescription>
            {client.name}
            {client.city ? ` · ${client.city}` : ""} — valor que pagamos e forma de pagamento acertados com o cliente.
          </DialogDescription>
        </DialogHeader>

        {pagamentos.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum valor de pagamento registrado para este cliente.
          </p>
        ) : (
          <div className="space-y-3">
            {pagamentos.map((p) => (
              <div key={p.id} className="space-y-2 rounded-lg border p-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-medium text-muted-foreground">Valor pago</span>
                  <Badge className="bg-primary/10 text-primary">{p.valor || "—"}</Badge>
                  {p.servico && <Badge variant="outline">{p.servico}</Badge>}
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div>
                    <span className="block text-[11px] text-muted-foreground">Forma de pagamento</span>
                    <span>{p.modalidade || "—"}</span>
                  </div>
                  <div>
                    <span className="block text-[11px] text-muted-foreground">A pagar máquina</span>
                    <span>{p.maquina && p.maquina !== "_" ? p.maquina : "—"}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
