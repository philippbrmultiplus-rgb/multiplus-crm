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
import { SEGMENTOS_LOGISTICOS } from "@/lib/segmentos";
import { DAY_NAMES, agruparCidades, canonicalCidade } from "@/lib/geo";
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
  const segmentOptions = SEGMENTOS_LOGISTICOS;

  /** cidades já salvas (carteira + prospecções internas), sem duplicar maiúscula/minúscula */
  const cidadesSalvas = useMemo(
    () =>
      agruparCidades([
        ...state.clients.map((c) => c.city),
        ...state.internalProspects.map((p) => p.cidade),
      ]).map((o) => o.label),
    [state.clients, state.internalProspects],
  );

  const [dia, setDia] = useState(day);  const [nome, setNome] = useState("");
  const [responsavel, setResponsavel] = useState("");
  const [contato, setContato] = useState("");
  const [endereco, setEndereco] = useState("");
  const [cidade, setCidade] = useState("");
  const [segmento, setSegmento] = useState("");
  const [segmentoComercial, setSegmentoComercial] = useState("");
  const [visitaAgendada, setVisitaAgendada] = useState("");
  const [obs, setObs] = useState("");
  const [status, setStatus] = useState<VisitStatus>("realizada");
  const [comments, setComments] = useState("");
  const [nextActions, setNextActions] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
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

  /** preenche cidade/endereço a partir das coordenadas (sem digitação manual) */
  const reverseFill = async (lat: number, lng: number) => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&addressdetails=1&accept-language=pt-BR&lat=${lat}&lon=${lng}`,
      );
      const data = (await res.json()) as {
        address?: Record<string, string>;
      };
      const a = data?.address ?? {};
      const city = a.city || a.town || a.village || a.municipality || a.county || "";
      const road = [a.road, a.house_number].filter(Boolean).join(", ");
      if (city) setCidade((c) => c || city);
      if (road) setEndereco((e) => e || road);
    } catch {
      // sem preenchimento automático; as coordenadas seguem valendo
    }
  };

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
        void reverseFill(pos.coords.latitude, pos.coords.longitude);
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
      setPhotos((prev) => [...prev, dataUrl]);
      setPhotoKb((kb) => kb + estimateKb(dataUrl));
      setError(null);
    } catch {
      setError("Não foi possível processar a foto. Tente novamente.");
    }
  };

  const removePhoto = (idx: number) => {
    setPhotos((prev) => {
      const next = prev.filter((_, i) => i !== idx);
      setPhotoKb(next.reduce((acc, d) => acc + estimateKb(d), 0));
      return next;
    });
  };

  const handlePhotos = async (files: FileList | null) => {
    if (!files) return;
    for (const f of Array.from(files)) {
      await handlePhoto(f);
    }
  };

  const save = () => {
    const faltando: string[] = [];
    if (!nome.trim()) faltando.push("nome do cliente");
    if (!cidade.trim()) faltando.push("cidade");
    if (!segmento) faltando.push("segmento logístico");
    if (!segmentoComercial.trim()) faltando.push("segmento comercial");
    if (faltando.length > 0) {
      setError(`Preencha: ${faltando.join(", ")}.`);
      return;
    }
    if (photos.length === 0) {
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
      // grava com a grafia já existente (evita duplicar a cidade no filtro)
      cidade: canonicalCidade(cidade, cidadesSalvas),
      segmento,
      segmentoComercial,
      visitaAgendada,
      obs,
      status,
      comments,
      nextActions,
      photoData: photos[0],
      photoDataList: photos,
      gpsLat: geo?.lat ?? null,
      gpsLng: geo?.lng ?? null,
      gpsAccuracyM: geo ? Math.round(geo.acc) : null,
      // já deixa o cliente prospectado geocodificado (aparece no mapa)
      clientLat: geo?.lat ?? null,
      clientLng: geo?.lng ?? null,
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
            <b>Prospecções</b> já como <b>Em negociação</b> — a situação (fechado/proposta recusada) é
            definida depois, nessa aba. O coordenador recebe na hora.
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
              <Label>
                Nome do cliente <span className="text-destructive">*</span>
              </Label>
              <Input
                value={nome}
                onChange={(e) => {
                  setNome(e.target.value);
                  if (e.target.value.trim()) setError(null);
                }}
                placeholder="Ex.: Construtora Horizonte"
              />
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
              <Label>
                Segmento logístico <span className="text-destructive">*</span>
              </Label>
              <Select
                value={segmento}
                onValueChange={(v) => {
                  setSegmento(v);
                  setError(null);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar segmento" />
                </SelectTrigger>
                <SelectContent>
                  {segmentOptions.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>
                Segmento comercial <span className="text-destructive">*</span>
              </Label>
              <Input
                value={segmentoComercial}
                onChange={(e) => {
                  setSegmentoComercial(e.target.value);
                  if (e.target.value.trim()) setError(null);
                }}
                placeholder="Ex.: construtora, gesseiro, entulho…"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>
                Agendar visita <span className="font-normal text-muted-foreground">(opcional)</span>
              </Label>
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  type="date"
                  className="w-44"
                  value={visitaAgendada}
                  onChange={(e) => setVisitaAgendada(e.target.value)}
                />
                {visitaAgendada && (
                  <Button variant="ghost" size="sm" onClick={() => setVisitaAgendada("")}>
                    Remover data
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Marcando uma data, o cliente aparece em destaque na montagem da rota da semana.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>
                Cidade <span className="text-destructive">*</span>
              </Label>
              <Input
                list="prospect-cidades"
                value={cidade}
                onChange={(e) => {
                  setCidade(e.target.value);
                  if (e.target.value.trim()) setError(null);
                }}
                onBlur={() => {
                  const padrao = canonicalCidade(cidade, cidadesSalvas);
                  if (padrao && padrao !== cidade) setCidade(padrao);
                }}
                placeholder="Comece a digitar a cidade"
              />
              <datalist id="prospect-cidades">
                {cidadesSalvas.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
              <p className="text-xs text-muted-foreground">
                As cidades já cadastradas aparecem conforme você digita.
              </p>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>
                Endereço <span className="font-normal text-muted-foreground">(opcional)</span>
              </Label>
              <Input value={endereco} onChange={(e) => setEndereco(e.target.value)} placeholder="Rua, número, bairro" />
            </div>
          </div>

          {/* Fotos */}
          <div className="space-y-2">
            <Label>
              Fotos de comprovação{" "}
              <span className="font-normal text-muted-foreground">(ao menos 1 obrigatória)</span>
            </Label>
            {photos.length > 0 && (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {photos.map((p, i) => (
                  <div key={i} className="relative">
                    <img
                      src={p}
                      alt={`Comprovante ${i + 1}`}
                      className="h-28 w-full rounded-lg object-cover"
                      crossOrigin="anonymous"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      className="absolute right-1.5 top-1.5 h-6 w-6"
                      onClick={() => removePhoto(i)}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                    <span className="absolute bottom-1.5 left-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white">
                      {estimateKb(p)} KB
                    </span>
                  </div>
                ))}
              </div>
            )}
            {photos.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {photos.length} foto(s) · total ~{photoKb} KB
              </p>
            )}
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-4 text-center text-sm text-muted-foreground hover:border-primary hover:text-primary">
                <Camera className="h-5 w-5" />
                {photos.length === 0 ? "Tirar foto (câmera)" : "Tirar outra foto"}
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => {
                    void handlePhoto(e.target.files?.[0] ?? null);
                    e.target.value = "";
                  }}
                />
              </label>
              <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-4 text-center text-sm text-muted-foreground hover:border-primary hover:text-primary">
                <Camera className="h-5 w-5" />
                Escolher da galeria
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    void handlePhotos(e.target.files);
                    e.target.value = "";
                  }}
                />
              </label>
            </div>
          </div>

          {/* Localização (geocodifica o cliente) */}
          <div className="space-y-2">
            <Label>
              Localização{" "}
              <span className="font-normal text-muted-foreground">
                (use onde você está — preenche o endereço e já geocodifica o cliente)
              </span>
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
                Localização capturada — o cliente já entra <b>geocodificado</b> na lista de Clientes
                (aparece no mapa). Cidade/endereço são preenchidos automaticamente.
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
