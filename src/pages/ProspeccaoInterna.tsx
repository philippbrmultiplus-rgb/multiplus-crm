import { useMemo, useState } from "react";
import { ClipboardList, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useData } from "@/lib/DataContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { formatDateBR } from "@/lib/geo";
import type { InternalProspect } from "@/lib/types";

const VAZIO = "";

/** cadastro interno de prospecção: ficha do cliente conversado, sem visita em campo */
export default function ProspeccaoInterna() {
  const { state, role, user, addInternalProspect, deleteInternalProspect } = useData();
  const { clients, internalProspects } = state;
  const isMobile = useIsMobile();
  // o gerente é somente leitura; coordenador e vendedor cadastram
  const podeCadastrar = role === "coordenador" || role === "vendedor";

  const [nome, setNome] = useState(VAZIO);
  const [cidade, setCidade] = useState(VAZIO);
  const [endereco, setEndereco] = useState(VAZIO);
  const [contato, setContato] = useState(VAZIO);
  const [telefone, setTelefone] = useState(VAZIO);
  const [segmentoComercial, setSegmentoComercial] = useState(VAZIO);
  const [segmentoLogistico, setSegmentoLogistico] = useState(VAZIO);
  const [observacoes, setObservacoes] = useState(VAZIO);
  const [erro, setErro] = useState<string | null>(null);
  const [excluir, setExcluir] = useState<InternalProspect | null>(null);

  /** segmentos logísticos já usados na carteira */
  const segmentos = useMemo(
    () =>
      [...new Set(clients.map((c) => c.segment).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b, "pt-BR"),
      ),
    [clients],
  );

  const salvar = () => {
    if (!nome.trim()) {
      setErro("Informe o nome do cliente.");
      return;
    }
    setErro(null);
    addInternalProspect({
      nome: nome.trim(),
      cidade: cidade.trim(),
      endereco: endereco.trim(),
      contato: contato.trim(),
      telefone: telefone.trim(),
      segmentoComercial: segmentoComercial.trim(),
      segmentoLogistico,
      observacoes: observacoes.trim(),
    });
    setNome(VAZIO);
    setCidade(VAZIO);
    setEndereco(VAZIO);
    setContato(VAZIO);
    setTelefone(VAZIO);
    setSegmentoComercial(VAZIO);
    setSegmentoLogistico(VAZIO);
    setObservacoes(VAZIO);
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Prospecção interna</h1>
        <p className="text-sm text-muted-foreground">
          Ficha de prospecção preenchida internamente (sem visita em campo) · {internalProspects.length}{" "}
          registro(s)
        </p>
      </div>

      {podeCadastrar && (
        <Card className="card-soft">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Plus className="h-4 w-4 text-primary" /> Nova prospecção interna
            </CardTitle>
            <CardDescription>
              Preencha os dados do cliente e o que foi conversado. Fica salvo na lista abaixo.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="ip-nome">Nome do cliente</Label>
                <Input
                  id="ip-nome"
                  value={nome}
                  onChange={(e) => {
                    setNome(e.target.value);
                    if (e.target.value.trim()) setErro(null);
                  }}
                  placeholder="Ex.: Construtora Horizonte"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ip-cidade">Cidade</Label>
                <Input
                  id="ip-cidade"
                  value={cidade}
                  onChange={(e) => setCidade(e.target.value)}
                  placeholder="Porto Alegre"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ip-contato">Contato</Label>
                <Input
                  id="ip-contato"
                  value={contato}
                  onChange={(e) => setContato(e.target.value)}
                  placeholder="Nome de quem atendeu"
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="ip-endereco">Endereço completo</Label>
                <Input
                  id="ip-endereco"
                  value={endereco}
                  onChange={(e) => setEndereco(e.target.value)}
                  placeholder="Rua, número, bairro, cidade"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ip-telefone">Número do telefone</Label>
                <Input
                  id="ip-telefone"
                  value={telefone}
                  onChange={(e) => setTelefone(e.target.value)}
                  placeholder="(51) 9 9999-9999"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ip-comercial">Segmento comercial</Label>
                <Input
                  id="ip-comercial"
                  value={segmentoComercial}
                  onChange={(e) => setSegmentoComercial(e.target.value)}
                  placeholder="Ex.: construtora, gesseiro, entulho…"
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Segmento logístico</Label>
                <Select
                  value={segmentoLogistico || "__none__"}
                  onValueChange={(v) => setSegmentoLogistico(v === "__none__" ? "" : v)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecionar segmento logístico" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">—</SelectItem>
                    {segmentos.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="ip-obs">Observações — o que foi conversado</Label>
                <Textarea
                  id="ip-obs"
                  rows={3}
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  placeholder="Ex.: falei com o encarregado, pediu proposta para 2 caçambas por semana…"
                />
              </div>
            </div>

            {erro && <p className="text-sm text-destructive">{erro}</p>}

            <div className="flex justify-end">
              <Button onClick={salvar}>
                <Plus className="mr-1.5 h-4 w-4" /> Salvar prospecção
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="card-soft">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <ClipboardList className="h-4 w-4 text-primary" /> Prospecções internas registradas
          </CardTitle>
          <CardDescription>
            Fichas preenchidas pela equipe, da mais recente para a mais antiga.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {internalProspects.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma prospecção interna registrada ainda.</p>
          ) : (
            <div className={isMobile ? "space-y-3" : "grid gap-3 md:grid-cols-2 xl:grid-cols-3"}>
              {internalProspects.map((p) => {
                const podeExcluir = role === "coordenador" || p.createdBy === user?.id;
                return (
                  <div key={p.id} className="space-y-2 rounded-lg border p-3 text-sm">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate font-semibold leading-tight">{p.nome}</div>
                        <div className="mt-0.5 text-xs text-muted-foreground">
                          {[p.cidade, p.segmentoComercial].filter(Boolean).join(" · ") || "—"}
                        </div>
                      </div>
                      {podeExcluir && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 shrink-0 p-0 text-muted-foreground hover:text-destructive"
                          title="Remover esta prospecção interna"
                          onClick={() => setExcluir(p)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {p.segmentoLogistico && <Badge variant="outline">{p.segmentoLogistico}</Badge>}
                      {p.segmentoComercial && (
                        <Badge className="bg-primary/10 text-primary">{p.segmentoComercial}</Badge>
                      )}
                    </div>

                    <div className="space-y-1 text-xs text-muted-foreground">
                      {p.endereco && (
                        <p>
                          <b className="font-medium text-foreground">Endereço:</b> {p.endereco}
                        </p>
                      )}
                      {p.contato && (
                        <p>
                          <b className="font-medium text-foreground">Contato:</b> {p.contato}
                        </p>
                      )}
                      {p.telefone && (
                        <p>
                          <b className="font-medium text-foreground">Telefone:</b> {p.telefone}
                        </p>
                      )}
                    </div>

                    {p.observacoes && (
                      <p className="rounded-md bg-secondary/50 p-2 text-xs">
                        <b className="font-medium">O que foi conversado:</b> {p.observacoes}
                      </p>
                    )}

                    <p className="text-[11px] text-muted-foreground">
                      {formatDateBR(p.createdAt.slice(0, 10))}
                      {p.createdByName ? ` · ${p.createdByName}` : ""}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!excluir} onOpenChange={(o) => !o && setExcluir(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir prospecção interna?</AlertDialogTitle>
            <AlertDialogDescription>
              {excluir ? `A ficha de "${excluir.nome}" será removida. Essa ação não pode ser desfeita.` : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => {
                if (excluir) deleteInternalProspect(excluir.id);
                setExcluir(null);
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
