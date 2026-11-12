import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, Loader2, Lock, Mail, RotateCcw, User as UserIcon, Wifi } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useData } from "@/lib/DataContext";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/integrations/supabase/client";

export function AuthScreen({ embedded = false }: { embedded?: boolean }) {
  const { signIn, signUp, role, user } = useData();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // teste de conexão com o servidor (útil quando aparece "falha de conexão")
  const [teste, setTeste] = useState<string | null>(null);
  const [testando, setTestando] = useState(false);

  /**
   * Quando o navegador guarda uma versão antiga do app, o login tenta falar com um
   * endereço que não existe mais ("Failed to fetch"). Isto limpa o cache do app e
   * recarrega o endereço com um parâmetro novo, forçando o download da versão atual.
   */
  const limparVersaoAntiga = async () => {
    setTestando(true);
    setTeste("Limpando a versão antiga do app…");
    try {
      const registros = await navigator.serviceWorker?.getRegistrations?.();
      await Promise.all((registros ?? []).map((registro) => registro.unregister()));
    } catch {
      // alguns navegadores não permitem — seguimos com a limpeza do cache
    }
    try {
      if (typeof caches !== "undefined") {
        const chaves = await caches.keys();
        await Promise.all(chaves.map((chave) => caches.delete(chave)));
      }
    } catch {
      // ignora: o recarregamento com endereço novo já resolve a maior parte dos casos
    }
    const url = new URL(window.location.href);
    url.searchParams.set("v", String(Date.now()));
    window.location.replace(url.toString());
  };

  const testarConexao = async () => {
    setTestando(true);
    setTeste("Testando o servidor…");
    const inicio = Date.now();
    try {
      const res = await fetch(`${SUPABASE_URL}/auth/v1/settings`, {
        headers: { apikey: SUPABASE_PUBLISHABLE_KEY },
      });
      const ms = Date.now() - inicio;
      setTeste(
        res.ok
          ? `Servidor respondeu em ${ms} ms — se o login falhar, confira e-mail e senha.`
          : `Servidor respondeu com erro ${res.status}.`,
      );
    } catch (err) {
      console.error("teste de conexão:", err);
      setTeste(
        "Sem conexão com o servidor. Verifique a internet, VPN ou bloqueios de rede deste aparelho.",
      );
    } finally {
      setTestando(false);
    }
  };

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
    const emailLimpo = email.trim().toLowerCase();
    const err =
      mode === "signup"
        ? await signUp(emailLimpo, pw, name.trim())
        : await signIn(emailLimpo, pw);
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
            <img src="/rota-logo.png" alt="Multiplus Paulínia" className="h-full w-full object-contain" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Multiplus Paulínia</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Controle de visitas — Paulínia/SP
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
                    inputMode="email"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
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
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
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
            <Button
              variant="link"
              size="sm"
              className="mt-1 w-full text-xs text-muted-foreground"
              disabled={testando}
              onClick={() => void testarConexao()}
            >
              {testando ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Wifi className="mr-1.5 h-3.5 w-3.5" />
              )}
              Testar conexão com o servidor
            </Button>
            <Button
              variant="link"
              size="sm"
              className="mt-0 w-full text-xs text-muted-foreground"
              disabled={testando}
              onClick={() => void limparVersaoAntiga()}
            >
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
              Não está abrindo? Limpar versão antiga e recarregar
            </Button>
            {teste && (
              <p className="mt-1 flex items-start gap-1.5 text-xs text-muted-foreground">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {teste}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
