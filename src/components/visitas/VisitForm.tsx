import { useEffect, useMemo, useState } from "react";
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
      return "Permissão de localização negada. Habilite o GPS para o navegador.";
    case 2:
      return "GPS indisponível no momento. Tente novamente em local aberto.";
    default:
      return "Não foi possível obter a localização. Tente novamente.";
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
  const { state, addVisit, markRouteVisitStatus } = useData();
  const settings = state.settings;

  const [status, setStatus] = useState<VisitStatus>("realizada");
  const [comments, setComments] = useState("");
  const [nextActions, setNextActions] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [photoKb, setPhotoKb] = useState<number>(0);
  const [geo, setGeo] = useState<GeoFix | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [locating, setLocating] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const locate = () => {
    if (!navigator.geolocation) {
      setGeoError("Este navegador não oferece geolocalização.");
      setLocating(false);
      return;
    }
    setLocating(true);
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeo({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          acc: pos.coords.accuracy,
        });
        setLocating(false);
      },
      (err) => {
        setGeoError(geoErrorMessage(err.code));
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  };

  useEffect(() => {
    locate();
  }, []);

  const distance = useMemo(() => {
    if (geo && client.lat != null && client.lng != null) {
      return distanceMeters(geo.lat, geo.lng, client.lat, client.lng);
    }
    return null;
  }, [geo, client]);

  const withinRadius =
    distance != null ? distance <= settings.visitRadiusM : null;

  const handlePhoto = async (file: File | null) => {
    if (!file) return;
    try {
      const dataUrl = await compressImage(file);
      setPhoto(dataUrl);
      setPhotoKb(estimateKb(dataUrl));
    } catch {
      setError("Não foi possível processar a foto.");
    }
  };

  const submit = async () => {
    if (!photo) {
      setError("Fotografe o local para comprovar a visita.");
      return;
    }
    if (!geo) {
      setError("Confirme a localização (GPS) antes de registrar.");
      return;
    }
    setError(null);
    setSaving(true);
    const visit: Visit = {
      id: `v-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      routeVisitId,
      clientId: client.id,
      visitedAt: new Date().toISOString(),
      status,
      resultComments: comments.trim(),
      nextActions: nextActions.trim(),
      gpsLat: geo.lat,
      gpsLng: geo.lng,
      gpsAccuracyM: Math.round(geo.acc),
      distanceFromClientM: distance != null ? Math.round(distance) : null,
      withinRadius: withinRadius ?? true,
      photoData: photo,
    };
    addVisit(visit);
    if (routeVisitId) markRouteVisitStatus(routeVisitId, "concluida");
    setSaving(false);
    onClose();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && !saving && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Registrar visita</DialogTitle>
          <DialogDescription>
            {client.name} — {client.city}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Foto */}
          <div className="space-y-2">
            <Label>Foto de comprovação (obrigatória)</Label>
            {photo ? (
              <div className="relative">
                <img
                  src={photo}
                  alt="Comprovante"
                  className="h-40 w-full rounded-lg object-cover"
                  crossOrigin="anonymous"
                />
                <span className="absolute bottom-2 right-2 rounded bg-black/60 px-1.5 py-0.5 text-[11px] text-white">
                  {photoKb} KB
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  className="absolute right-2 top-2 h-7 w-7"
                  onClick={() => setPhoto(null)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 text-center text-sm text-muted-foreground hover:border-primary hover:text-primary">
                <Camera className="h-6 w-6" />
                Tirar foto do local
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

          {/* GPS */}
          <div className="space-y-2">
            <Label>Localização GPS</Label>
            <div className="flex items-center justify-between rounded-lg border p-3">
              {geo ? (
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className={`h-4 w-4 ${withinRadius ? "text-primary" : "text-destructive"}`} />
                  <span>
                    {geo.lat.toFixed(5)}, {geo.lng.toFixed(5)}
                    <span className="ml-2 text-xs text-muted-foreground">
                      precisão ~{Math.round(geo.acc)} m
                    </span>
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
                      <Crosshair className="h-4 w-4" /> {geoError ?? "Sem localização"}
                    </>
                  )}
                </div>
              )}
              <Button variant="ghost" size="sm" onClick={locate} disabled={locating}>
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
            {client.lat == null && (
              <p className="text-xs text-muted-foreground">
                Cliente sem coordenadas cadastradas — validação de raio indisponível.
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
              "Confirmar visita"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
