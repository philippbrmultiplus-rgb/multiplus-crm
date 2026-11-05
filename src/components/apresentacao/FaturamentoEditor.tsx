import { useEffect, useState } from "react";
import { Loader2, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useData } from "@/lib/DataContext";

interface Linha {
  cliente: string;
  valor: number;
}

const reais = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 });

/** faturamento do mês, por cliente — preenchido à mão para o slide de resultado */
export function FaturamentoEditor({ mes, nomeMes }: { mes: string; nomeMes: string }) {
  const { state, salvarFaturamento } = useData();
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    const doBanco = state.faturamento
      .filter((f) => f.mes.slice(0, 7) === mes.slice(0, 7))
      .sort((a, b) => a.posicao - b.posicao);
    setLinhas(
      doBanco.length > 0
        ? doBanco.map((f) => ({ cliente: f.cliente, valor: f.valor }))
        : [{ cliente: "", valor: 0 }],
    );
  }, [state.faturamento, mes]);

  const salvar = async () => {
    const validas = linhas.filter((l) => l.cliente.trim());
    setSalvando(true);
    const erro = await salvarFaturamento(mes, validas);
    setSalvando(false);
    if (erro) toast.error("Não foi possível salvar o faturamento", { description: erro });
    else toast.success(`Faturamento de ${nomeMes} salvo`);
  };

  const total = linhas.reduce((acc, l) => acc + (Number(l.valor) || 0), 0);

  return (
    <Card className="card-soft">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Faturamento do mês (preenchimento manual)</CardTitle>
        <CardDescription>
          Valores recebidos em {nomeMes}, por cliente · aparece em destaque no slide de resultado comercial.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="grid grid-cols-[1.6fr_0.8fr_auto] gap-2 px-1 text-[11px] font-medium text-muted-foreground">
          <span>Cliente</span>
          <span className="text-right">Valor faturado (R$)</span>
          <span />
        </div>

        {linhas.map((linha, i) => (
          <div key={i} className="grid grid-cols-[1.6fr_0.8fr_auto] items-center gap-2">
            <Input
              className="h-8"
              placeholder="Nome do cliente"
              value={linha.cliente}
              onChange={(e) =>
                setLinhas(linhas.map((l, j) => (j === i ? { ...l, cliente: e.target.value } : l)))
              }
            />
            <Input
              type="number"
              step="0.01"
              className="h-8 text-right"
              placeholder="0,00"
              value={linha.valor}
              onChange={(e) =>
                setLinhas(linhas.map((l, j) => (j === i ? { ...l, valor: Number(e.target.value) || 0 } : l)))
              }
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground"
              onClick={() => setLinhas(linhas.filter((_, j) => j !== i))}
              title="Remover"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <Button variant="outline" size="sm" onClick={() => setLinhas([...linhas, { cliente: "", valor: 0 }])}>
            <Plus className="mr-1 h-3.5 w-3.5" /> Cliente
          </Button>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">
              Total faturado: <strong className="text-foreground">{reais(total)}</strong>
            </span>
            <Button onClick={salvar} disabled={salvando}>
              {salvando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Salvar faturamento
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
