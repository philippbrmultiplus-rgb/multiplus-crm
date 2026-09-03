import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff, KeyRound, Loader2, Lock, Recycle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useData } from "@/lib/DataContext";

export function CoordGate() {
  const { coordPasswordSet, loginCoordinator, setupCoordinatorPassword, setRole } = useData();
  const navigate = useNavigate();
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (!coordPasswordSet) {
        if (pw.length < 4) {
          setError("A senha deve ter pelo menos 4 caracteres.");
          setBusy(false);
          return;
        }
        if (pw !== pw2) {
          setError("As senhas não conferem.");
          setBusy(false);
          return;
        }
        const ok = await setupCoordinatorPassword(pw);
        if (!ok) setError("Não foi possível definir a senha.");
      } else {
        const ok = await loginCoordinator(pw);
        if (!ok) setError("Senha incorreta. Tente novamente.");
      }
    } finally {
      setBusy(false);
    }
  };

  const asVendedor = () => {
    setRole("vendedor");
    navigate("/hoje");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/25">
            <Recycle className="h-7 w-7" />
          </div>
          <h1 className="text-xl font-bold tracking-tight">Acesso do Coordenador</h1>
        </div>

        <Card className="card-soft">
          <CardHeader>
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              {coordPasswordSet ? <Lock className="h-5 w-5" /> : <KeyRound className="h-5 w-5" />}
            </div>
            <CardTitle className="text-center text-base">
              {coordPasswordSet ? "Digite sua senha" : "Crie sua senha de acesso"}
            </CardTitle>
            <CardDescription className="text-center">
              {coordPasswordSet
                ? "Somente com a senha é possível acessar as telas de gestão."
                : "Esta senha será usada sempre que você acessar como coordenador. Guarde-a bem."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="pw">Senha</Label>
                <div className="relative">
                  <Input
                    id="pw"
                    type={show ? "text" : "password"}
                    value={pw}
                    autoFocus
                    autoComplete={coordPasswordSet ? "current-password" : "new-password"}
                    onChange={(e) => setPw(e.target.value)}
                    placeholder="••••••••"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1 h-8 w-8"
                    onClick={() => setShow((v) => !v)}
                  >
                    {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              {!coordPasswordSet && (
                <div className="space-y-2">
                  <Label htmlFor="pw2">Confirme a senha</Label>
                  <Input
                    id="pw2"
                    type={show ? "text" : "password"}
                    value={pw2}
                    autoComplete="new-password"
                    onChange={(e) => setPw2(e.target.value)}
                    placeholder="••••••••"
                  />
                </div>
              )}
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Verificando…
                  </>
                ) : coordPasswordSet ? (
                  "Entrar"
                ) : (
                  "Definir senha e entrar"
                )}
              </Button>
            </form>
            <Button variant="ghost" size="sm" className="mt-3 w-full" onClick={asVendedor}>
              Prefiro entrar como vendedor
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
