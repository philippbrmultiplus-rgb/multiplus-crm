import { type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  CalendarDays,
  Database,
  LayoutDashboard,
  LogOut,
  MapPin,
  Route as RouteIcon,
  Recycle,
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
import { CoordGate } from "./CoordGate";

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  roles: Array<"coordenador" | "vendedor">;
}

const NAV_ITEMS: NavItem[] = [
  { to: "/dashboard", label: "Visão geral", icon: LayoutDashboard, roles: ["coordenador"] },
  { to: "/clientes", label: "Clientes", icon: Users, roles: ["coordenador"] },
  { to: "/rota", label: "Rota semanal", icon: RouteIcon, roles: ["coordenador"] },
  { to: "/hoje", label: "Minha rota de hoje", icon: CalendarDays, roles: ["vendedor"] },
  { to: "/visitas", label: "Visitas", icon: MapPin, roles: ["coordenador", "vendedor"] },
  { to: "/backup", label: "Dados & backup", icon: Database, roles: ["coordenador"] },
];

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
  const { state, setRole, coordAuthed, logoutCoordinator } = useData();
  const location = useLocation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const role = state.sessionRole;
  const items = NAV_ITEMS.filter((i) => i.roles.includes(role));

  if (role === "coordenador" && !coordAuthed) {
    return <CoordGate />;
  }

  const leaveToProfileSelect = () => {
    if (role === "coordenador") logoutCoordinator();
    navigate("/entrar");
  };

  return (
    <SidebarProvider>
      <Sidebar collapsible={isMobile ? "offcanvas" : "icon"}>
        <SidebarHeader>
          <Brand />
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>
              {role === "coordenador" ? "Gestão" : "Execução"}
            </SidebarGroupLabel>
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
              <SidebarMenuButton asChild tooltip="Trocar de perfil" onClick={leaveToProfileSelect}>
                <Link to="/entrar">
                  <LogOut />
                  <span>
                    {role === "coordenador" ? "Coordenador" : "Vendedor"} · trocar
                  </span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <header className="flex h-14 items-center gap-2 border-b px-4">
          <SidebarTrigger />
          <Separator orientation="vertical" className="h-5" />
          <div className="flex items-center gap-2 text-sm font-medium">
            {items.find((i) => i.to === location.pathname)?.label ?? "RotaSul"}
          </div>
          <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
            <span className="rounded-full bg-secondary px-2.5 py-1 font-medium text-secondary-foreground">
              {role === "coordenador" ? "Coordenador" : "Vendedor"}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => {
                setRole(role === "coordenador" ? "vendedor" : "coordenador");
              }}
            >
              alternar
            </Button>
          </div>
        </header>
        <main className="h-[calc(100%-3.5rem)] overflow-y-auto p-4 md:p-6">
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
