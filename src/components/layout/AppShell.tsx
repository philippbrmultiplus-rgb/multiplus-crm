import { type ReactNode } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import {
  CalendarDays,
  CalendarRange,
  Database,
  LayoutDashboard,
  Loader2,
  LogOut,
  Map as MapIcon,
  MapPin,
  Route as RouteIcon,
  Recycle,
  Target,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { useData } from "@/lib/DataContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { AuthScreen } from "./AuthScreen";

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  roles: Array<"coordenador" | "vendedor">;
}

const NAV_ITEMS: NavItem[] = [
  { to: "/dashboard", label: "Visão geral", icon: LayoutDashboard, roles: ["coordenador"] },
  { to: "/clientes", label: "Clientes", icon: Users, roles: ["coordenador"] },
  { to: "/mapa", label: "Mapa de clientes", icon: MapIcon, roles: ["coordenador", "vendedor"] },
  { to: "/prospeccoes", label: "Prospecções", icon: Target, roles: ["coordenador", "vendedor"] },
  { to: "/rota", label: "Rota semanal", icon: RouteIcon, roles: ["coordenador"] },
  { to: "/hoje", label: "Minha rota de hoje", icon: CalendarDays, roles: ["vendedor"] },
  { to: "/minha-semana", label: "Minha rota da semana", icon: CalendarDays, roles: ["vendedor"] },
  { to: "/meu-mes", label: "Minha rota do mês", icon: CalendarRange, roles: ["vendedor"] },
  { to: "/visitas", label: "Visitas", icon: MapPin, roles: ["coordenador"] },
  { to: "/backup", label: "Dados & backup", icon: Database, roles: ["coordenador"] },
];

const HOME_BY_ROLE: Record<string, string> = {
  coordenador: "/dashboard",
  vendedor: "/hoje",
};

function Brand() {
  return (
    <div className="flex items-center gap-2 px-2 py-1">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
        <Recycle className="h-5 w-5" />
      </div>
      <div className="leading-tight">
        <div className="text-sm font-semibold text-sidebar-foreground">RotaSul</div>
        <div className="text-[11px] text-sidebar-foreground/60">Visitas comerciais</div>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { user, role, authLoading, signOut, cloudReady, lastSyncAt } = useData();
  const location = useLocation();
  const isMobile = useIsMobile();

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return <AuthScreen />;
  }

  const currentRole = role ?? "vendedor";
  const items = NAV_ITEMS.filter((i) => i.roles.includes(currentRole));
  const roleLabel = currentRole === "coordenador" ? "Coordenador" : "Vendedor";

  // bloqueia telas de outro papel mesmo acessando o endereço direto
  if (!items.some((i) => i.to === location.pathname)) {
    return <Navigate to={HOME_BY_ROLE[currentRole]} replace />;
  }

  return (
    <SidebarProvider>
      <Sidebar collapsible={isMobile ? "offcanvas" : "icon"}>
        <SidebarHeader>
          <Brand />
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>{role === "coordenador" ? "Gestão" : "Execução"}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {items.map((item) => {
                  const active = location.pathname === item.to;
                  return (
                    <SidebarMenuItem key={item.to}>
                      <SidebarMenuButton asChild isActive={active} tooltip={item.label}>
                        <Link to={item.to}>
                          <item.icon />
                          <span>{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                tooltip="Sair da conta"
                onClick={() => {
                  void signOut();
                }}
              >
                <LogOut />
                <span>Sair · {user.email}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset className="h-svh">
        <header className="flex h-14 items-center gap-2 border-b px-4">
          <SidebarTrigger />
          <Separator orientation="vertical" className="h-5" />
          <div className="flex items-center gap-2 text-sm font-medium">
            {items.find((i) => i.to === location.pathname)?.label ?? "RotaSul"}
          </div>
          <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
            {lastSyncAt && (
              <span className="hidden text-muted-foreground sm:inline">
                sinc. {lastSyncAt}
              </span>
            )}
            <span className="rounded-full bg-secondary px-2.5 py-1 font-medium text-secondary-foreground">
              {roleLabel}
            </span>
            {!cloudReady && (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            )}
          </div>
        </header>
        <div className="min-h-0 flex-1 overflow-auto p-3 md:p-6">
          <div className="mx-auto w-full max-w-7xl min-w-0">{children}</div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
