import { useState } from "react";
import { ImagePlus, Loader2, Phone, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useData } from "@/lib/DataContext";
import { compressImage, estimateKb } from "@/lib/image";
import type { Client, Visit } from "@/lib/types";

/**
 * Contato por telefone com o cliente da rota: exige o que foi conversado e uma
 * foto da galeria. Entra no histórico como visita realizada (zera os dias sem visita)
 * e fica marcado como "via telefone".
 */
export function PhoneContactDialog({
  client,
  routeVisitId,
  onClose,
}: {
  client: Client;
  routeVisitId: string | null;
  onClose: () => void;
}) {
  const { addVisit, markRouteVisitStatus } = useData();
  const [conversa, setConversa] = useState("");
  const [foto, setFoto] = useState<string | null>(null);
  const [fotoKb, setFotoKb] = useState(0);
  const [erro, setErro] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const escolherFoto = async (file: File | null) => {
    if (!file) return;
    try {
      const dataUrl = await compressImage(file);
      setFoto(dataUrl);
      setFotoKb(estimateKb(dataUrl));
      setErro(null);
    } catch {
      setErro("Não foi possível processar a foto. Tente novamente.");
    }
  };

  const salvar = () => {
    if (!conversa.trim()) {
      setErro("Escreva o que foi conversado com o cliente.");
      return;
    }
    if (!foto) {
      setErro("Anexe uma foto da galeria para comprovar o contato.");
      return;
    }
    setErro(null);
    setSaving(true);
    const visit: Visit = {
      id: `v-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      routeVisitId,
      clientId: client.id,
      visitedAt: new Date().toISOString(),
      status: "realizada",
      resultComments: conversa.trim(),
      nextActions: "",
      gpsLat: null,
      gpsLng: null,
      gpsAccuracyM: null,
      distanceFromClientM: null,
      withinRadius: true,
      photoData: foto,
      photoDataList: [foto],
      tipoContato: "telefone",
    };
    addVisit(visit, { uploadPhoto: true });
    if (routeVisitId) markRouteVisitStatus(routeVisitId, "concluida");
    setSaving(false);
    toast.success("Contato por telefone registrado — a contagem de dias sem visita foi reiniciada.");
    onClose();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && !saving && onClose()}>
      <DialogContent className="max-h-[calc(100dvh-2.5rem)] max-w-lg overflow-y-auto overscroll-contain">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Phone className="h-4 w-4 text-primary" /> Contato via telefone
          </DialogTitle>
          <DialogDescription>
            {client.name}
            {client.city ? ` · ${client.city}` : ""} — registre o que foi conversado. Conta como
            contato do dia e zera os dias sem visita.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="contato-conversa">O que foi conversado</Label>
            <Textarea
              id="contato-conversa"
              rows={4}
              autoFocus
              placeholder="Ex.: falei com o responsável, pediu orçamento de 2 caçambas para a semana que vem…"
              value={conversa}
              onChange={(e) => {
                setConversa(e.target.value);
                if (e.target.value.trim()) setErro(null);
              }}
            />
          </div>

          <div className="space-y-1.5">
            <Label>
              Foto da galeria{" "}
              <span className="font-normal text-muted-foreground">(obrigatória)</span>
            </Label>
            {foto ? (
              <div className="relative">
                <img
                  src={foto}
                  alt="Comprovante do contato"
                  className="h-36 w-full rounded-lg object-cover"
                  crossOrigin="anonymous"
                />
                <Button
                  variant="outline"
                  size="icon"
                  className="absolute right-1.5 top-1.5 h-6 w-6"
                  onClick={() => {
                    setFoto(null);
                    setFotoKb(0);
                  }}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
                <span className="absolute bottom-1.5 left-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white">
                  {fotoKb} KB
                </span>
              </div>
            ) : (
              <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-4 text-center text-sm text-muted-foreground hover:border-primary hover:text-primary">
                <ImagePlus className="h-5 w-5" />
                Escolher foto da galeria
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    void escolherFoto(e.target.files?.[0] ?? null);
                    e.target.value = "";
                  }}
                />
              </label>
            )}
          </div>

          {erro && <p className="text-sm text-destructive">{erro}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={salvar} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Salvando…
              </>
            ) : (
              "Registrar contato"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
