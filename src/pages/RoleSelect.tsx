import { useNavigate } from "react-router-dom";
import { CalendarDays, Recycle, UserCog } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useData } from "@/lib/DataContext";

export default function RoleSelect() {
  const { setRole } = useData();
  const navigate = useNavigate();

  const choose = (role: "coordenador" | "vendedor") => {
    setRole(role);
    navigate(role === "coordenador" ? "/dashboard" : "/hoje");
  };

  return (
    <div className="flex min-h-full items-center justify-center bg-background p-4">
      <div className="w-full max-w-lg">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/25">
            <Recycle className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">RotaSul</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Controle de visitas comerciais — Região Sul
          </p>
        </div>

        <div className="grid gap-4">
          <Card className="cursor-pointer transition-shadow hover:shadow-md" onClick={() => choose("coordenador")}>
            <CardHeader className="flex-row items-center gap-4 space-y-0">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <UserCog className="h-6 w-6" />
              </div>
              <div>
                <CardTitle className="text-base">Entrar como Coordenador</CardTitle>
                <CardDescription>
                  Planeja rotas, acompanha visitas e monitora a equipe
                </CardDescription>
              </div>
            </CardHeader>
          </Card>

          <Card className="cursor-pointer transition-shadow hover:shadow-md" onClick={() => choose("vendedor")}>
            <CardHeader className="flex-row items-center gap-4 space-y-0">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-secondary text-secondary-foreground">
                <CalendarDays className="h-6 w-6" />
              </div>
              <div>
                <CardTitle className="text-base">Entrar como Vendedor</CardTitle>
                <CardDescription>
                  Executa a rota do dia, tira foto e confirma a visita no local
                </CardDescription>
              </div>
            </CardHeader>
          </Card>
        </div>

        <div className="mt-6 text-center">
          <Button variant="ghost" size="sm" asChild>
            <a href="#" onClick={(e) => e.preventDefault()}>
              Dica: use o mesmo navegador do aparelho do vendedor para registrar as visitas
            </a>
          </Button>
        </div>
      </div>
    </div>
  );
}
