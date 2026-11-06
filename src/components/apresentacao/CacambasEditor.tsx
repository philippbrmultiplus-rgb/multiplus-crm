import { useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useData } from "@/lib/DataContext";
import type { CacambasMes, CacambasTipo } from "@/lib/types";

const vazio = (): CacambasTipo => ({
  total: 0,
  clientes: 0,
  estoques: 0,
  manutencao: 0,
  caminhoes: 0,
  segmentos: [],
});

const campos: { chave: keyof Omit<CacambasTipo, "segmentos">; rotulo: string }[] = [
  { chave: "total", rotulo: "Total" },
  { chave: "clientes", rotulo: "Em clientes" },
  { chave: "estoques", rotulo: "Em estoques" },
  { chave: "manutencao", rotulo: "Em manutenção" },
  { chave: "caminhoes", rotulo: "Em caminhões" },
];

/** preenchimento manual das caçambas que aparecem na apresentação */
export function CacambasEditor({ mes, nomeMes }: { mes: string; nomeMes: string }) {
  const { state, salvarCacambas } = useData();
  const [rollon, setRollon] = useState<CacambasTipo>(vazio);
  const [poli, setPoli] = useState<CacambasTipo>(vazio);
  const [salvando, setSalvando] = useState(false);
  /** enquanto o usuário está digitando, nada do banco sobrescreve os campos */
  const [editando, setEditando] = useState(false);

  const doBanco = useMemo(
    () => state.cacambas.find((c) => c.mes.slice(0, 7) === mes.slice(0, 7)),
    [state.cacambas, mes],
  );

  const assinatura = JSON.stringify(doBanco ?? null);

  useEffect(() => {
    setEditando(false);
  }, [mes]);

  useEffect(() => {
    if (editando) return;
    setRollon(doBanco ? { ...doBanco.rollon } : vazio());
    setPoli(doBanco ? { ...doBanco.poli } : vazio());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assinatura, editando]);

  const salvar = async () => {
    setSalvando(true);
    const registro: CacambasMes = { mes, rollon, poli };
    const erro = await salvarCacambas(registro);
    setSalvando(false);
    // em caso de erro, mantém o que foi digitado na tela
    if (!erro) setEditando(false);
    if (erro) toast.error("Não foi possível salvar as caçambas", { description: erro });
    else toast.success(`Caçambas de ${nomeMes} salvas`);
  };

  const grupo = (
    titulo: string,
    valor: CacambasTipo,
    setValor: (v: CacambasTipo) => void,
  ) => (
    <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
      <p className="text-sm font-semibold">{titulo}</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {campos.map((c) => (
          <div key={c.chave} className="space-y-1">
            <Label className="text-[11px] text-muted-foreground">{c.rotulo}</Label>
            <Input
              type="number"
              className="h-8"
              value={valor[c.chave]}
              onChange={(e) => {
                setEditando(true);
                setValor({ ...valor, [c.chave]: Number(e.target.value) || 0 });
              }}
            />
          </div>
        ))}
      </div>

      <div className="space-y-1">
        <Label className="text-[11px] text-muted-foreground">Caçambas por segmento</Label>
        {valor.segmentos.map((seg, i) => (
          <div key={i} className="flex items-center gap-1">
            <Input
              className="h-8 flex-1"
              placeholder="Segmento"
              value={seg.nome}
              onChange={(e) => {
                setEditando(true);
                const segmentos = valor.segmentos.map((s, j) =>
                  j === i ? { ...s, nome: e.target.value } : s,
                );
                setValor({ ...valor, segmentos });
              }}
            />
            <Input
              type="number"
              className="h-8 w-20"
              value={seg.qtd}
              onChange={(e) => {
                setEditando(true);
                const segmentos = valor.segmentos.map((s, j) =>
                  j === i ? { ...s, qtd: Number(e.target.value) || 0 } : s,
                );
                setValor({ ...valor, segmentos });
              }}
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground"
              onClick={() => {
                setEditando(true);
                setValor({ ...valor, segmentos: valor.segmentos.filter((_, j) => j !== i) });
              }}
              title="Remover"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setEditando(true);
            setValor({ ...valor, segmentos: [...valor.segmentos, { nome: "", qtd: 0 }] });
          }}
        >
          <Plus className="mr-1 h-3.5 w-3.5" /> Segmento
        </Button>
      </div>
    </div>
  );

  return (
    <Card className="card-soft">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Distribuição de caçambas (preenchimento manual)</CardTitle>
        <CardDescription>
          Quantidades que entram nos slides de caçamba de {nomeMes} · cada mês tem os seus números.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-3 lg:grid-cols-2">
          {grupo("Rollon 26 m³", rollon, setRollon)}
          {grupo("Poli 5 m³", poli, setPoli)}
        </div>
        <div className="flex justify-end">
          <Button onClick={salvar} disabled={salvando}>
            {salvando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Salvar caçambas
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
