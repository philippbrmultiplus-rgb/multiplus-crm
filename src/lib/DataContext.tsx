import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { clientsRS } from "@/data/clientsRS";
import type {
  AppState,
  Client,
  Role,
  RoutePlanResult,
  RouteVisit,
  Settings,
  Tier,
  Visit,
  WeeklyRoute,
} from "./types";
import { generateWeekRoute } from "./route";
import { applySegmentData } from "./segmentMerge";
import {
  isCoordAuthed,
  isPasswordSet,
  setCoordAuthed,
  setPassword,
  verifyPassword,
} from "./authLocal";

const STORAGE_KEY = "rs-app-state.v1";

// eslint-disable-next-line react-refresh/only-export-components
export const defaultSettings: Settings = {
  homeLat: -30.0346,
  homeLng: -51.2177, // Porto Alegre
  workStart: "07:00",
  workEnd: "17:00",
  visitTimeMin: 30,
  travelSpeedKmh: 75,
  workingDays: [1, 2, 3, 4, 5, 6],
  tierAThreshold: 100,
  tierBThreshold: 20,
  visitRadiusM: 300,
};

// eslint-disable-next-line react-refresh/only-export-components
export function computeTier(avgMonthly: number, s: Settings): Tier {
  if (avgMonthly >= s.tierAThreshold) return "A";
  if (avgMonthly >= s.tierBThreshold) return "B";
  return "C";
}

function freqOfTier(tier: Tier, active: boolean): number {
  if (!active) return 0;
  if (tier === "A") return 2;
  if (tier === "B") return 1;
  return 0.5;
}

function seedState(): AppState {
  const clients: Client[] = clientsRS.map((c, i) => {
    const tier = computeTier(c.avgMonthly, defaultSettings);
    return {
      id: `cli-${i}`,
      name: c.name,
      segment: c.segment,
      address: c.address,
      city: c.city,
      state: c.state,
      active: c.active,
      total2025: c.total2025,
      total2026: c.total2026,
      avgMonthly: c.avgMonthly,
      tier,
      freqMonth: freqOfTier(tier, c.active),
      lat: null,
      lng: null,
      geocodeStatus: "pendente",
    };
  });
  return {
    version: 1,
    sessionRole: "coordenador",
    clients: applySegmentData(clients),
    settings: { ...defaultSettings },
    routes: [],
    routeVisits: [],
    visits: [],
  };
}

function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AppState;
      if (parsed && parsed.version === 1 && Array.isArray(parsed.clients)) {
        // mantém rotas/visitas salvos, mas sempre sincroniza clientes + segmentos
        return {
          ...seedState(),
          ...parsed,
          clients: applySegmentData(parsed.clients),
          settings: { ...defaultSettings, ...parsed.settings },
        };
      }
    }
  } catch {
    // estado corrompido -> recomeça
  }
  return seedState();
}

interface DataContextValue {
  state: AppState;
  setRole: (role: Role) => void;
  coordAuthed: boolean;
  coordPasswordSet: boolean;
  loginCoordinator: (pw: string) => Promise<boolean>;
  setupCoordinatorPassword: (pw: string) => Promise<boolean>;
  logoutCoordinator: () => void;
  resetData: () => void;
  exportData: () => string;
  importData: (json: string) => string | null;
  geocodeAll: (onProgress: (done: number, total: number, current: string) => void) => Promise<{ ok: number; failed: number }>;
  updateClient: (id: string, patch: Partial<Client>) => void;
  recomputeTiers: () => void;
  updateSettings: (patch: Partial<Settings>) => void;
  generateRoute: (weekStart: string) => RoutePlanResult;
  saveRoutePlan: (route: WeeklyRoute, routeVisits: RouteVisit[]) => void;
  updateRouteVisit: (id: string, patch: Partial<RouteVisit>) => void;
  moveRouteVisit: (id: string, day: number, position: number) => void;
  removeRouteVisit: (id: string) => void;
  addRouteVisit: (routeId: string, clientId: string, day: number) => void;
  deleteRoute: (routeId: string) => void;
  publishRoute: (routeId: string) => void;
  addVisit: (visit: Visit) => void;
  updateVisit: (id: string, patch: Partial<Visit>) => void;
  deleteVisit: (id: string) => void;
  markRouteVisitStatus: (routeVisitId: string, status: RouteVisit["status"]) => void;
  storageUsageKb: number;
}

const DataContext = createContext<DataContextValue | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(loadState);
  const [coordAuthed, setCoordAuthedState] = useState<boolean>(isCoordAuthed());

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // cota cheia: segue sem persistir (fotos grandes demais)
      console.warn("localStorage cheio — dados não persistidos");
    }
  }, [state]);

  const setRole = useCallback((role: Role) => {
    setState((s) => ({ ...s, sessionRole: role }));
    // sair do perfil de coordenador encerra a sessão autenticada
    if (role !== "coordenador" && isCoordAuthed()) {
      setCoordAuthed(false);
      setCoordAuthedState(false);
    }
  }, []);

  const loginCoordinator = useCallback(async (pw: string): Promise<boolean> => {
    const ok = await verifyPassword(pw);
    if (ok) {
      setCoordAuthed(true);
      setCoordAuthedState(true);
    }
    return ok;
  }, []);

  const setupCoordinatorPassword = useCallback(async (pw: string): Promise<boolean> => {
    if (pw.length < 4) return false;
    await setPassword(pw);
    setCoordAuthed(true);
    setCoordAuthedState(true);
    return true;
  }, []);

  const logoutCoordinator = useCallback(() => {
    setCoordAuthed(false);
    setCoordAuthedState(false);
  }, []);

  const resetData = useCallback(() => {
    setState(seedState());
  }, []);

  const exportData = useCallback(() => JSON.stringify(state), [state]);

  const importData = useCallback((json: string): string | null => {
    try {
      const parsed = JSON.parse(json) as AppState;
      if (!parsed || !Array.isArray(parsed.clients)) return "Arquivo inválido: estrutura não reconhecida.";
      setState({ ...seedState(), ...parsed, settings: { ...defaultSettings, ...parsed.settings } });
      return null;
    } catch {
      return "Arquivo inválido: não é um JSON válido.";
    }
  }, []);

  const updateClient = useCallback((id: string, patch: Partial<Client>) => {
    setState((s) => ({
      ...s,
      clients: s.clients.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    }));
  }, []);

  const recomputeTiers = useCallback(() => {
    setState((s) => ({
      ...s,
      clients: s.clients.map((c) => {
        const tier = computeTier(c.avgMonthly, s.settings);
        return { ...c, tier, freqMonth: freqOfTier(tier, c.active) };
      }),
    }));
  }, []);

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setState((s) => ({ ...s, settings: { ...s.settings, ...patch } }));
  }, []);

  const generateRoute = useCallback(
    (weekStart: string) => generateWeekRoute(state.clients, state.settings, weekStart, state.routes),
    [state.clients, state.settings, state.routes],
  );

  const saveRoutePlan = useCallback((route: WeeklyRoute, routeVisits: RouteVisit[]) => {
    setState((s) => {
      const others = s.routes.filter((r) => r.weekStart !== route.weekStart || r.status !== "rascunho");
      return {
        ...s,
        routes: [route, ...others],
        routeVisits: [...s.routeVisits.filter((rv) => rv.routeId !== route.id), ...routeVisits],
      };
    });
  }, []);

  const updateRouteVisit = useCallback((id: string, patch: Partial<RouteVisit>) => {
    setState((s) => ({
      ...s,
      routeVisits: s.routeVisits.map((rv) => (rv.id === id ? { ...rv, ...patch } : rv)),
    }));
  }, []);

  const moveRouteVisit = useCallback((id: string, day: number, position: number) => {
    setState((s) => {
      const rv = s.routeVisits.find((r) => r.id === id);
      if (!rv) return s;
      const sameDay = s.routeVisits
        .filter((r) => r.routeId === rv.routeId && r.day === day)
        .sort((a, b) => a.position - b.position)
        .filter((r) => r.id !== id);
      sameDay.splice(Math.min(position, sameDay.length), 0, rv);
      const updated = sameDay.map((r, i) => ({ ...r, day, position: i }));
      return {
        ...s,
        routeVisits: s.routeVisits
          .filter((r) => !(r.routeId === rv.routeId && r.day === day))
          .concat(updated),
      };
    });
  }, []);

  const removeRouteVisit = useCallback((id: string) => {
    setState((s) => {
      const rv = s.routeVisits.find((r) => r.id === id);
      if (!rv) return s;
      const remaining = s.routeVisits
        .filter((r) => r.routeId === rv.routeId && r.day === rv.day && r.id !== id)
        .sort((a, b) => a.position - b.position)
        .map((r, i) => ({ ...r, position: i }));
      const remainingIds = new Set(remaining.map((r) => r.id));
      return {
        ...s,
        routeVisits: s.routeVisits
          .filter((r) => r.id !== id)
          .map((r) => (remainingIds.has(r.id) ? remaining.find((n) => n.id === r.id)! : r)),
      };
    });
  }, []);

  const addRouteVisit = useCallback((routeId: string, clientId: string, day: number) => {
    setState((s) => {
      const maxPos = s.routeVisits
        .filter((r) => r.routeId === routeId && r.day === day)
        .reduce((m, r) => Math.max(m, r.position), -1);
      const nv: RouteVisit = {
        id: `rv-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        routeId,
        clientId,
        day,
        position: maxPos + 1,
        estTravelMin: 0,
        estVisitMin: s.settings.visitTimeMin,
        status: "pendente",
      };
      return { ...s, routeVisits: [...s.routeVisits, nv] };
    });
  }, []);

  const deleteRoute = useCallback((routeId: string) => {
    setState((s) => ({
      ...s,
      routes: s.routes.filter((r) => r.id !== routeId),
      routeVisits: s.routeVisits.filter((r) => r.routeId !== routeId),
    }));
  }, []);

  const publishRoute = useCallback((routeId: string) => {
    setState((s) => ({
      ...s,
      routes: s.routes.map((r) => (r.id === routeId ? { ...r, status: "publicada" } : r)),
    }));
  }, []);

  const addVisit = useCallback((visit: Visit) => {
    setState((s) => ({ ...s, visits: [visit, ...s.visits] }));
  }, []);

  const updateVisit = useCallback((id: string, patch: Partial<Visit>) => {
    setState((s) => ({
      ...s,
      visits: s.visits.map((v) => (v.id === id ? { ...v, ...patch } : v)),
    }));
  }, []);

  const deleteVisit = useCallback((id: string) => {
    setState((s) => ({ ...s, visits: s.visits.filter((v) => v.id !== id) }));
  }, []);

  const markRouteVisitStatus = useCallback((routeVisitId: string, status: RouteVisit["status"]) => {
    setState((s) => ({
      ...s,
      routeVisits: s.routeVisits.map((rv) => (rv.id === routeVisitId ? { ...rv, status } : rv)),
    }));
  }, []);

  const geocodeAll = useCallback(
    async (onProgress: (done: number, total: number, current: string) => void) => {
      const pending = state.clients.filter(
        (c) => c.lat == null || c.geocodeStatus !== "ok",
      );
      let ok = 0;
      let failed = 0;
      for (let i = 0; i < pending.length; i++) {
        const c = pending[i];
        onProgress(i + 1, pending.length, c.name);
        const query = `${c.address}, ${c.city}, ${c.state}, Brasil`;
        let lat: number | null = null;
        let lng: number | null = null;
        let status: Client["geocodeStatus"] = "falha";
        if (query.replace(/\s|,|-/g, "").length > 6) {
          try {
            const res = await fetch(
              `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br&q=${encodeURIComponent(query)}`,
              { headers: { "Accept-Language": "pt-BR" } },
            );
            const data = (await res.json()) as Array<{ lat: string; lon: string }>;
            if (data && data[0]) {
              lat = parseFloat(data[0].lat);
              lng = parseFloat(data[0].lon);
              status = "ok";
              ok++;
            } else {
              failed++;
            }
          } catch {
            failed++;
          }
        } else {
          failed++;
        }
        const patch: Partial<Client> = { geocodeStatus: status };
        if (lat != null && lng != null) {
          patch.lat = lat;
          patch.lng = lng;
        }
        updateClient(c.id, patch);
        if (i < pending.length - 1) {
          await new Promise((r) => setTimeout(r, 1100));
        }
      }
      return { ok, failed };
    },
    [state.clients, updateClient],
  );

  const storageUsageKb = (() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? Math.round(raw.length / 1024) : 0;
    } catch {
      return 0;
    }
  })();

  const value: DataContextValue = {
    state,
    setRole,
    coordAuthed,
    coordPasswordSet: isPasswordSet(),
    loginCoordinator,
    setupCoordinatorPassword,
    logoutCoordinator,
    resetData,
    exportData,
    importData,
    geocodeAll,
    updateClient,
    recomputeTiers,
    updateSettings,
    generateRoute,
    saveRoutePlan,
    updateRouteVisit,
    moveRouteVisit,
    removeRouteVisit,
    addRouteVisit,
    deleteRoute,
    publishRoute,
    addVisit,
    updateVisit,
    deleteVisit,
    markRouteVisitStatus,
    storageUsageKb,
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useData(): DataContextValue {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData deve ser usado dentro de DataProvider");
  return ctx;
}
