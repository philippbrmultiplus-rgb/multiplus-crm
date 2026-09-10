import { useEffect, useMemo, useRef, useState } from "react";
import { Camera, Crosshair, Loader2, MapPin, Navigation, UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { useData } from "@/lib/DataContext";
import { DAY_NAMES } from "@/lib/geo";
import { compressImage, estimateKb } from "@/lib/image";
import type { VisitStatus } from "@/lib/types";

interface GeoFix {
  lat: number;
  lng: number;
  acc: number;
}

/** vendedor cadastra um cliente novo prospectado e a visita dele em um dia da semana */
export function ProspectVisitDialog({
  open,
  onClose,
  day,
  routeId,
}: {
  open: boolean;
  onClose: () => void;
  day: number;
  routeId: string | null;
}) {
  const { state, registerProspectVisit } = useData();
  const days = useMemo(
    () => [...(state.settings.workingDays as number[])].sort((a, b) => a - b),
    [state.settings.workingDays],
  );
  const segmentOptions = useMemo(
    () =>
      [...new Set(state.clients.map((c) => c.segment).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b, "pt-BR"),
      ),
    [state.clients],
  );

  const SEG_NONE = "__none__";
  const [dia, setDia] = useState(day);
  const [nome, setNome] = useState("");
  const [responsavel, setResponsavel] = useState("");
  const [contato, setContato] = useState("");
  const [endereco, setEndereco] = useState("");
  const [cidade, setCidade] = useState("");
  const [segmento, setSegmento] = useState("");
  const [obs, setObs] = useState("");
  const [status, setStatus] = useState<VisitStatus>("realizada");
  const [comments, setComments] = useState("");
  const [nextActions, setNextActions] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [photoKb, setPhotoKb] = useState(0);
  const [geo, setGeo] = useState<GeoFix | null>(null);
  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const watchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ao abrir, ajusta o dia selecionado para o dia de origem
  useEffect(() => {
    if (open) setDia(day);
  }, [open, day]);

  const locate = () => {
    if (!navigator.geolocation) {
      setError("Este navegador não oferece geolocalização. Você pode salvar sem o GPS.");
      return;
    }
    setLocating(true);
    if (watchdogRef.current) clearTimeout(watchdogRef.current);
    watchdogRef.current = setTimeout(() => {
      setGeo(null);
      setLocating(false);
    }, 8000);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeo({ lat: pos.coords.latitude, lng: pos.coords.longitude, acc: pos.coords.accuracy });
        setLocating(false);
      },
      () => {
        setGeo(null);
        setLocating(false);
        setError("Não foi possível obter a localização. Você pode salvar sem o GPS.");
      },
      { enableHighAccuracy: true, timeout: 7000, maximumAge: 0 },
    );
  };

  useEffect(() => {
    return () => {
      if (watchdogRef.current) clearTimeout(watchdogRef.current);
    };
  }, []);

  const handlePhoto = async (file: File | null) => {
    if (!file) return;
    try {
      const dataUrl = await compressImage(file);
      setPhoto(dataUrl);
      setPhotoKb(estimateKb(dataUrl));
      setError(null);
    } catch {
      setError("Não foi possível processar a foto. Tente novamente.");
    }
  };

  const save = () => {
    if (!nome.trim()) {
      setError("Informe o nome do cliente novo.");
      return;
    }
    if (!photo) {
      setError("Foto de comprovação obrigatória — fotografe o local da prospecção.");
      return;
    }
    setError(null);
    setSaving(true);
    registerProspectVisit({
      routeId,
      day: dia,
      nome,
      responsavel,
      contato,
      endereco,
      cidade,
      segmento,
      obs,
      status,
      comments,
      nextActions,
      photoData: photo ?? undefined,
      gpsLat: geo?.lat ?? null,
      gpsLng: geo?.lng ?? null,
      gpsAccuracyM: geo ? Math.round(geo.acc) : null,
    });
    setTimeout(() => {
      setSaving(false);
      onClose();
      toast.success("Prospecção registrada! O coordenador já vai receber.");
    }, 250);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !saving && onClose()}>
      <DialogContent className="max-h-[calc(100dvh-2.5rem)] max-w-lg overflow-y-auto overscroll-contain">
        <DialogHeader>
          <DialogTitle>Nova prospecção</DialogTitle>
          <DialogDescription>
            Registre um cliente novo prospectado e a visita feita a ele. Ele entra na aba{" "}
            <b>Prospecções</b> já como <b>Em negociação</b> — a situação (fechado/perdido) é definida
            depois, nessa aba. O coordenador recebe na hora.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Dia da semana</Label>
              <Select value={String(dia)} onValueChange={(v) => setDia(Number(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {days.map((d) => (
                    <SelectItem key={d} value={String(d)}>
                      {DAY_NAMES[d]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Resultado da visita</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as VisitStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="realizada">Visita realizada</SelectItem>
                  <SelectItem value="nao_encontrado">Não encontrado</SelectItem>
                  <SelectItem value="recusada">Atendimento recusado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Nome do cliente</Label>
              <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Construtora Horizonte" />
            </div>
            <div className="space-y-1.5">
              <Label>Nome do responsável</Label>
              <Input value={responsavel} onChange={(e) => setResponsavel(e.target.value)} placeholder="Ex.: João da Silva" />
            </div>
            <div className="space-y-1.5">
              <Label>Contato</Label>
              <Input value={contato} onChange={(e) => setContato(e.target.value)} placeholder="(51) 9 9999-9999" />
            </div>
            <div className="space-y-1.5">
              <Label>Segmento</Label>
              <Select value={segmento || SEG_NONE} onValueChange={(v) => setSegmento(v === SEG_NONE ? "" : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar segmento" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SEG_NONE}>—</SelectItem>
                  {segmentOptions.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Cidade</Label>
              <Input value={cidade} onChange={(e) => setCidade(e.target.value)} placeholder="Porto Alegre" />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Endereço</Label>
              <Input value={endereco} onChange={(e) => setEndereco(e.target.value)} placeholder="Rua, número, bairro" />
            </div>
          </div>

          {/* Foto */}
          <div className="space-y-2">
            <Label>
              Foto de comprovação <span className="font-normal text-muted-foreground">(obrigatória)</span>
            </Label>
            {photo ? (
              <div className="relative">
                <img src={photo} alt="Comprovante" className="h-36 w-full rounded-lg object-cover" crossOrigin="anonymous" />
                <span className="absolute bottom-2 right-2 rounded bg-black/60 px-1.5 py-0.5 text-[11px] text-white">
                  {photoKb} KB
                </span>
                <Button variant="outline" size="icon" className="absolute right-2 top-2 h-7 w-7" onClick={() => setPhoto(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-5 text-center text-sm text-muted-foreground hover:border-primary hover:text-primary">
                <Camera className="h-6 w-6" />
                Tirar foto do local (câmera)
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => handlePhoto(e.target.files?.[0] ?? null)}
                />
              </label>
            )}
          </div>

          {/* GPS opcional */}
          <div className="space-y-2">
            <Label>
              Localização GPS <span className="font-normal text-muted-foreground">(opcional)</span>
            </Label>
            <div className="flex items-center justify-between gap-2 rounded-lg border p-3">
              {geo ? (
                <div className="flex min-w-0 items-center gap-2 text-sm">
                  <MapPin className="h-4 w-4 shrink-0 text-primary" />
                  <span className="truncate">
                    {geo.lat.toFixed(5)}, {geo.lng.toFixed(5)} · ~{Math.round(geo.acc)} m
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  {locating ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Localizando…
                    </>
                  ) : (
                    <>
                      <Crosshair className="h-4 w-4 shrink-0" />
                      <span>Sem localização</span>
                    </>
                  )}
                </div>
              )}
              <Button variant="ghost" size="sm" onClick={locate} disabled={locating} className="shrink-0">
                <Navigation className="mr-1 h-3.5 w-3.5" /> Obter GPS
              </Button>
            </div>
            {geo && (
              <p className="text-xs text-muted-foreground">
                GPS salvo na visita. A distância ao endereço cadastrado (se houver) é conferida depois.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea
              rows={2}
              placeholder="Anotações gerais sobre o cliente/prospecção…"
              value={obs}
              onChange={(e) => setObs(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>O que foi realizado nesta visita</Label>
            <Textarea rows={2} placeholder="Ex.: apresentei a empresa, coletei contato do responsável…" value={comments} onChange={(e) => setComments(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>Próxima visita — o que fazer</Label>
            <Textarea rows={2} placeholder="Ex.: levar proposta de orçamento…" value={nextActions} onChange={(e) => setNextActions(e.target.value)} />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Salvando…
              </>
            ) : (
              <>
                <UserPlus className="mr-2 h-4 w-4" /> Registrar prospecção
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
