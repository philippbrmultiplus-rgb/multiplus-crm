import { useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useData } from "@/lib/DataContext";
import { distanciaDoCliente } from "@/lib/apresentacao";
import { formatM3 } from "@/lib/geo";

interface Linha {
  cliente: string;
  cidade: string;
  volume: number;
}

/** fila de espera de caçambas preenchida à mão, com a distância calculada da base */
export function FilaEditor({
  mes,
  nomeMes,
  tipo,
}: {
  mes: string;
  nomeMes: string;
  tipo: "rollon" | "poli";
}) {
  const rotulo = tipo === "rollon" ? "Rollon 26 m³" : "Poli 5 m³";
  const { state, salvarFila } = useData();
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [salvando, setSalvando] = useState(false);
  /** enquanto o usuário está digitando, nada do banco sobrescreve a lista */
  const [editando, setEditando] = useState(false);

  const doBanco = useMemo(
    () =>
      state.fila
        .filter((f) => f.mes.slice(0, 7) === mes.slice(0, 7) && f.tipo === tipo)
        .sort((a, b) => a.posicao - b.posicao)
        .map((f) => ({ cliente: f.cliente, cidade: f.cidade, volume: f.volume })),
    [state.fila, mes, tipo],
  );
  const assinatura = JSON.stringify(doBanco);

  // troca de mês/tipo recomeça o preenchimento
  useEffect(() => {
    setEditando(false);
  }, [mes, tipo]);

  useEffect(() => {
    if (editando) return;
    setLinhas(doBanco.length > 0 ? doBanco : [{ cliente: "", cidade: "", volume: 0 }]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assinatura, editando]);

  const salvar = async () => {
    const validas = linhas.filter((l) => l.cliente.trim());
    setSalvando(true);
    const erro = await salvarFila(mes, tipo, validas);
    setSalvando(false);
    // em caso de erro, mantém o que foi digitado na tela
    if (!erro) setEditando(false);
    if (erro) toast.error("Não foi possível salvar a fila de espera", { description: erro });
    else toast.success(`Fila de espera (${rotulo}) de ${nomeMes} salva`);
  };

  const total = linhas.reduce((acc, l) => acc + (Number(l.volume) || 0), 0);

  return (
    <Card className="card-soft">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Fila de espera · caçamba de {rotulo}</CardTitle>
        <CardDescription>
          Clientes que entram no slide de fila de espera de {nomeMes} · a distância sai do ponto base até a
          cidade. Sem linhas, o slide não é gerado.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="grid grid-cols-[1.4fr_1fr_0.7fr_0.8fr_auto] gap-2 px-1 text-[11px] font-medium text-muted-foreground">
          <span>Cliente</span>
          <span>Cidade</span>
          <span className="text-right">Distância</span>
          <span className="text-right">Volume/mês (m³)</span>
          <span />
        </div>

        {linhas.map((linha, i) => {
          const km = distanciaDoCliente(linha.cliente, linha.cidade, state.clients, state.settings);
          return (
            <div key={i} className="grid grid-cols-[1.4fr_1fr_0.7fr_0.8fr_auto] items-center gap-2">
              <Input
                className="h-8"
                placeholder="Nome do cliente"
                value={linha.cliente}
                onChange={(e) => {
                  setEditando(true);
                  setLinhas(linhas.map((l, j) => (j === i ? { ...l, cliente: e.target.value } : l)));
                }}
              />
              <Input
                className="h-8"
                placeholder="Cidade"
                value={linha.cidade}
                onChange={(e) => {
                  setEditando(true);
                  setLinhas(linhas.map((l, j) => (j === i ? { ...l, cidade: e.target.value } : l)));
                }}
              />
              <span
                className={`text-right text-sm font-medium tabular-nums ${km == null ? "text-muted-foreground" : "text-primary"}`}
                title={
                  km == null && (linha.cidade || linha.cliente)
                    ? "Sem coordenada cadastrada para esse cliente/cidade"
                    : undefined
                }
              >
                {km == null ? (linha.cidade || linha.cliente ? "sem coord." : "—") : `${formatM3(Math.round(km))} km`}
              </span>
              <Input
                type="number"
                className="h-8 text-right"
                placeholder="m³"
                value={linha.volume}
                onChange={(e) => {
                  setEditando(true);
                  setLinhas(
                    linhas.map((l, j) => (j === i ? { ...l, volume: Number(e.target.value) || 0 } : l)),
                  );
                }}
              />
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground"
                onClick={() => {
                  setEditando(true);
                  setLinhas(linhas.filter((_, j) => j !== i));
                }}
                title="Remover"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          );
        })}

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setEditando(true);
              setLinhas([...linhas, { cliente: "", cidade: "", volume: 0 }]);
            }}
          >
            <Plus className="mr-1 h-3.5 w-3.5" /> Cliente
          </Button>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">
              Total estimado: <strong className="text-foreground">{formatM3(Math.round(total * 10) / 10)} m³/mês</strong>
            </span>
            <Button onClick={salvar} disabled={salvando}>
              {salvando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Salvar fila
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
