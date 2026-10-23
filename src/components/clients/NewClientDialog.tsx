import { useState } from "react";
import { UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TierBadge } from "@/components/clients/clientBadges";
import { LeafletMap } from "@/components/map/LeafletMap";
import { useData } from "@/lib/DataContext";
import { cadenceLabel, tierOfFreq } from "@/lib/cadence";
import type { Client } from "@/lib/types";

const FREQ_OPTIONS = [0, 0.33, 0.5, 1, 2, 3, 4].map((f) => ({
  value: String(f),
  label: cadenceLabel(f),
}));

/** cadastro manual de um cliente novo (somente coordenador) */
export function NewClientDialog({
  onClose,
  segmentOptions,
}: {
  onClose: () => void;
  segmentOptions: string[];
}) {
  const { createClient } = useData();
  const [nome, setNome] = useState("");
  const [segmento, setSegmento] = useState("");
  const [segmentoComercial, setSegmentoComercial] = useState("");
  const [cidade, setCidade] = useState("");
  const [endereco, setEndereco] = useState("");
  const [contato, setContato] = useState("");
  const [responsavel, setResponsavel] = useState("");
  const [obs, setObs] = useState("");
  const [freq, setFreq] = useState("1");
  const [active, setActive] = useState(true);
  const [isProsp, setIsProsp] = useState(false);
  const [lastCollect, setLastCollect] = useState("");
  const [lastVisit, setLastVisit] = useState("");
  const [pos, setPos] = useState<{ lat: number; lng: number } | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const tier = tierOfFreq(parseFloat(freq));

  const salvar = () => {
    if (!nome.trim()) {
      setErro("Informe o nome do cliente.");
      return;
    }
    const cliente: Client = {
      id: `cli-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: nome.trim(),
      segment: segmento.trim(),
      segmentoComercial: segmentoComercial.trim() || null,
      city: cidade.trim(),
      address: endereco.trim(),
      state: "SP",
      contato: contato.trim() || null,
      responsavel: responsavel.trim() || null,
      obs: obs.trim() || undefined,
      active,
      isProspecao: isProsp,
      prospeccaoStatus: isProsp ? "em_negociacao" : null,
      tier,
      freqMonth: parseFloat(freq),
      lastCollectAt: lastCollect || null,
      lastVisitAt: lastVisit || null,
      lat: pos?.lat ?? null,
      lng: pos?.lng ?? null,
      geoAproximado: false,
      geocodeStatus: pos ? "ok" : "pendente",
      total2025: 0,
      total2026: 0,
      avgMonthly: 0,
    };
    createClient(cliente);
    toast.success(`Cliente "${cliente.name}" cadastrado.`);
    onClose();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[calc(100dvh-2.5rem)] max-w-2xl overflow-y-auto overscroll-contain">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-4 w-4 text-primary" /> Novo cliente
          </DialogTitle>
          <DialogDescription>
            Cadastro manual — o cliente entra na lista com todas as informações dos demais.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label>Nome</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome do cliente" />
          </div>

          <div className="space-y-2">
            <Label>Segmento logístico</Label>
            <Select value={segmento || "__none__"} onValueChange={(v) => setSegmento(v === "__none__" ? "" : v)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecionar segmento" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">—</SelectItem>
                {segmentOptions.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Segmento comercial</Label>
            <Input
              value={segmentoComercial}
              onChange={(e) => setSegmentoComercial(e.target.value)}
              placeholder="Ex.: construtora, gesseiro, entulho…"
            />
          </div>

          <div className="space-y-2">
            <Label>Cidade</Label>
            <Input value={cidade} onChange={(e) => setCidade(e.target.value)} placeholder="Paulínia" />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label>Endereço</Label>
            <Input
              value={endereco}
              onChange={(e) => setEndereco(e.target.value)}
              placeholder="Rua, número, bairro"
            />
          </div>

          <div className="space-y-2">
            <Label>Contato</Label>
            <Input value={contato} onChange={(e) => setContato(e.target.value)} placeholder="(51) 9 9999-9999" />
          </div>

          <div className="space-y-2">
            <Label>Responsável</Label>
            <Input
              value={responsavel}
              onChange={(e) => setResponsavel(e.target.value)}
              placeholder="Nome do responsável"
            />
          </div>

          <div className="space-y-2">
            <Label>Cadência de visitas</Label>
            <Select value={freq} onValueChange={setFreq}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FREQ_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Grupo (pela cadência)</Label>
            <div className="flex h-9 items-center">
              <TierBadge tier={tier} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Última troca / coleta</Label>
            <Input
              type="date"
              value={lastCollect}
              onChange={(e) => setLastCollect(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Última visita registrada</Label>
            <Input type="date" value={lastVisit} onChange={(e) => setLastVisit(e.target.value)} />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label>Observações</Label>
            <Textarea
              rows={2}
              value={obs}
              onChange={(e) => setObs(e.target.value)}
              placeholder="Anotações sobre o cliente…"
            />
          </div>

          <div className="flex items-center gap-2">
            <Switch checked={active} onCheckedChange={setActive} />
            <Label>Cliente ativo (entra na rota)</Label>
          </div>

          <div className="flex items-center gap-2">
            <Switch checked={isProsp} onCheckedChange={setIsProsp} />
            <Label>Prospecção (novo cliente em negociação)</Label>
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label>
              Posição no mapa <span className="font-normal text-muted-foreground">(opcional)</span>
            </Label>
            <LeafletMap
              height="220px"
              fit={false}
              center={pos ? [pos.lat, pos.lng] : [-22.7617, -47.1542]}
              zoom={12}
              points={pos ? [{ lat: pos.lat, lng: pos.lng, label: nome || "Novo cliente", color: "#1e40af" }] : []}
              onMapClick={(lat, lng) => setPos({ lat, lng })}
            />
            <p className="text-xs text-muted-foreground">
              {pos
                ? `Coordenadas: ${pos.lat.toFixed(5)}, ${pos.lng.toFixed(5)}`
                : "Clique no mapa para marcar a posição (ou deixe em branco e geocodifique depois)."}
            </p>
          </div>
        </div>

        {erro && <p className="text-sm text-destructive">{erro}</p>}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={salvar}>Salvar cliente</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
