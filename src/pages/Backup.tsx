import { useRef, useState } from "react";
import { Download, HardDriveDownload, RotateCcw, Settings2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
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
import { DAY_NAMES } from "@/lib/geo";

export default function Backup() {
  const { state, exportData, importData, resetData, updateSettings, recomputeTiers, storageUsageKb } =
    useData();
  const s = state.settings;
  const [importError, setImportError] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const download = () => {
    const blob = new Blob([exportData()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rotasul-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const onImport = async (file: File | null) => {
    if (!file) return;
    const text = await file.text();
    const err = importData(text);
    setImportError(err);
  };

  const pct = Math.min(100, Math.round((storageUsageKb / 5000) * 100));

  const toggleDay = (d: number, on: boolean) => {
    const days = on
      ? [...s.workingDays, d].sort((a, b) => a - b)
      : s.workingDays.filter((x) => x !== d);
    updateSettings({ workingDays: days });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dados & backup</h1>
        <p className="text-sm text-muted-foreground">
          Este app guarda os dados no navegador. Use o backup para transferir entre aparelhos ou se
          proteger contra perda.
        </p>
      </div>

      <Card className="card-soft">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <HardDriveDownload className="h-4 w-4" /> Backup e restauração
          </CardTitle>
          <CardDescription>
            Uso de armazenamento local: {storageUsageKb} KB de ~5000 KB
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Progress value={pct} />
          <div className="flex flex-wrap gap-2">
            <Button onClick={download}>
              <Download className="mr-2 h-4 w-4" /> Exportar backup
            </Button>
            <Button variant="outline" onClick={() => fileRef.current?.click()}>
              <Upload className="mr-2 h-4 w-4" /> Importar backup
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => onImport(e.target.files?.[0] ?? null)}
            />
            <Button variant="destructive" onClick={() => setConfirmReset(true)}>
              <RotateCcw className="mr-2 h-4 w-4" /> Restaurar dados de fábrica
            </Button>
          </div>
          {importError && <p className="text-sm text-destructive">{importError}</p>}
          <p className="text-xs text-muted-foreground">
            Exporte o backup e abra neste mesmo app no aparelho do vendedor (opção "Importar backup")
            para sincronizar clientes, rotas e visitas.
          </p>
        </CardContent>
      </Card>

      <Card className="card-soft">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Settings2 className="h-4 w-4" /> Configurações da rota
          </CardTitle>
          <CardDescription>
            Base de partida (residência do vendedor), horário de trabalho e critérios de prioridade.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-2">
            <Label>Latitude da base</Label>
            <Input
              type="number"
              step="0.0001"
              value={s.homeLat}
              onChange={(e) => updateSettings({ homeLat: parseFloat(e.target.value) || s.homeLat })}
            />
          </div>
          <div className="space-y-2">
            <Label>Longitude da base</Label>
            <Input
              type="number"
              step="0.0001"
              value={s.homeLng}
              onChange={(e) => updateSettings({ homeLng: parseFloat(e.target.value) || s.homeLng })}
            />
          </div>
          <div className="space-y-2">
            <Label>Início do expediente</Label>
            <Input
              type="time"
              value={s.workStart}
              onChange={(e) => updateSettings({ workStart: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Fim do expediente</Label>
            <Input
              type="time"
              value={s.workEnd}
              onChange={(e) => updateSettings({ workEnd: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Tempo por visita (min)</Label>
            <Input
              type="number"
              min={5}
              value={s.visitTimeMin}
              onChange={(e) =>
                updateSettings({ visitTimeMin: parseInt(e.target.value) || 30 })
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Velocidade média (km/h)</Label>
            <Input
              type="number"
              min={20}
              max={120}
              value={s.travelSpeedKmh}
              onChange={(e) =>
                updateSettings({ travelSpeedKmh: parseInt(e.target.value) || 60 })
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Prioridade A (t/mês, 2x por mês)</Label>
            <Input
              type="number"
              min={0}
              value={s.tierAThreshold}
              onChange={(e) =>
                updateSettings({ tierAThreshold: parseInt(e.target.value) || 100 })
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Prioridade B (t/mês, 1x por mês)</Label>
            <Input
              type="number"
              min={0}
              value={s.tierBThreshold}
              onChange={(e) =>
                updateSettings({ tierBThreshold: parseInt(e.target.value) || 20 })
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Raio de confirmação (m)</Label>
            <Input
              type="number"
              min={50}
              value={s.visitRadiusM}
              onChange={(e) =>
                updateSettings({ visitRadiusM: parseInt(e.target.value) || 300 })
              }
            />
          </div>
          <div className="space-y-2 sm:col-span-2 lg:col-span-3">
            <Label>Dias úteis na rota</Label>
            <div className="flex flex-wrap gap-4">
              {[1, 2, 3, 4, 5].map((d) => (
                <label key={d} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={s.workingDays.includes(d)}
                    onCheckedChange={(v) => toggleDay(d, !!v)}
                  />
                  {DAY_NAMES[d]}
                </label>
              ))}
            </div>
          </div>
        </CardContent>
        <CardContent className="border-t">
          <Button onClick={recomputeTiers}>
            Aplicar critérios e recalcular prioridades da carteira
          </Button>
        </CardContent>
      </Card>

      <AlertDialog open={confirmReset} onOpenChange={setConfirmReset}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restaurar dados de fábrica?</AlertDialogTitle>
            <AlertDialogDescription>
              Toda a carteira, rotas e visitas serão apagadas deste navegador e recarregadas da planilha.
              Exporte um backup antes, se quiser manter algo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                resetData();
                setConfirmReset(false);
              }}
            >
              Restaurar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
