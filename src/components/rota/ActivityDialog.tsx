import { useState } from "react";
import { CalendarClock } from "lucide-react";
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
import { useData } from "@/lib/DataContext";
import { DURACOES, formatDuracao, SUGESTOES_ATIVIDADE } from "@/lib/atividade";
import { DAY_NAMES } from "@/lib/geo";

/** registra uma atividade extra do dia (não é visita a cliente) */
export function ActivityDialog({
  open,
  onClose,
  weekStart,
  day,
}: {
  open: boolean;
  onClose: () => void;
  weekStart: string;
  day: number;
}) {
  const { addActivity } = useData();
  const [titulo, setTitulo] = useState("");
  const [obs, setObs] = useState("");
  const [minutos, setMinutos] = useState("30");
  const [erro, setErro] = useState<string | null>(null);

  const fechar = () => {
    setTitulo("");
    setObs("");
    setMinutos("30");
    setErro(null);
    onClose();
  };

  const salvar = () => {
    if (!titulo.trim()) {
      setErro("Escreva o que foi feito nessa atividade.");
      return;
    }
    addActivity(weekStart, day, titulo, obs, Number(minutos) || 0);
    fechar();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && fechar()}>
      <DialogContent className="max-h-[calc(100dvh-2.5rem)] max-w-lg overflow-y-auto overscroll-contain">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-amber-600 dark:text-amber-400" /> Atividade extra —{" "}
            {DAY_NAMES[day]}
          </DialogTitle>
          <DialogDescription>
            Para o que não é visita a cliente: viagem, manutenção do carro, reunião na empresa,
            prospecção na fábrica… Ela entra no dia junto com as visitas.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="atividade-titulo">O que foi feito</Label>
            <Input
              id="atividade-titulo"
              autoFocus
              placeholder="Ex.: viagem a Caxias do Sul"
              value={titulo}
              onChange={(e) => {
                setTitulo(e.target.value);
                if (e.target.value.trim()) setErro(null);
              }}
            />
            <div className="flex flex-wrap gap-1.5 pt-1">
              {SUGESTOES_ATIVIDADE.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => {
                    setTitulo(s === "Outro" ? "" : s);
                    setErro(null);
                  }}
                  className="rounded-full border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-primary"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="atividade-tempo">
              Tempo gasto <span className="font-normal text-muted-foreground">(minutos)</span>
            </Label>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                id="atividade-tempo"
                type="number"
                min={0}
                step={5}
                inputMode="numeric"
                className="w-24"
                value={minutos}
                onChange={(e) => setMinutos(e.target.value)}
              />
              <span className="text-xs text-muted-foreground">{formatDuracao(Number(minutos) || 0)}</span>
              <span className="flex flex-wrap gap-1.5">
                {DURACOES.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setMinutos(String(d))}
                    className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                      Number(minutos) === d
                        ? "border-primary bg-primary/10 text-primary"
                        : "text-muted-foreground hover:border-primary hover:text-primary"
                    }`}
                  >
                    {formatDuracao(d)}
                  </button>
                ))}
              </span>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="atividade-obs">
              Observação <span className="font-normal text-muted-foreground">(opcional)</span>
            </Label>
            <Textarea
              id="atividade-obs"
              rows={2}
              placeholder="Ex.: fui buscar peça na autorizada; cliente novo prospectado na fábrica…"
              value={obs}
              onChange={(e) => setObs(e.target.value)}
            />
          </div>

          {erro && <p className="text-sm text-destructive">{erro}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={fechar}>
            Cancelar
          </Button>
          <Button onClick={salvar}>Registrar atividade</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
