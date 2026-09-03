import { Navigate } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { AuthScreen } from "@/components/layout/AuthScreen";
import Dashboard from "./pages/Dashboard";
import Clientes from "./pages/Clientes";
import RotaSemanal from "./pages/RotaSemanal";
import MinhaRota from "./pages/MinhaRota";
import Visitas from "./pages/Visitas";
import Backup from "./pages/Backup";
import NotFound from "./pages/NotFound";

export const routers = [
  {
    path: "/entrar",
    name: "entrar",
    element: <AuthScreen />,
  },
  {
    path: "/dashboard",
    name: "dashboard",
    element: (
      <AppShell>
        <Dashboard />
      </AppShell>
    ),
  },
  {
    path: "/clientes",
    name: "clientes",
    element: (
      <AppShell>
        <Clientes />
      </AppShell>
    ),
  },
  {
    path: "/rota",
    name: "rota",
    element: (
      <AppShell>
        <RotaSemanal />
      </AppShell>
    ),
  },
  {
    path: "/hoje",
    name: "hoje",
    element: (
      <AppShell>
        <MinhaRota />
      </AppShell>
    ),
  },
  {
    path: "/visitas",
    name: "visitas",
    element: (
      <AppShell>
        <Visitas />
      </AppShell>
    ),
  },
  {
    path: "/backup",
    name: "backup",
    element: (
      <AppShell>
        <Backup />
      </AppShell>
    ),
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
    element: <NotFound />,
  },
];

declare global {
  interface Window {
    __routers__: typeof routers;
  }
}

window.__routers__ = routers;
