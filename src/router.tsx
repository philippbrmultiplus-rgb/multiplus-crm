import { Suspense, lazy, type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { AuthScreen } from "@/components/layout/AuthScreen";
import { PageLoading } from "@/components/layout/PageLoading";

// cada tela vira um arquivo separado: o app abre sem baixar mapa, gráficos etc.
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Clientes = lazy(() => import("./pages/Clientes"));
const MapaClientes = lazy(() => import("./pages/MapaClientes"));
const Prospeccoes = lazy(() => import("./pages/Prospeccoes"));
const RotaSemanal = lazy(() => import("./pages/RotaSemanal"));
const MinhaRota = lazy(() => import("./pages/MinhaRota"));
const MinhaRotaSemana = lazy(() => import("./pages/MinhaRotaSemana"));
const MinhaRotaMes = lazy(() => import("./pages/MinhaRotaMes"));
const Visitas = lazy(() => import("./pages/Visitas"));
const Alertas = lazy(() => import("./pages/Alertas"));
const ComparativoMensal = lazy(() => import("./pages/ComparativoMensal"));
const MetaDiaria = lazy(() => import("./pages/MetaDiaria"));
const Cadencia = lazy(() => import("./pages/Cadencia"));
const ProspeccaoInterna = lazy(() => import("./pages/ProspeccaoInterna"));
const Backup = lazy(() => import("./pages/Backup"));
const NotFound = lazy(() => import("./pages/NotFound"));

const pagina = (conteudo: ReactNode) => (
  <AppShell>
    <Suspense fallback={<PageLoading />}>{conteudo}</Suspense>
  </AppShell>
);

export const routers = [
  {
    path: "/entrar",
    name: "entrar",
    element: <AuthScreen />,
  },
  {
    path: "/dashboard",
    name: "dashboard",
    element: pagina(<Dashboard />),
  },
  {
    path: "/clientes",
    name: "clientes",
    element: pagina(<Clientes />),
  },
  {
    path: "/mapa",
    name: "mapa",
    element: pagina(<MapaClientes />),
  },
  {
    path: "/prospeccoes",
    name: "prospeccoes",
    element: pagina(<Prospeccoes />),
  },
  {
    path: "/rota",
    name: "rota",
    element: pagina(<RotaSemanal />),
  },
  {
    path: "/hoje",
    name: "hoje",
    element: pagina(<MinhaRota />),
  },
  {
    path: "/minha-semana",
    name: "minha-semana",
    element: pagina(<MinhaRotaSemana />),
  },
  {
    path: "/meu-mes",
    name: "meu-mes",
    element: pagina(<MinhaRotaMes />),
  },
  {
    path: "/visitas",
    name: "visitas",
    element: pagina(<Visitas />),
  },
  {
    path: "/alertas",
    name: "alertas",
    element: pagina(<Alertas />),
  },
  {
    path: "/comparativo",
    name: "comparativo",
    element: pagina(<ComparativoMensal />),
  },
  {
    path: "/meta-diaria",
    name: "meta-diaria",
    element: pagina(<MetaDiaria />),
  },
  {
    path: "/cadencia",
    name: "cadencia",
    element: pagina(<Cadencia />),
  },
  {
    path: "/prospeccao-interna",
    name: "prospeccao-interna",
    element: pagina(<ProspeccaoInterna />),
  },
  {
    path: "/backup",
    name: "backup",
    element: pagina(<Backup />),
  },
  {
    path: "/",
    name: "home",
    element: <Navigate to="/entrar" replace />,
  },
  /* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */
  {
    path: "*",
    name: "404",
    element: (
      <Suspense fallback={<PageLoading />}>
        <NotFound />
      </Suspense>
    ),
  },
];

declare global {
  interface Window {
    __routers__: typeof routers;
  }
}

window.__routers__ = routers;
