import { useEffect, useRef, useState } from "react";
import { Download, HardDriveDownload, RefreshCw, RotateCcw, Settings2, Unlock, Upload, Users } from "lucide-react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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
import { BASE_ADDRESS, DAY_NAMES } from "@/lib/geo";
import type { Role } from "@/lib/types";

function roleLabelOf(r: Role): string {
  return r === "coordenador" ? "Coordenador" : r === "gerente" ? "Gerente" : "Vendedor";
}

export default function Backup() {
  const {
    state,
    exportData,
    importData,
    resetData,
    updateSettings,
    recomputeTiers,
    storageUsageKb,
    role,
    listProfiles,
    setUserRole,
    recarregarPlanilha,
    permissoes,
    setPermissao,
  } = useData();
  const podeEditar = role === "coordenador";
  const [usuarios, setUsuarios] = useState<Array<{ id: string; fullName: string; role: Role }>>([]);
  const [carregandoPlanilha, setCarregandoPlanilha] = useState(false);

  useEffect(() => {
    if (!podeEditar) return;
    void listProfiles().then(setUsuarios);
  }, [podeEditar, listProfiles]);
  const s = state.settings;
  const [importError, setImportError] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const download = () => {
    const blob = new Blob([exportData()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `multiplus-paulinia-backup-${new Date().toISOString().slice(0, 10)}.json`;
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

  /** concede ou revoga uma liberação temporária de um usuário */
  const alternarLiberacao = (
    usuario: { id: string; fullName: string },
    patch: { editarClientes?: boolean; gerirRota?: boolean },
  ) => {
    void setPermissao(usuario.id, patch).then((err) => {
      if (err) {
        toast.error("Não foi possível salvar a liberação", { description: err });
        return;
      }
      const edicao = patch.editarClientes != null;
      const ligado = patch.editarClientes ?? patch.gerirRota;
      toast.success(
        `${edicao ? "Edição de clientes" : "Rota semanal"} ${ligado ? "liberada" : "bloqueada"} para ${
          usuario.fullName || "usuário"
        }.`,
      );
    });
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
            {podeEditar && (
              <Button variant="outline" onClick={() => fileRef.current?.click()}>
                <Upload className="mr-2 h-4 w-4" /> Importar backup
              </Button>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => onImport(e.target.files?.[0] ?? null)}
            />
            {podeEditar && (
              <Button variant="destructive" onClick={() => setConfirmReset(true)}>
                <RotateCcw className="mr-2 h-4 w-4" /> Restaurar dados de fábrica
              </Button>
            )}
          </div>
          {importError && <p className="text-sm text-destructive">{importError}</p>}
          <p className="text-xs text-muted-foreground">
            Exporte o backup e abra neste mesmo app no aparelho do vendedor (opção "Importar backup")
            para sincronizar clientes, rotas e visitas.
          </p>
          {podeEditar && (
            <div className="flex flex-wrap items-center gap-2 border-t pt-3">
              <Button
                variant="secondary"
                disabled={carregandoPlanilha}
                onClick={() => {
                  setCarregandoPlanilha(true);
                  void recarregarPlanilha().finally(() => setCarregandoPlanilha(false));
                }}
              >
                <RefreshCw className="mr-2 h-4 w-4" /> Recarregar planilha de coletas
              </Button>
              <span className="text-xs text-muted-foreground">
                Relê a planilha <b>PAULINIA</b> (coletas de julho a outubro/2026) e atualiza o
                comparativo mensal, a cadência de trocas, a última troca de cada cliente e o
                histórico. Versão aplicada: <b>{s.planilhaVersao ?? "—"}</b>.
              </span>
            </div>
          )}
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
            <p className="text-xs text-muted-foreground">Endereço de partida: {BASE_ADDRESS}</p>
            <Input
              disabled={!podeEditar}
              type="number"
              step="0.0001"
              value={s.homeLat}
              onChange={(e) => updateSettings({ homeLat: parseFloat(e.target.value) || s.homeLat })}
            />
          </div>
          <div className="space-y-2">
            <Label>Longitude da base</Label>
            <Input
              disabled={!podeEditar}
              type="number"
              step="0.0001"
              value={s.homeLng}
              onChange={(e) => updateSettings({ homeLng: parseFloat(e.target.value) || s.homeLng })}
            />
          </div>
          <div className="space-y-2">
            <Label>Início do expediente</Label>
            <Input
              disabled={!podeEditar}
              type="time"
              value={s.workStart}
              onChange={(e) => updateSettings({ workStart: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Fim do expediente</Label>
            <Input
              disabled={!podeEditar}
              type="time"
              value={s.workEnd}
              onChange={(e) => updateSettings({ workEnd: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Tempo por visita (min)</Label>
            <Input
              disabled={!podeEditar}
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
              disabled={!podeEditar}
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
              disabled={!podeEditar}
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
              disabled={!podeEditar}
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
              disabled={!podeEditar}
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
                    disabled={!podeEditar}
                    checked={s.workingDays.includes(d)}
                    onCheckedChange={(v) => toggleDay(d, !!v)}
                  />
                  {DAY_NAMES[d]}
                </label>
              ))}
            </div>
          </div>
        </CardContent>
        {podeEditar && (
          <CardContent className="border-t">
            <Button onClick={recomputeTiers}>
              Aplicar critérios e recalcular prioridades da carteira
            </Button>
          </CardContent>
        )}
      </Card>

      {podeEditar && (
        <Card className="card-soft">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4" /> Usuários e acessos
            </CardTitle>
            <CardDescription>
              Defina o papel de cada usuário. <b>Gerente</b> vê todas as informações, mas não pode
              alterar nem lançar nada no app.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {usuarios.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhum usuário encontrado.</p>
            )}
            {usuarios.map((u) => (
              <div key={u.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-2">
                <span className="min-w-0 truncate text-sm font-medium">
                  {u.fullName || "(sem nome)"}
                </span>
                <Select
                  value={u.role}
                  onValueChange={(v) => {
                    void setUserRole(u.id, v as Role).then((err) => {
                      if (err) {
                        toast.error("Não foi possível alterar o papel", { description: err });
                        return;
                      }
                      setUsuarios((list) => list.map((x) => (x.id === u.id ? { ...x, role: v as Role } : x)));
                      toast.success(`Papel atualizado para ${roleLabelOf(v as Role)}.`);
                    });
                  }}
                >
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="coordenador">Coordenador</SelectItem>
                    <SelectItem value="gerente">Gerente (somente leitura)</SelectItem>
                    <SelectItem value="vendedor">Vendedor</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ))}
            <p className="text-xs text-muted-foreground">
              Para criar um novo acesso: a pessoa entra na tela de login e usa “criar agora”; depois o
              acesso aparece aqui para você definir o papel (ex.: <b>Gerente</b>).
            </p>
          </CardContent>
        </Card>
      )}

      {podeEditar && (
        <Card className="card-soft">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Unlock className="h-4 w-4" /> Liberações temporárias
            </CardTitle>
            <CardDescription>
              Dê acesso pontual para um vendedor editar a carteira de clientes e/ou gerar a rota
              semanal. Vale na hora e pode ser bloqueado aqui quando quiser, sem trocar o papel do
              usuário.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {usuarios.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhum usuário encontrado.</p>
            )}
            {usuarios.map((u) => {
              const p = permissoes.find((x) => x.userId === u.id);
              const ehCoordenador = u.role === "coordenador";
              return (
                <div key={u.id} className="space-y-2 rounded-lg border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="min-w-0 truncate text-sm font-medium">
                      {u.fullName || "(sem nome)"}
                    </span>
                    <Badge variant="outline">{roleLabelOf(u.role)}</Badge>
                  </div>
                  <label className="flex items-center justify-between gap-3 text-sm">
                    <span>Editar e cadastrar clientes</span>
                    <Switch
                      checked={ehCoordenador || !!p?.editarClientes}
                      disabled={ehCoordenador}
                      onCheckedChange={(v) => alternarLiberacao(u, { editarClientes: v })}
                    />
                  </label>
                  <label className="flex items-center justify-between gap-3 text-sm">
                    <span>Gerar e publicar a rota semanal</span>
                    <Switch
                      checked={ehCoordenador || !!p?.gerirRota}
                      disabled={ehCoordenador}
                      onCheckedChange={(v) => alternarLiberacao(u, { gerirRota: v })}
                    />
                  </label>
                  {ehCoordenador && (
                    <p className="text-xs text-muted-foreground">
                      Coordenador já tem acesso total — as liberações não se aplicam.
                    </p>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

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
