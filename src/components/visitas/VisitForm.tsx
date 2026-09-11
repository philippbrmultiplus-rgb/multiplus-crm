import { useEffect, useMemo, useRef, useState } from "react";
import { Camera, Crosshair, Loader2, MapPin, Navigation, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useData } from "@/lib/DataContext";
import { distanceMeters, formatDistanceM } from "@/lib/geo";
import { compressImage, estimateKb } from "@/lib/image";
import type { Client, Visit, VisitStatus } from "@/lib/types";

interface GeoFix {
  lat: number;
  lng: number;
  acc: number;
}

function geoErrorMessage(code: number): string {
  switch (code) {
    case 1:
      return "Permissão de localização negada. Você pode finalizar sem o GPS.";
    case 2:
      return "GPS indisponível no momento. Você pode finalizar sem o GPS.";
    default:
      return "Não foi possível obter a localização. Você pode finalizar sem o GPS.";
  }
}

export function VisitForm({
  client,
  routeVisitId,
  onClose,
}: {
  client: Client;
  routeVisitId: string | null;
  onClose: () => void;
}) {
  const { state, role, addVisit, markRouteVisitStatus } = useData();
  const settings = state.settings;
  const photoRequired = role === "vendedor";

  const [status, setStatus] = useState<VisitStatus>("realizada");
  const [comments, setComments] = useState("");
  const [nextActions, setNextActions] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [photoKb, setPhotoKb] = useState(0);
  const [geo, setGeo] = useState<GeoFix | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [locating, setLocating] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const watchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Trava de segurança: nunca deixa a tela "presa" esperando o GPS.
  const stopLocating = (message: string | null = null) => {
    setLocating(false);
    if (watchdogRef.current) {
      clearTimeout(watchdogRef.current);
      watchdogRef.current = null;
    }
    if (message) setGeoError(message);
  };

  const locate = () => {
    if (!navigator.geolocation) {
      setGeo(null);
      stopLocating("Este navegador não oferece geolocalização.");
      return;
    }
    setLocating(true);
    setGeoError(null);
    if (watchdogRef.current) clearTimeout(watchdogRef.current);
    watchdogRef.current = setTimeout(() => {
      setGeo(null);
      stopLocating("GPS demorou a responder — você pode finalizar sem confirmar localização.");
    }, 8000);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeo({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          acc: pos.coords.accuracy,
        });
        stopLocating();
      },
      (err) => {
        setGeo(null);
        stopLocating(geoErrorMessage(err.code));
      },
      { enableHighAccuracy: true, timeout: 7000, maximumAge: 0 },
    );
  };

  useEffect(() => {
    locate();
    return () => {
      if (watchdogRef.current) clearTimeout(watchdogRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const distance = useMemo(() => {
    if (geo && client.lat != null && client.lng != null) {
      return distanceMeters(geo.lat, geo.lng, client.lat, client.lng);
    }
    return null;
  }, [geo, client]);

  const withinRadius = distance != null ? distance <= settings.visitRadiusM : null;

  const handlePhoto = async (file: File | null) => {
    if (!file) return;
    try {
      const dataUrl = await compressImage(file);
      setPhotos((prev) => [...prev, dataUrl]);
      setPhotoKb((kb) => kb + estimateKb(dataUrl));
      setError(null);
    } catch {
      setError(
        photoRequired
          ? "Não foi possível processar a foto. Tente novamente."
          : "Não foi possível processar a foto. Você pode finalizar sem ela.",
      );
    }
  };

  const removePhoto = (idx: number) => {
    setPhotos((prev) => {
      const next = prev.filter((_, i) => i !== idx);
      setPhotoKb(next.reduce((acc, d) => acc + estimateKb(d), 0));
      return next;
    });
  };

  const submit = async () => {
    if (photoRequired && photos.length === 0) {
      setError("Foto de comprovação obrigatória — registre ao menos uma foto do local.");
      return;
    }
    setError(null);
    setSaving(true);
    // guarda uma pequena pausa para o botão aparecer "Salvando…"
    await new Promise((r) => setTimeout(r, 50));
    const visit: Visit = {
      id: `v-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      routeVisitId,
      clientId: client.id,
      visitedAt: new Date().toISOString(),
      status,
      resultComments: comments.trim(),
      nextActions: nextActions.trim(),
      gpsLat: geo?.lat ?? null,
      gpsLng: geo?.lng ?? null,
      gpsAccuracyM: geo ? Math.round(geo.acc) : null,
      distanceFromClientM: distance != null ? Math.round(distance) : null,
      withinRadius: withinRadius ?? true,
      photoData: photos[0],
      photoDataList: photos,
    };
    addVisit(visit, { uploadPhoto: photos.some((p) => p.startsWith("data:")) });
    if (routeVisitId) markRouteVisitStatus(routeVisitId, "concluida");
    setSaving(false);
    onClose();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && !saving && onClose()}>
      <DialogContent className="max-h-[calc(100dvh-2.5rem)] max-w-lg overflow-y-auto overscroll-contain">
        <DialogHeader>
          <DialogTitle>Registrar visita</DialogTitle>
          <DialogDescription>
            {client.name} — {client.city}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Fotos */}
          <div className="space-y-2">
            <Label>
              Fotos de comprovação{" "}
              <span className="font-normal text-muted-foreground">
                {photoRequired ? "(ao menos 1 obrigatória)" : "(opcional)"}
              </span>
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
            <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-4 text-center text-sm text-muted-foreground hover:border-primary hover:text-primary">
              <Camera className="h-5 w-5" />
              {photos.length === 0 ? "Tirar foto do local (câmera)" : "Adicionar outra foto"}
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
          </div>

          {/* GPS (opcional) */}
          <div className="space-y-2">
            <Label>
              Localização GPS <span className="font-normal text-muted-foreground">(opcional)</span>
            </Label>
            <div className="flex items-center justify-between gap-2 rounded-lg border p-3">
              {geo ? (
                <div className="flex min-w-0 items-center gap-2 text-sm">
                  <MapPin className={`h-4 w-4 shrink-0 ${withinRadius ? "text-primary" : "text-destructive"}`} />
                  <span className="truncate">
                    {geo.lat.toFixed(5)}, {geo.lng.toFixed(5)}
                    <span className="ml-2 text-xs text-muted-foreground">precisão ~{Math.round(geo.acc)} m</span>
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
                      <span>{geoError ?? "Sem localização"}</span>
                    </>
                  )}
                </div>
              )}
              <Button variant="ghost" size="sm" onClick={locate} disabled={locating} className="shrink-0">
                <Navigation className="mr-1 h-3.5 w-3.5" /> Obter GPS
              </Button>
            </div>
            {distance != null && (
              <p
                className={`flex items-center gap-1.5 text-xs ${
                  withinRadius ? "text-primary" : "text-destructive"
                }`}
              >
                {withinRadius
                  ? `No local confirmado (${formatDistanceM(distance)} do endereço).`
                  : `Atenção: você está a ${formatDistanceM(distance)} do endereço cadastrado.`}
              </p>
            )}
            {geo == null && !locating && (
              <p className="text-xs text-muted-foreground">
                Sem GPS, a visita é finalizada normalmente — fica registrado que a localização não foi
                confirmada.
              </p>
            )}
          </div>

          {/* Status */}
          <div className="space-y-2">
            <Label>Resultado</Label>
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

          <div className="space-y-2">
            <Label>O que foi realizado nesta visita</Label>
            <Textarea
              rows={2}
              placeholder="Ex.: alinhado envio de 2 cargas de gesso, conferido estoque…"
              value={comments}
              onChange={(e) => setComments(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Próxima visita — o que fazer</Label>
            <Textarea
              rows={2}
              placeholder="Ex.: levar amostra de drywall, renegociar prazo de pagamento…"
              value={nextActions}
              onChange={(e) => setNextActions(e.target.value)}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          {withinRadius === false && (
            <Badge className="bg-destructive/10 text-destructive">
              Visita fora do raio de {settings.visitRadiusM} m — será destacada para o coordenador.
            </Badge>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Salvando…
              </>
            ) : (
              "Finalizar visita"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
