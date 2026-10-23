import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Lock, Mail, User as UserIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useData } from "@/lib/DataContext";

export function AuthScreen({ embedded = false }: { embedded?: boolean }) {
  const { signIn, signUp, role, user } = useData();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user && role) {
      navigate(role === "coordenador" ? "/dashboard" : "/hoje", { replace: true });
    }
  }, [user, role, navigate]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (mode === "signup" && name.trim().length < 2) {
      setError("Informe o nome.");
      return;
    }
    setBusy(true);
    const err =
      mode === "signup"
        ? await signUp(email.trim(), pw, name.trim())
        : await signIn(email.trim(), pw);
    if (err) setError(err);
    setBusy(false);
  };

  return (
    <div
      className={
        embedded
          ? "flex min-h-full items-center justify-center bg-background p-4"
          : "flex min-h-screen items-center justify-center bg-background p-4"
      }
    >
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl border bg-white p-1 shadow-lg">
            <img src="/rota-logo.png" alt="Multiplus Porto Alegre" className="h-full w-full object-contain" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Multiplus Porto Alegre</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Controle de visitas — Porto Alegre
          </p>
        </div>

        <Card className="card-soft">
          <CardHeader>
            <CardTitle className="text-center text-lg">
              {mode === "login" ? "Entrar" : "Criar conta"}
            </CardTitle>
            <CardDescription className="text-center">
              {mode === "signup" && (
                <>
                  O <b>primeiro</b> cadastro vira o Coordenador. Cadastros seguintes viram Vendedor.
                </>
              )}
              {mode === "login" && <>Use o e-mail e a senha da sua conta.</>}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              {mode === "signup" && (
                <div className="space-y-2">
                  <Label htmlFor="name">Nome</Label>
                  <div className="relative">
                    <UserIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="name"
                      className="pl-8"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Ex.: João da Silva"
                    />
                  </div>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <div className="relative">
                  <Mail className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    className="pl-8"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="voce@empresa.com"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="pw">Senha</Label>
                <div className="relative">
                  <Lock className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="pw"
                    type="password"
                    autoComplete={mode === "login" ? "current-password" : "new-password"}
                    className="pl-8"
                    value={pw}
                    onChange={(e) => setPw(e.target.value)}
                    placeholder="••••••••"
                  />
                </div>
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Aguarde…
                  </>
                ) : mode === "login" ? (
                  "Entrar"
                ) : (
                  "Criar conta e entrar"
                )}
              </Button>
            </form>
            <Button
              variant="ghost"
              size="sm"
              className="mt-3 w-full"
              onClick={() => {
                setMode(mode === "login" ? "signup" : "login");
                setError(null);
              }}
            >
              {mode === "login" ? "Não tenho conta — criar agora" : "Já tenho conta — entrar"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
