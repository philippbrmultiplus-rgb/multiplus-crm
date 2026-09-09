import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/** pede a justificativa obrigatória antes de marcar uma visita como não realizada */
export function NotDoneDialog({
  open,
  onClose,
  clientName,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  clientName: string;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const confirm = () => {
    const text = reason.trim();
    if (!text) {
      setError("Escreva o motivo para finalizar como não realizada.");
      return;
    }
    onConfirm(text);
    setReason("");
    setError(null);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            Justificar visita não realizada
          </DialogTitle>
          <DialogDescription>
            Cliente: <span className="font-medium text-foreground">{clientName}</span>
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label>
            Motivo da não realização <span className="font-normal text-muted-foreground">(obrigatório)</span>
          </Label>
          <Textarea
            rows={3}
            autoFocus
            placeholder="Ex.: cliente não estava no local, loja fechada, recusou atendimento…"
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              if (e.target.value.trim()) setError(null);
            }}
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={confirm} disabled={!reason.trim()}>
            Finalizar como não realizada
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
