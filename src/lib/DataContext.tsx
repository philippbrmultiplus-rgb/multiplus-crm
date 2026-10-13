import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
/* eslint-disable @typescript-eslint/no-explicit-any -- linhas (rows) do Supabase */
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { clientsRS } from "@/data/clientsRS";
import type {
  AppState,
  Client,
  ClientAlert,
  MonthlyVolume,
  Role,
  RouteActivity,
  RoutePlanResult,
  RouteVisit,
  Settings,
  Tier,
  Visit,
  VisitStatus,
  WeeklyRoute,
  ProspectVisitInput,
} from "./types";
import { generateWeekRoute, mergeWeekRoute } from "./route";
import { applySegmentData } from "./segmentMerge";
import { applyCadenceData, tierOfFreq } from "./cadence";
import { toLocalDateKey } from "./geo";

const STORAGE_KEY = "rs-app-state.v1";

// eslint-disable-next-line react-refresh/only-export-components
export const defaultSettings: Settings = {
  homeLat: -30.0346,
  homeLng: -51.2177,
  workStart: "07:00",
  workEnd: "17:00",
  visitTimeMin: 30,
  travelSpeedKmh: 75,
  workingDays: [1, 2, 3, 4, 5],
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

// eslint-disable-next-line react-refresh/only-export-components
export function seedClients(): Client[] {
  const mapped: Client[] = clientsRS.map((c, i) => {
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
      isProspecao: false,
      lat: null,
      lng: null,
      geocodeStatus: "pendente",
    };
  });
  const withSegments = applySegmentData(mapped);
  return applyCadenceData(withSegments);
}

function alertFromRow(r: Record<string, any>): ClientAlert {
  return {
    id: r.id,
    clientId: r.client_id,
    motivo: r.motivo ?? "",
    createdBy: r.created_by ?? null,
    createdByName: r.created_by_name ?? null,
    photoUrl: r.photo_url ?? null,
    createdAt: r.created_at ?? new Date().toISOString(),
  };
}

function activityFromRow(r: Record<string, any>): RouteActivity {
  return {
    id: r.id,
    weekStart: (r.week_start ?? "").slice(0, 10),
    day: Number(r.day ?? 1),
    titulo: r.titulo ?? "",
    obs: r.obs ?? null,
    durationMin: Number(r.duration_min ?? 0),
    createdBy: r.created_by ?? null,
    createdByName: r.created_by_name ?? null,
    createdAt: r.created_at ?? new Date().toISOString(),
  };
}

function volumeFromRow(r: Record<string, any>): MonthlyVolume {
  return {
    id: r.id,
    clientId: r.client_id ?? null,
    label: r.label ?? null,
    month: (r.month ?? "").slice(0, 10),
    volumeM3: Number(r.volume_m3 ?? 0),
  };
}

function emptyState(): AppState {
  return {
    version: 1,
    sessionRole: "vendedor",
    clients: [],
    settings: { ...defaultSettings },
    routes: [],
    routeVisits: [],
    visits: [],
    alerts: [],
    activities: [],
    volumes: [],
  };
}

function loadLocalCache(): AppState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AppState;
      if (parsed && Array.isArray(parsed.clients))
        return {
          ...parsed,
          alerts: parsed.alerts ?? [],
          activities: parsed.activities ?? [],
          volumes: parsed.volumes ?? [],
        };
    }
  } catch {
    // ignora cache inválido
  }
  return null;
}

function persistLocal(state: AppState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    console.warn("localStorage cheio — cache local não atualizado");
  }
}

/* ---------- mapeamento de linhas do banco ---------- */

function clientFromRow(r: Record<string, any>): Client {
  return {
    id: r.id,
    name: r.name,
    segment: r.segment ?? "",
    address: r.address ?? "",
    city: r.city ?? "",
    state: r.state ?? "RS",
    active: r.active ?? true,
    total2025: Number(r.total_2025 ?? 0),
    total2026: Number(r.total_2026 ?? 0),
    avgMonthly: Number(r.avg_monthly ?? 0),
    tier: (r.tier ?? "D") as Tier,
    freqMonth: Number(r.freq_month ?? 0.5),
    lastCollectAt: r.last_collect_at ?? null,
    lastVisitAt: r.last_visit_at ?? null,
    isProspecao: r.is_prospecao ?? false,
    contato: r.contato ?? null,
    responsavel: r.responsavel ?? null,
    prospeccaoStatus: r.prospeccao_status ?? null,
    prospeccaoJustificativa: r.prospeccao_justificativa ?? null,
    lat: r.lat,
    geoAproximado: r.geo_aproximado ?? false,
    lng: r.lng,
    geocodeStatus: r.geocode_status ?? "pendente",
    obs: r.obs ?? undefined,
  };
}

function clientToRow(c: Client): Record<string, any> {
  return {
    id: c.id,
    name: c.name,
    segment: c.segment,
    address: c.address,
    city: c.city,
    state: c.state,
    active: c.active,
    total_2025: c.total2025,
    total_2026: c.total2026,
    avg_monthly: c.avgMonthly,
    tier: c.tier,
    freq_month: c.freqMonth,
    last_collect_at: c.lastCollectAt ?? null,
    last_visit_at: c.lastVisitAt ?? null,
    is_prospecao: c.isProspecao ?? false,
    contato: c.contato ?? null,
    responsavel: c.responsavel ?? null,
    prospeccao_status: c.prospeccaoStatus ?? null,
    prospeccao_justificativa: c.prospeccaoJustificativa ?? null,
    lat: c.lat,
    geo_aproximado: c.geoAproximado ?? false,
    lng: c.lng,
    geocode_status: c.geocodeStatus,
    obs: c.obs ?? null,
    updated_at: new Date().toISOString(),
  };
}

/** converte SÓ os campos alterados de um cliente para as colunas do banco (para UPDATE parcial) */
function clientPatchToRow(patch: Partial<Client>): Record<string, any> {
  const row: Record<string, any> = {};
  const map: Record<string, string> = {
    name: "name",
    segment: "segment",
    address: "address",
    city: "city",
    state: "state",
    active: "active",
    total2025: "total_2025",
    total2026: "total_2026",
    avgMonthly: "avg_monthly",
    tier: "tier",
    freqMonth: "freq_month",
    lastCollectAt: "last_collect_at",
    lastVisitAt: "last_visit_at",
    isProspecao: "is_prospecao",
    contato: "contato",
    responsavel: "responsavel",
    prospeccaoStatus: "prospeccao_status",
    prospeccaoJustificativa: "prospeccao_justificativa",
    lat: "lat",
    lng: "lng",
    geoAproximado: "geo_aproximado",
    geocodeStatus: "geocode_status",
    obs: "obs",
  };
  for (const [key, column] of Object.entries(map)) {
    if (key in patch) row[column] = (patch as Record<string, unknown>)[key] ?? null;
  }
  row.updated_at = new Date().toISOString();
  return row;
}

function settingsFromRow(r: Record<string, any>): Settings {
  return {
    homeLat: Number(r.home_lat ?? defaultSettings.homeLat),
    homeLng: Number(r.home_lng ?? defaultSettings.homeLng),
    workStart: r.work_start ?? "07:00",
    workEnd: r.work_end ?? "17:00",
    visitTimeMin: Number(r.visit_time_min ?? 30),
    travelSpeedKmh: Number(r.travel_speed_kmh ?? 75),
    workingDays: Array.isArray(r.working_days)
      ? (r.working_days as number[]).filter((d) => d !== 6) // sábado fora da rota
      : [1, 2, 3, 4, 5],
    tierAThreshold: Number(r.tier_a_threshold ?? 100),
    tierBThreshold: Number(r.tier_b_threshold ?? 20),
    visitRadiusM: Number(r.visit_radius_m ?? 300),
  };
}

function settingsToRow(s: Settings): Record<string, any> {
  return {
    id: 1,
    home_lat: s.homeLat,
    home_lng: s.homeLng,
    work_start: s.workStart,
    work_end: s.workEnd,
    visit_time_min: s.visitTimeMin,
    travel_speed_kmh: s.travelSpeedKmh,
    working_days: s.workingDays,
    tier_a_threshold: s.tierAThreshold,
    tier_b_threshold: s.tierBThreshold,
    visit_radius_m: s.visitRadiusM,
    updated_at: new Date().toISOString(),
  };
}

function routeFromRow(r: Record<string, any>): WeeklyRoute {
  return {
    id: r.id,
    weekStart: String(r.week_start).slice(0, 10),
    status: (r.status ?? "rascunho") as WeeklyRoute["status"],
    generatedAt: r.generated_at ?? r.created_at ?? new Date().toISOString(),
    notes: r.notes ?? undefined,
  };
}

function routeToRow(route: WeeklyRoute): Record<string, any> {
  return {
    id: route.id,
    week_start: route.weekStart,
    status: route.status,
    generated_at: route.generatedAt,
    notes: route.notes ?? null,
  };
}

function rvFromRow(r: Record<string, any>): RouteVisit {
  return {
    id: r.id,
    routeId: r.route_id,
    clientId: r.client_id,
    day: r.day ?? 1,
    position: r.position ?? 0,
    estTravelMin: Number(r.est_travel_min ?? 0),
    estVisitMin: Number(r.est_visit_min ?? 30),
    status: (r.status ?? "pendente") as RouteVisit["status"],
  };
}

function rvToRow(rv: RouteVisit): Record<string, any> {
  return {
    id: rv.id,
    route_id: rv.routeId,
    client_id: rv.clientId,
    day: rv.day,
    position: rv.position,
    est_travel_min: rv.estTravelMin,
    est_visit_min: rv.estVisitMin,
    status: rv.status,
  };
}

function visitFromRow(r: Record<string, any>): Visit {
  return {
    id: r.id,
    routeVisitId: r.route_visit_id ?? null,
    clientId: r.client_id,
    visitedAt: r.visited_at ?? r.created_at ?? new Date().toISOString(),
    status: (r.status ?? "realizada") as Visit["status"],
    resultComments: r.result_comments ?? "",
    nextActions: r.next_actions ?? "",
    gpsLat: r.gps_lat,
    gpsLng: r.gps_lng,
    gpsAccuracyM: r.gps_accuracy_m,
    distanceFromClientM: r.distance_from_client_m != null ? Number(r.distance_from_client_m) : null,
    withinRadius: r.within_radius ?? true,
    photoData: r.photo_url ?? undefined,
    photoUrl: r.photo_url ?? null,
    photos: Array.isArray(r.photos) ? (r.photos as string[]) : r.photo_url ? [r.photo_url] : [],
    alerta: r.alerta ?? false,
    alertaMotivo: r.alerta_motivo ?? "",
    createdBy: r.created_by ?? undefined,
  };
}

function visitToRow(v: Visit): Record<string, any> {
  return {
    id: v.id,
    route_visit_id: v.routeVisitId,
    client_id: v.clientId,
    visited_at: v.visitedAt,
    status: v.status,
    result_comments: v.resultComments,
    next_actions: v.nextActions,
    gps_lat: v.gpsLat,
    gps_lng: v.gpsLng,
    gps_accuracy_m: v.gpsAccuracyM,
    distance_from_client_m: v.distanceFromClientM,
    within_radius: v.withinRadius,
    photo_url: (v.photos && v.photos.length > 0 ? v.photos[0] : v.photoUrl) ?? null,
    photos: v.photos ?? null,
    alerta: v.alerta ?? false,
    alerta_motivo: v.alertaMotivo ?? null,
  };
}

/** registra a data da última visita realizada no cliente (só avança, nunca retrocede) */
function applyLastVisitDate(c: Client, localDate: string | null): Client {
  if (!localDate) return c;
  if (c.lastVisitAt && c.lastVisitAt >= localDate) return c;
  return { ...c, lastVisitAt: localDate };
}

/* ---------- contexto ---------- */

interface AuthUser {
  id: string;
  email: string;
  fullName: string;
}

interface DataContextValue {
  state: AppState;
  user: AuthUser | null;
  role: Role | null;
  authLoading: boolean;
  cloudReady: boolean;
  signIn: (email: string, pw: string) => Promise<string | null>;
  signUp: (email: string, pw: string, name: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  resetData: () => void;
  exportData: () => string;
  importData: (json: string) => string | null;
  geocodeAll: (onProgress: (done: number, total: number, current: string) => void) => Promise<{ ok: number; failed: number }>;
  updateClient: (id: string, patch: Partial<Client>) => void;
  createClient: (c: Client) => void;
  deleteClient: (id: string) => void;
  loadClientColetas: (
    clientId: string,
  ) => Promise<Array<{ date: string; note: string; volume: number | null; trocas: number }>>;
  listProfiles: () => Promise<Array<{ id: string; fullName: string; role: Role }>>;
  setUserRole: (id: string, role: Role) => Promise<string | null>;
  recomputeTiers: () => void;
  updateSettings: (patch: Partial<Settings>) => void;
  generateRoute: (weekStart: string) => RoutePlanResult;
  createEmptyWeekRoute: (weekStart: string) => RoutePlanResult;
  updateWeekRoute: (weekStart: string) => RoutePlanResult | null;
  saveRoutePlan: (route: WeeklyRoute, routeVisits: RouteVisit[]) => void;
  updateRouteVisit: (id: string, patch: Partial<RouteVisit>) => void;
  moveRouteVisit: (id: string, day: number, position: number) => void;
  removeRouteVisit: (id: string) => void;
  addRouteVisit: (route: WeeklyRoute, clientId: string, day: number) => void;
  deleteRoute: (routeId: string) => void;
  publishRoute: (routeId: string) => void;
  addVisit: (visit: Visit, opts?: { uploadPhoto?: boolean }) => void;
  registerProspectVisit: (args: ProspectVisitInput) => void;
  setProspeccaoStatus: (clientId: string, status: "fechado" | "proposta_recusada", justificativa?: string) => void;
  updateVisit: (id: string, patch: Partial<Visit>) => void;
  deleteVisit: (id: string) => void;
  markRouteVisitStatus: (routeVisitId: string, status: RouteVisit["status"]) => void;
  addAlert: (clientId: string, motivo: string, photoData?: string) => void;
  deleteAlert: (id: string) => void;
  addActivity: (
    weekStart: string,
    day: number,
    titulo: string,
    obs: string,
    durationMin: number,
  ) => void;
  deleteActivity: (id: string) => void;
  storageUsageKb: number;
  lastSyncAt: string | null;
}

const DataContext = createContext<DataContextValue | null>(null);

// eslint-disable-next-line react-refresh/only-export-components
export function useData(): DataContextValue {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData deve ser usado dentro de DataProvider");
  return ctx;
}

export function DataProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [cloudReady, setCloudReady] = useState(false);
  const [state, setState] = useState<AppState>(emptyState);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const roleRef = useRef<Role | null>(null);
  const uidRef = useRef<string | null>(null);
  const handledUidRef = useRef<string | null>(null);
  const signOutRequestedRef = useRef(false);
  const notifiedRef = useRef<string | null>(null);

  roleRef.current = role;
  uidRef.current = user?.id ?? null;

  const setAppState = useCallback((next: AppState | ((s: AppState) => AppState)) => {
    setState((prev) => {
      const merged = typeof next === "function" ? next(prev) : next;
      persistLocal(merged);
      return merged;
    });
  }, []);

  /** carrega o papel do usuário recém-criado/logado (trigger pode levar instantes) */
  const loadProfileRole = useCallback(async (uid: string): Promise<Role | null> => {
    for (let i = 0; i < 8; i++) {
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", uid)
          .maybeSingle();
        if (!error && data) return (data.role as Role) ?? "vendedor";
        if (error) await new Promise((r) => setTimeout(r, 400));
      } catch {
        await new Promise((r) => setTimeout(r, 400));
      }
    }
    return "vendedor";
  }, []);

  const refreshAll = useCallback(async (uid: string, roleName: Role) => {
    const [clientsRes, settingsRes, routesRes, rvsRes, visitsRes, alertsRes, activitiesRes, volumesRes] =
      await Promise.all([
        supabase.from("clients").select("*").order("name"),
        supabase.from("settings").select("*").eq("id", 1).maybeSingle(),
        supabase.from("weekly_routes").select("*").order("week_start", { ascending: false }),
        supabase.from("route_visits").select("*"),
        supabase.from("visits").select("*").order("visited_at", { ascending: false }).limit(500),
        supabase.from("client_alerts").select("*").order("created_at", { ascending: false }),
        supabase.from("route_activities").select("*").order("created_at"),
        supabase.from("client_monthly_volumes").select("*").order("month"),
      ]);

    const clients = (clientsRes.data ?? []).map((r) => clientFromRow(r as unknown as Record<string, any>));
    const settings = settingsRes.data
      ? settingsFromRow(settingsRes.data as unknown as Record<string, any>)
      : { ...defaultSettings };
    // remove o sábado dos dias de rota também no banco (apenas uma vez, quando ainda estiver salvo)
    if (roleName === "coordenador") {
      const rawDays = (settingsRes.data as Record<string, any> | null)?.working_days;
      if (Array.isArray(rawDays) && rawDays.includes(6)) {
        await supabase.from("settings").update({ working_days: settings.workingDays }).eq("id", 1);
      }
    }
    const routes = (routesRes.data ?? []).map((r) => routeFromRow(r as unknown as Record<string, any>));
    const routeVisits = (rvsRes.data ?? []).map((r) => rvFromRow(r as unknown as Record<string, any>));
    const visits = (visitsRes.data ?? []).map((r) => visitFromRow(r as unknown as Record<string, any>));
    const alerts = (alertsRes.data ?? []).map((r) => alertFromRow(r as unknown as Record<string, any>));
    const activities = (activitiesRes.data ?? []).map((r) =>
      activityFromRow(r as unknown as Record<string, any>),
    );
    const volumes = (volumesRes.data ?? []).map((r) =>
      volumeFromRow(r as unknown as Record<string, any>),
    );

    // coordenaador: aplica cadência/frequência e última troca da planilha uma única vez
    let finalClients = clients;
    if (roleName === "coordenador" && clients.length > 0) {
      const ver = Number((settingsRes.data as Record<string, any> | null)?.cadence_version ?? 0);
      if (ver < 3) {
        finalClients = applyCadenceData(clients);
        await supabase.from("clients").upsert(finalClients.map((c) => clientToRow(c)));
        await supabase
          .from("settings")
          .upsert({ ...(settingsToRow(settings) as Record<string, any>), cadence_version: 3 });
      }
    }

    setAppState((prev) => ({
      ...prev,
      sessionRole: roleName,
      clients: finalClients.length > 0 ? finalClients : prev.clients,
      settings,
      routes,
      routeVisits,
      visits: visits.length > 0 ? visits : prev.visits,
      alerts,
      activities,
      volumes,
    }));
    setCloudReady(true);
    setLastSyncAt(new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }));

    // primeira execução do coordenador: sobe a carteira + configurações se o banco estiver vazio
    if (clients.length === 0 && roleName === "coordenador") {
      const seed = prevClientsRef.current.length > 0 ? applyCadenceData(prevClientsRef.current) : seedClients();
      const { error } = await supabase
        .from("clients")
        .upsert(seed.map((c) => clientToRow(c)));
      if (!error) {
        await supabase
          .from("settings")
          .upsert({ ...(settingsToRow(settings) as Record<string, any>), cadence_version: 3 });
        setAppState((p) => ({ ...p, clients: seed, sessionRole: "coordenador" }));
      }
    }
  }, [setAppState]);

  // guarda cache local pré-login para a primeira sincronização do coordenador
  const prevClientsRef = useRef<Client[]>([]);
  useEffect(() => {
    const cached = loadLocalCache();
    if (cached && cached.clients.length > 0) {
      prevClientsRef.current = cached.clients;
      setAppState(cached);
    }
  }, [setAppState]);

  const onSignedIn = useCallback(
    async (uid: string, email: string, name: string) => {
      let roleName: Role | null = null;
      try {
        roleName = await loadProfileRole(uid);
      } catch {
        roleName = "vendedor";
      } finally {
        setRole(roleName ?? "vendedor");
        setUser({ id: uid, email, fullName: name });
        setAuthLoading(false);
        void refreshAll(uid, roleName ?? "vendedor");
      }
    },
    [loadProfileRole, refreshAll],
  );

  // sessão: registra listener antes de restaurar.
  // A renovação do token pode falhar por rede e disparar SIGNED_OUT; antes de
  // deslogar tentamos recuperar a sessão algumas vezes (senão o app "pula"
  // para a tela de login sem motivo).
  useEffect(() => {
    let disposed = false;
    let retries = 0;
    const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

    const applySession = (session: {
      user?: { id: string; email?: string | null; user_metadata?: { full_name?: string } } | null;
    } | null) => {
      if (session?.user) {
        if (handledUidRef.current === session.user.id) return;
        handledUidRef.current = session.user.id;
        const meta = session.user.user_metadata as { full_name?: string };
        void onSignedIn(
          session.user.id,
          session.user.email ?? "",
          meta?.full_name ?? session.user.email?.split("@")[0] ?? "",
        );
      }
    };

    const clearSession = () => {
      handledUidRef.current = null;
      signOutRequestedRef.current = false;
      setUser(null);
      setRole(null);
      setAuthLoading(false);
      setCloudReady(false);
    };

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        retries = 0;
        applySession(session);
        return;
      }
      // sem sessão: se não foi um "sair" explícito, tenta recuperar (token
      // expirou e a renovação falhou por rede momentânea)
      if (event === "SIGNED_OUT" && !signOutRequestedRef.current && !disposed && retries < 3) {
        retries += 1;
        void (async () => {
          await delay(1200 * retries);
          if (disposed) return;
          try {
            const { data } = await supabase.auth.getSession();
            if (data.session?.user) {
              retries = 0;
              applySession(data.session);
              return;
            }
          } catch {
            // segue abaixo: sem sessão recuperável
          }
          if (retries >= 3) clearSession();
        })();
        return;
      }
      clearSession();
    });

    void supabase.auth.getSession().then(({ data }) => applySession(data.session)).catch(() => {
      if (!disposed) setAuthLoading(false);
    });
    return () => {
      disposed = true;
      sub.subscription.unsubscribe();
    };
  }, [onSignedIn]);

  const signIn = useCallback(
    async (email: string, pw: string): Promise<string | null> => {
      const { error } = await supabase.auth.signInWithPassword({ email, password: pw });
      return error?.message ?? null;
    },
    [],
  );

  const signUp = useCallback(
    async (email: string, pw: string, name: string): Promise<string | null> => {
      const { data, error } = await supabase.auth.signUp({
        email,
        password: pw,
        options: {
          data: { full_name: name },
          emailRedirectTo: `${window.location.origin}/`,
        },
      });
      if (error) return error.message;
      if (data.session?.user) {
        // sessão já veio (auto-confirm): garante que o perfil foi criado
        await new Promise((r) => setTimeout(r, 800));
        await loadProfileRole(data.session.user.id);
      }
      return null;
    },
    [loadProfileRole],
  );

  const signOut = useCallback(async () => {
    signOutRequestedRef.current = true;
    try {
      await supabase.auth.signOut();
    } finally {
      setTimeout(() => {
        signOutRequestedRef.current = false;
      }, 1500);
    }
  }, []);

  /* ---------- alertas em tempo real (novas visitas) ---------- */
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("visits-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "visits" },
        (payload) => {
          const row = payload.new as Record<string, any>;
          if (!row || !row.id) return;
          const isMine = row.created_by === uidRef.current;
          setAppState((prev) => {
            if (prev.visits.some((v) => v.id === row.id)) return prev;
          const visit = visitFromRow(row);
          const nextRv = prev.routeVisits.map((rv) =>
            rv.id === visit.routeVisitId && rv.status === "pendente"
              ? {
                  ...rv,
                  status: visit.status === "nao_realizada" ? ("nao_realizada" as const) : ("concluida" as const),
                }
              : rv,
          );
          const visitLocalDate = toLocalDateKey(row.visited_at ?? visit.visitedAt);
          const clients =
            visit.status === "realizada"
              ? prev.clients.map((c) => (c.id === visit.clientId ? applyLastVisitDate(c, visitLocalDate) : c))
              : prev.clients;
          const client = prev.clients.find((c) => c.id === visit.clientId);
            if (!isMine && notifiedRef.current !== visit.id) {
              notifiedRef.current = visit.id;
              setTimeout(() => {
                const label =
                  visit.status === "realizada"
                    ? "Visita realizada"
                    : visit.status === "nao_encontrado"
                      ? "Cliente não encontrado"
                      : visit.status === "nao_realizada"
                        ? "Visita não realizada"
                        : "Atendimento recusado";
                const comAlerta = visit.alerta ? " · ALERTA" : "";
                toast(`${label}${comAlerta}: ${client?.name ?? "cliente"}`, {
                  description: client
                    ? `${client.city} · ${new Date(visit.visitedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}${visit.alerta && visit.alertaMotivo ? ` · ${visit.alertaMotivo}` : ""}`
                    : undefined,
                });
                if ("Notification" in window && Notification.permission === "granted") {
                  try {
                    new Notification("RotaSul — nova visita", {
                      body: `${label}: ${client?.name ?? ""} — ${client?.city ?? ""} (${new Date(visit.visitedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })})`,
                      tag: `nova-visita-${visit.id}`,
                      renotify: true,
                      vibrate: [200, 100, 200],
                    });
                  } catch {
                    // navegador sem suporte a notificação
                  }
                }
              }, 0);
            }
            return { ...prev, visits: [visit, ...prev.visits], routeVisits: nextRv, clients };
          });
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "visits" },
        (payload) => {
          const row = payload.new as Record<string, any>;
          if (!row?.id) return;
          const updated = visitFromRow(row);
          setAppState((prev) => ({
            ...prev,
            visits: prev.visits.some((v) => v.id === updated.id)
              ? prev.visits.map((v) => (v.id === updated.id ? updated : v))
              : [updated, ...prev.visits],
          }));
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "visits" },
        (payload) => {
          const old = payload.old as Record<string, any>;
          if (!old?.id) return;
          setAppState((prev) => ({ ...prev, visits: prev.visits.filter((v) => v.id !== old.id) }));
        },
      )
      .subscribe();

    if ("Notification" in window && Notification.permission === "default" && roleRef.current === "coordenador") {
      setTimeout(() => {
        try {
          if (typeof Notification.requestPermission === "function") {
            void Notification.requestPermission();
          }
        } catch {
          // navegador que não suporta pedir permissão (ex.: iOS em alguns casos)
        }
      }, 1500);
    }
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user, setAppState]);

  /* ---------- rotas e visitas de rota em tempo real (mudanças do coordenador) ---------- */
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("routes-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "weekly_routes" },
        (payload) => {
          const row = payload.new as Record<string, any>;
          if (!row?.id) return;
          const r = routeFromRow(row);
          setAppState((prev) =>
            prev.routes.some((x) => x.id === r.id)
              ? prev
              : { ...prev, routes: [...prev.routes, r] },
          );
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "weekly_routes" },
        (payload) => {
          const row = payload.new as Record<string, any>;
          if (!row?.id) return;
          const r = routeFromRow(row);
          setAppState((prev) => ({
            ...prev,
            routes: prev.routes.some((x) => x.id === r.id)
              ? prev.routes.map((x) => (x.id === r.id ? r : x))
              : [...prev.routes, r],
          }));
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "weekly_routes" },
        (payload) => {
          const old = payload.old as Record<string, any>;
          if (!old?.id) return;
          setAppState((prev) => ({ ...prev, routes: prev.routes.filter((x) => x.id !== old.id) }));
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "route_visits" },
        (payload) => {
          const row = payload.new as Record<string, any>;
          if (!row?.id) return;
          const rv = rvFromRow(row);
          setAppState((prev) =>
            prev.routeVisits.some((x) => x.id === rv.id)
              ? prev
              : { ...prev, routeVisits: [...prev.routeVisits, rv] },
          );
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "route_visits" },
        (payload) => {
          const row = payload.new as Record<string, any>;
          if (!row?.id) return;
          const rv = rvFromRow(row);
          setAppState((prev) => ({
            ...prev,
            routeVisits: prev.routeVisits.some((x) => x.id === rv.id)
              ? prev.routeVisits.map((x) => (x.id === rv.id ? rv : x))
              : [...prev.routeVisits, rv],
          }));
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "route_visits" },
        (payload) => {
          const old = payload.old as Record<string, any>;
          if (!old?.id) return;
          setAppState((prev) => ({
            ...prev,
            routeVisits: prev.routeVisits.filter((x) => x.id !== old.id),
          }));
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user, setAppState]);

  /* ---------- clientes em tempo real (geocodificação/edições do coordenador) ---------- */
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("clients-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "clients" },
        (payload) => {
          const row = payload.new as Record<string, any>;
          if (!row?.id) return;
          setAppState((prev) =>
            prev.clients.some((c) => c.id === row.id)
              ? prev
              : { ...prev, clients: [...prev.clients, clientFromRow(row)] },
          );
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "clients" },
        (payload) => {
          const row = payload.new as Record<string, any>;
          if (!row?.id) return;
          const updated = clientFromRow(row);
          setAppState((prev) => ({
            ...prev,
            clients: prev.clients.some((c) => c.id === updated.id)
              ? prev.clients.map((c) => (c.id === updated.id ? updated : c))
              : [...prev.clients, updated],
          }));
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "clients" },
        (payload) => {
          const old = payload.old as Record<string, any>;
          if (!old?.id) return;
          setAppState((prev) => ({
            ...prev,
            clients: prev.clients.filter((c) => c.id !== old.id),
          }));
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user, setAppState]);

  /* ---------- alertas manuais em tempo real ---------- */
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("alerts-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "client_alerts" },
        (payload) => {
          const row = payload.new as Record<string, any>;
          if (!row?.id) return;
          setAppState((prev) =>
            prev.alerts.some((a) => a.id === row.id)
              ? prev
              : { ...prev, alerts: [alertFromRow(row), ...prev.alerts] },
          );
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "client_alerts" },
        (payload) => {
          const old = payload.old as Record<string, any>;
          if (!old?.id) return;
          setAppState((prev) => ({ ...prev, alerts: prev.alerts.filter((a) => a.id !== old.id) }));
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user, setAppState]);

  /* ---------- atividades extras do dia em tempo real ---------- */
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("activities-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "route_activities" },
        (payload) => {
          const row = payload.new as Record<string, any>;
          if (!row?.id) return;
          setAppState((prev) =>
            prev.activities.some((a) => a.id === row.id)
              ? prev
              : { ...prev, activities: [...prev.activities, activityFromRow(row)] },
          );
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "route_activities" },
        (payload) => {
          const old = payload.old as Record<string, any>;
          if (!old?.id) return;
          setAppState((prev) => ({
            ...prev,
            activities: prev.activities.filter((a) => a.id !== old.id),
          }));
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user, setAppState]);

  /* ---------- volumes mensais em tempo real (comparativo mensal) ---------- */
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("volumes-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "client_monthly_volumes" },
        (payload) => {
          const row = (payload.new ?? payload.old) as Record<string, any>;
          if (!row?.id) return;
          if (payload.eventType === "DELETE") {
            setAppState((prev) => ({ ...prev, volumes: prev.volumes.filter((v) => v.id !== row.id) }));
            return;
          }
          const volume = volumeFromRow(row);
          setAppState((prev) => ({
            ...prev,
            volumes: prev.volumes.some((v) => v.id === volume.id)
              ? prev.volumes.map((v) => (v.id === volume.id ? volume : v))
              : [...prev.volumes, volume],
          }));
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user, setAppState]);

  /* ---------- operações de dados (local + nuvem) ---------- */

  const canWriteClientData = () => roleRef.current === "coordenador" && !!uidRef.current;

  const persistClientsBatch = useCallback((clients: Client[]) => {
    if (!canWriteClientData() || clients.length === 0) return;
    void supabase.from("clients").upsert(clients.map((c) => clientToRow(c)));
  }, []);

  const updateClient = useCallback(
    (id: string, patch: Partial<Client>) => {
      setAppState((prev) => ({
        ...prev,
        clients: prev.clients.map((c) => (c.id === id ? { ...c, ...patch } : c)),
      }));
      if (!uidRef.current) {
        toast.error("Faça login para salvar alterações.");
        return;
      }
      // UPDATE parcial: grava só os campos alterados (não sobrescreve os demais)
      void (async () => {
        const { error } = await supabase
          .from("clients")
          .update(clientPatchToRow(patch))
          .eq("id", id);
        if (error) {
          console.error("salvar alteração do cliente:", error.message);
          toast.error("Não foi possível salvar a alteração do cliente", {
            description: `${error.message} — verifique se você está logado como coordenador.`,
          });
          return;
        }
        // registra a data da troca/coleta informada no histórico do cliente
        if (patch.lastCollectAt) {
          const { error: cErr } = await supabase
            .from("coletas")
            .upsert(
              { client_id: id, collect_date: patch.lastCollectAt },
              { onConflict: "client_id,collect_date" },
            );
          if (cErr) console.warn("histórico de coleta:", cErr.message);
        }
      })();
    },
    [setAppState],
  );

  /** histórico de trocas/coletas de um cliente (data, volume em m³ e nº de trocas) */
  const loadClientColetas = useCallback(async (clientId: string) => {
    const { data, error } = await supabase
      .from("coletas")
      .select("collect_date, note, volume_m3, trocas")
      .eq("client_id", clientId)
      .order("collect_date", { ascending: false });
    if (error) {
      console.warn("histórico de coletas:", error.message);
      return [];
    }
    return (data ?? []).map((r) => {
      const row = r as Record<string, unknown>;
      return {
        date: String(row.collect_date ?? ""),
        note: (row.note as string) ?? "",
        volume: row.volume_m3 != null ? Number(row.volume_m3) : null,
        trocas: Number(row.trocas ?? 1) || 1,
      };
    });
  }, []);

  /** cria um cliente novo (ex.: prospecção) no estado e na nuvem quando for coordenador */
  const createClient = useCallback(
    (c: Client) => {
      setAppState((prev) => ({ ...prev, clients: [...prev.clients, c] }));
      if (!uidRef.current) {
        toast.error("Faça login para cadastrar clientes.");
        return;
      }
      if (canWriteClientData()) {
        void supabase
          .from("clients")
          .upsert(clientToRow(c))
          .then(({ error }) => {
            if (error) {
              console.error("cadastrar cliente:", error.message);
              toast.error("Não foi possível salvar o cliente", { description: error.message });
            }
          });
        // se já informou a data da última troca, registra no histórico de coletas
        if (c.lastCollectAt) {
          void supabase
            .from("coletas")
            .upsert(
              { client_id: c.id, collect_date: c.lastCollectAt },
              { onConflict: "client_id,collect_date" },
            );
        }
      }
    },
    [setAppState],
  );

  /**
   * Exclui um cliente DEFINITIVAMENTE: remove os registros de visitas, itens de
   * rota e o cliente, guardando um histórico da exclusão (nome, datas).
   */
  const deleteClient = useCallback(
    (id: string) => {
      const target = state.clients.find((c) => c.id === id);
      setAppState((prev) => ({
        ...prev,
        clients: prev.clients.filter((c) => c.id !== id),
        routeVisits: prev.routeVisits.filter((rv) => rv.clientId !== id),
        visits: prev.visits.filter((v) => v.clientId !== id),
      }));
      if (!uidRef.current || !canWriteClientData()) {
        toast.error("Sem permissão para excluir clientes. Entre como coordenador.");
        return;
      }
      void (async () => {
        if (target) {
          const { error: logErr } = await supabase.from("clientes_excluidos").insert({
            id: target.id,
            name: target.name,
            deleted_at: new Date().toISOString(),
            last_collect_at: target.lastCollectAt ?? null,
            last_visit_at: target.lastVisitAt ?? null,
          });
          if (logErr) console.warn("registrar exclusão:", logErr.message);
        }
        const r1 = await supabase.from("route_visits").delete().eq("client_id", id);
        const r2 = await supabase.from("visits").delete().eq("client_id", id);
        const r3 = await supabase.from("clients").delete().eq("id", id);
        const err = r1.error ?? r2.error ?? r3.error;
        if (err) {
          console.error("excluir cliente:", err.message);
          toast.error("Não foi possível excluir o cliente completamente", { description: err.message });
        } else {
          toast.success(`Cliente "${target?.name ?? ""}" excluído definitivamente.`);
        }
      })();
    },
    [setAppState, state.clients],
  );

  const recomputeTiers = useCallback(() => {
    setAppState((prev) => {
      // prioridade (A–D) segue a cadência de visitas informada
      const clients = prev.clients.map((c) => ({
        ...c,
        tier: tierOfFreq(c.freqMonth),
      }));
      persistClientsBatch(clients);
      return { ...prev, clients };
    });
  }, [setAppState, persistClientsBatch]);

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setAppState((prev) => {
      const settings = { ...prev.settings, ...patch };
      if (canWriteClientData()) {
        void supabase.from("settings").upsert(settingsToRow(settings));
      }
      return { ...prev, settings };
    });
  }, [setAppState]);

  const generateRoute = useCallback(
    (weekStart: string) => generateWeekRoute(state.clients, state.settings, weekStart, state.routes),
    [state.clients, state.settings, state.routes],
  );

  /** cria uma rota da semana vazia (sem clientes) para o coordenador montar manualmente */
  const createEmptyWeekRoute = useCallback(
    (weekStart: string): RoutePlanResult => {
      const routeId = `route-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const route: WeeklyRoute = {
        id: routeId,
        weekStart,
        status: "rascunho",
        generatedAt: new Date().toISOString(),
      };
      const oldDrafts = state.routes.filter((r) => r.weekStart === weekStart && r.status === "rascunho");
      setAppState((prev) => {
        const oldIds = new Set(
          prev.routes.filter((r) => r.weekStart === weekStart && r.status === "rascunho").map((r) => r.id),
        );
        const others = prev.routes.filter(
          (r) => r.weekStart !== weekStart || r.status !== "rascunho",
        );
        return {
          ...prev,
          routes: [route, ...others],
          routeVisits: prev.routeVisits.filter((rv) => !oldIds.has(rv.routeId)),
        };
      });
      if (canWriteClientData()) {
        void (async () => {
          for (const o of oldDrafts) {
            await supabase.from("route_visits").delete().eq("route_id", o.id);
            await supabase.from("weekly_routes").delete().eq("id", o.id);
          }
          const { error } = await supabase.from("weekly_routes").upsert(routeToRow(route));
          if (error) {
            console.error("criar rota vazia:", error.message);
            toast.error("Não foi possível criar a rota da semana", { description: error.message });
          }
        })();
      }
      return { route, routeVisits: [], warnings: [], daySummaries: [] };
    },
    [state.routes, setAppState],
  );

  /**
   * Atualiza a rota existente da semana sem apagar os clientes já gerados:
   * preserva status, dia e ordem atuais e só inclui os clientes ativos novos.
   */
  const updateWeekRoute = useCallback(
    (weekStart: string): RoutePlanResult | null => {
      const existing = [...state.routes]
        .filter((r) => r.weekStart === weekStart)
        .sort((a, b) => (a.generatedAt < b.generatedAt ? 1 : -1))[0];
      if (!existing) return null;
      const existingVisits = state.routeVisits.filter((rv) => rv.routeId === existing.id);
      const result = mergeWeekRoute(existing, existingVisits, state.clients, state.settings);
      if (!canWriteClientData()) {
        toast.error("Sem permissão para atualizar a rota. Entre como coordenador.");
        return result;
      }
      const nowIso = new Date().toISOString();
      setAppState((prev) => ({
        ...prev,
        routes: prev.routes.map((r) => (r.id === existing.id ? { ...r, generatedAt: nowIso } : r)),
        routeVisits: [
          ...prev.routeVisits.filter((rv) => rv.routeId !== existing.id),
          ...result.routeVisits,
        ],
      }));
      void (async () => {
        const { error: rErr } = await supabase
          .from("weekly_routes")
          .upsert(routeToRow({ ...existing, generatedAt: nowIso }));
        if (rErr) {
          console.error("atualizar rota:", rErr.message);
          toast.error("Não foi possível atualizar a rota", { description: rErr.message });
          return;
        }
        const { error: dErr } = await supabase.from("route_visits").delete().eq("route_id", existing.id);
        if (dErr) {
          console.error("limpar visitas ao atualizar:", dErr.message);
          toast.error("Não foi possível atualizar as visitas da rota", { description: dErr.message });
          return;
        }
        if (result.routeVisits.length > 0) {
          const { error: iErr } = await supabase
            .from("route_visits")
            .insert(result.routeVisits.map((rv) => rvToRow(rv)));
          if (iErr) {
            console.error("salvar visitas ao atualizar:", iErr.message);
            toast.error("Não foi possível salvar as visitas da rota", { description: iErr.message });
          }
        }
      })();
      return result;
    },
    [state.routes, state.routeVisits, state.clients, state.settings, setAppState],
  );

  const saveRoutePlan = useCallback((route: WeeklyRoute, routeVisits: RouteVisit[]) => {
    setAppState((prev) => {
      const others = prev.routes.filter((r) => r.weekStart !== route.weekStart || r.status !== "rascunho");
      const routes = [route, ...others];
      const routeVisitsAll = [...prev.routeVisits.filter((rv) => rv.routeId !== route.id), ...routeVisits];
      return { ...prev, routes, routeVisits: routeVisitsAll };
    });
    if (!canWriteClientData()) {
      toast.error("Sem permissão para salvar a rota. Entre como coordenador.");
      return;
    }
    void (async () => {
      const { error: rErr } = await supabase.from("weekly_routes").upsert(routeToRow(route));
      if (rErr) {
        console.error("salvar rota:", rErr.message);
        toast.error("Não foi possível salvar a rota", { description: rErr.message });
        return;
      }
      const { error: dErr } = await supabase.from("route_visits").delete().eq("route_id", route.id);
      if (dErr) {
        console.error("limpar visitas:", dErr.message);
        toast.error("Não foi possível atualizar as visitas da rota", { description: dErr.message });
        return;
      }
      if (routeVisits.length > 0) {
        const { error: iErr } = await supabase.from("route_visits").insert(routeVisits.map((rv) => rvToRow(rv)));
        if (iErr) {
          console.error("salvar visitas:", iErr.message);
          toast.error("Não foi possível salvar as visitas da rota", { description: iErr.message });
        }
      }
    })();
  }, [setAppState]);

  const upsertRv = useCallback((rv: RouteVisit) => {
    // qualquer usuário logado pode gravar o status da visita de rota
    // (coordenador edita; vendedor marca concluída/não realizada).
    // Usamos UPDATE (a linha já existe) porque upsert = INSERT ON CONFLICT,
    // e o INSERT do vendedor só é permitido para clientes prospecção.
    if (!uidRef.current) return;
    const row = rvToRow(rv);
    delete row.id;
    void supabase
      .from("route_visits")
      .update(row)
      .eq("id", rv.id)
      .then(({ error }) => {
        if (error) {
          console.warn("atualizar visita da rota:", error.message);
        }
      });
  }, []);

  const updateRouteVisit = useCallback(
    (id: string, patch: Partial<RouteVisit>) => {
      setAppState((prev) => {
        const routeVisits = prev.routeVisits.map((rv) => (rv.id === id ? { ...rv, ...patch } : rv));
        const changed = routeVisits.find((rv) => rv.id === id);
        if (changed) upsertRv(changed);
        return { ...prev, routeVisits };
      });
    },
    [setAppState, upsertRv],
  );

  const moveRouteVisit = useCallback(
    (id: string, day: number, position: number) => {
      setAppState((prev) => {
        const rv = prev.routeVisits.find((r) => r.id === id);
        if (!rv) return prev;
        const sameDay = prev.routeVisits
          .filter((r) => r.routeId === rv.routeId && r.day === day)
          .sort((a, b) => a.position - b.position)
          .filter((r) => r.id !== id);
        sameDay.splice(Math.min(position, sameDay.length), 0, rv);
        const updated = sameDay.map((r, i) => ({ ...r, day, position: i }));
        const map = new Map(updated.map((r) => [r.id, r]));
        const routeVisits = prev.routeVisits.map((r) => map.get(r.id) ?? r);
        if (canWriteClientData()) {
          void supabase.from("route_visits").upsert(updated.map((r) => rvToRow(r)));
        }
        return { ...prev, routeVisits };
      });
    },
    [setAppState],
  );

  const removeRouteVisit = useCallback(
    (id: string) => {
      setAppState((prev) => ({
        ...prev,
        routeVisits: prev.routeVisits.filter((r) => r.id !== id),
        // mantém o histórico da visita, apenas desvinculando do item removido
        visits: prev.visits.map((v) => (v.routeVisitId === id ? { ...v, routeVisitId: null } : v)),
      }));
      if (!canWriteClientData()) return;
      void supabase
        .from("route_visits")
        .delete()
        .eq("id", id)
        .then(({ error }) => {
          if (error) {
            console.error("remover cliente da rota:", error.message);
            toast.error("Não foi possível remover o cliente da rota", { description: error.message });
          }
        });
    },
    [setAppState],
  );

  const addRouteVisit = useCallback(
    (route: WeeklyRoute, clientId: string, day: number) => {
      const routeId = route.id;
      setAppState((prev) => {
        // não permite incluir o mesmo cliente mais de uma vez NO MESMO dia
        const jaExiste = prev.routeVisits.some(
          (r) => r.routeId === routeId && r.clientId === clientId && r.day === day,
        );
        if (jaExiste) {
          toast.error("Este cliente já está incluído neste dia da rota.");
          return prev;
        }
        const maxPos = prev.routeVisits
          .filter((r) => r.routeId === routeId && r.day === day)
          .reduce((m, r) => Math.max(m, r.position), -1);
        const nv: RouteVisit = {
          id: `rv-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          routeId,
          clientId,
          day,
          position: maxPos + 1,
          estTravelMin: 0,
          estVisitMin: prev.settings.visitTimeMin,
          status: "pendente",
        };
        if (!uidRef.current) {
          toast.error("Faça login para adicionar visitas à rota.");
          return { ...prev, routeVisits: [...prev.routeVisits, nv] };
        }
        void (async () => {
          // o coordenador garante a rota na nuvem antes da visita (evita chave estrangeira);
          // o vendedor já tem a rota publicada, então só insere o item
          if (canWriteClientData()) {
            const { error: rErr } = await supabase.from("weekly_routes").upsert(routeToRow(route));
            if (rErr) {
              console.error("garantir rota:", rErr.message);
              toast.error("Não foi possível salvar a rota antes da visita", { description: rErr.message });
              return;
            }
          }
          const { error: vErr } = await supabase.from("route_visits").upsert(rvToRow(nv));
          if (vErr) {
            console.error("salvar visita:", vErr.message);
            toast.error("Não foi possível salvar a visita do cliente", { description: vErr.message });
          }
        })();
        return { ...prev, routeVisits: [...prev.routeVisits, nv] };
      });
    },
    [setAppState],
  );

  const deleteRoute = useCallback((routeId: string) => {
    setAppState((prev) => ({
      ...prev,
      routes: prev.routes.filter((r) => r.id !== routeId),
      routeVisits: prev.routeVisits.filter((r) => r.routeId !== routeId),
    }));
    if (!canWriteClientData()) return;
    void (async () => {
      const { error: dErr } = await supabase.from("route_visits").delete().eq("route_id", routeId);
      const { error: rErr } = await supabase.from("weekly_routes").delete().eq("id", routeId);
      if (dErr || rErr) {
        console.error("excluir rota:", dErr?.message ?? rErr?.message);
        toast.error("Não foi possível excluir a rota", {
          description: (dErr ?? rErr)?.message,
        });
      }
    })();
  }, [setAppState]);

  const publishRoute = useCallback(
    (routeId: string) => {
      if (!canWriteClientData()) {
        toast.error("Sem permissão para publicar. Entre como coordenador.");
        return;
      }
      const target = state.routes.find((r) => r.id === routeId);
      const weekStart = target?.weekStart;
      void (async () => {
        // confirma que as visitas realmente estão salvas no banco antes de publicar
        const { count, error: cErr } = await supabase
          .from("route_visits")
          .select("id", { count: "exact", head: true })
          .eq("route_id", routeId);
        if (cErr) {
          console.error("verificar visitas:", cErr.message);
          toast.error("Não foi possível verificar a rota", { description: cErr.message });
          return;
        }
        if (!count) {
          toast.error("Nenhuma visita salva para publicar.", {
            description:
              "Adicione os clientes na rota e aguarde a confirmação de cada um (se algum aviso de erro aparecer, me avise).",
          });
          return;
        }
        // publicar "assume" a semana: outras rotas publicadas da mesma semana voltam a rascunho,
        // para coordenador e vendedor sempre verem a mesma rota
        const otherPublished = weekStart
          ? state.routes.filter(
              (r) => r.weekStart === weekStart && r.id !== routeId && r.status === "publicada",
            )
          : [];
        if (otherPublished.length > 0) {
          const { error: demErr } = await supabase
            .from("weekly_routes")
            .update({ status: "rascunho" })
            .in("id", otherPublished.map((r) => r.id));
          if (demErr) {
            console.error("rebaixar rota anterior:", demErr.message);
            toast.error("Não foi possível substituir a rota publicada anterior", { description: demErr.message });
            return;
          }
        }
        const { error } = await supabase
          .from("weekly_routes")
          .update({ status: "publicada" })
          .eq("id", routeId);
        if (error) {
          console.error("publicar rota:", error.message);
          toast.error("Não foi possível publicar a rota", { description: error.message });
          return;
        }
        setAppState((prev) => {
          const demoteIds = new Set(otherPublished.map((r) => r.id));
          return {
            ...prev,
            routes: prev.routes.map((r) =>
              r.id === routeId
                ? { ...r, status: "publicada" as const }
                : demoteIds.has(r.id)
                  ? { ...r, status: "rascunho" as const }
                  : r,
            ),
          };
        });
        toast.success(`Rota publicada para o vendedor com ${count} visita(s).`);
      })();
    },
    [setAppState, state.routes],
  );

  /** sobe uma foto (base64) para o bucket e devolve a URL pública */
  const uploadPhoto = useCallback(async (path: string, dataUrl: string): Promise<string | null> => {
    try {
      const blob = await (await fetch(dataUrl)).blob();
      const { error } = await supabase.storage.from("visitas").upload(path, blob, {
        contentType: "image/jpeg",
        upsert: true,
      });
      if (error) return null;
      const { data } = supabase.storage.from("visitas").getPublicUrl(path);
      return data.publicUrl;
    } catch {
      return null;
    }
  }, []);

  const uploadVisitPhoto = useCallback(
    (visit: Visit, dataUrl: string) => uploadPhoto(`${visit.clientId}/${visit.id}.jpg`, dataUrl),
    [uploadPhoto],
  );

  const uploadVisitPhotos = useCallback(
    async (visit: Visit, dataUrls: string[]): Promise<string[]> => {
      const urls: string[] = [];
      for (let i = 0; i < dataUrls.length; i++) {
        const url = await uploadVisitPhoto({ ...visit, id: `${visit.id}-${i}` }, dataUrls[i]);
        if (url) urls.push(url);
      }
      return urls;
    },
    [uploadVisitPhoto],
  );

  const addVisit = useCallback(
    (visit: Visit, opts?: { uploadPhoto?: boolean }) => {
      const localDate = toLocalDateKey(visit.visitedAt);
      setAppState((prev) => {
        const clients =
          visit.status === "realizada"
            ? prev.clients.map((c) => (c.id === visit.clientId ? applyLastVisitDate(c, localDate) : c))
            : prev.clients;
        return { ...prev, visits: [visit, ...prev.visits], clients };
      });
      if (!uidRef.current) return;
      void (async () => {
        // 1) grava a VISITA primeiro (sem as fotos) — assim uma falha no upload
        //    de foto nunca impede o registro da visita
        const semFotos: Visit = {
          ...visit,
          photos: null,
          photoUrl: null,
          photoData: undefined,
          photoDataList: undefined,
        };
        const { error } = await supabase.from("visits").insert(visitToRow(semFotos));
        if (error) {
          console.error("falha ao salvar visita:", error.message);
          toast.error("Não foi possível salvar a visita", {
            description: `${error.message} — tente registrar novamente.`,
          });
          return;
        }

        // 2) agora sobe as fotos e completa o registro (se falhar, a visita já está salva)
        const list = visit.photoDataList?.length
          ? visit.photoDataList
          : visit.photoData
            ? [visit.photoData]
            : [];
        const uploaded = opts?.uploadPhoto
          ? await uploadVisitPhotos(visit, list.filter((d) => d.startsWith("data:")))
          : [];
        if (uploaded.length) {
          const synced: Visit = {
            ...visit,
            photos: uploaded,
            photoUrl: uploaded[0] ?? null,
            photoData: uploaded[0],
            photoDataList: undefined,
          };
          const { error: upErr } = await supabase
            .from("visits")
            .update({ photo_url: synced.photoUrl, photos: synced.photos })
            .eq("id", visit.id);
          if (upErr) {
            console.warn("falha ao salvar fotos da visita", upErr.message);
          } else {
            setAppState((prev) => ({
              ...prev,
              visits: prev.visits.map((v) => (v.id === visit.id ? synced : v)),
            }));
          }
        }
      })();
    },
    [setAppState, uploadVisitPhotos],
  );

  /**
   * Vendedor registra uma "visita prospecção": cria o cliente novo (marcado como
   * prospecção), inclui na rota do dia e salva a visita — tudo chega em tempo
   * real ao coordenador (cliente, item da rota e visita).
   */
  const registerProspectVisit = useCallback(
    (args: ProspectVisitInput) => {
      const clientId = `cli-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const rvId = `rv-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const nowIso = new Date().toISOString();
      const novo: Client = {
        id: clientId,
        name: args.nome.trim() || "Prospecção",
        segment: args.segmento?.trim() ?? "",
        address: args.endereco?.trim() ?? "",
        city: args.cidade?.trim() ?? "",
        state: "RS",
        active: true,
        total2025: 0,
        total2026: 0,
        avgMonthly: 0,
        tier: "D",
        freqMonth: 1,
        isProspecao: true,
        contato: args.contato?.trim() || null,
        responsavel: args.responsavel?.trim() || null,
        prospeccaoStatus: "em_negociacao",
        obs: args.obs?.trim() || undefined,
        lastCollectAt: null,
        lastVisitAt: null,
        lat: args.clientLat ?? null,
        lng: args.clientLng ?? null,
        geocodeStatus: args.clientLat != null && args.clientLng != null ? "ok" : "pendente",
      };
      const withRoute = !!args.routeId;
      const pos = withRoute
        ? state.routeVisits.filter((rv) => rv.routeId === args.routeId && rv.day === args.day).length
        : 0;
      const rv: RouteVisit = {
        id: rvId,
        routeId: args.routeId ?? "",
        clientId,
        day: args.day,
        position: pos,
        estTravelMin: 0,
        estVisitMin: state.settings.visitTimeMin,
        status: "concluida",
      };
      const visit: Visit = {
        id: `v-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        routeVisitId: withRoute ? rvId : null,
        clientId,
        visitedAt: nowIso,
        status: args.status,
        resultComments: args.comments.trim(),
        nextActions: args.nextActions.trim(),
        gpsLat: args.gpsLat ?? null,
        gpsLng: args.gpsLng ?? null,
        gpsAccuracyM: args.gpsAccuracyM ?? null,
        distanceFromClientM: null,
        withinRadius: true,
        photoData: args.photoData,
        photoDataList: args.photoDataList,
      };
      setAppState((prev) => ({
        ...prev,
        clients: [...prev.clients, novo],
        routeVisits: withRoute ? [...prev.routeVisits, rv] : prev.routeVisits,
        visits: [visit, ...prev.visits],
      }));
      if (!uidRef.current) return;
      void (async () => {
        const { error: cErr } = await supabase.from("clients").insert(clientToRow(novo));
        if (cErr) {
          console.error("criar prospecção:", cErr.message);
          toast.error("Não foi possível salvar a prospecção", { description: cErr.message });
          return;
        }
        if (withRoute) {
          const { error: rErr } = await supabase.from("route_visits").insert(rvToRow(rv));
          if (rErr) {
            console.error("incluir prospecção na rota:", rErr.message);
            toast.error("Não foi possível incluir a prospecção na rota", { description: rErr.message });
          }
        }
        // 1) visita primeiro (sem fotos), para não perder o registro
        const { error: vErr } = await supabase
          .from("visits")
          .insert(visitToRow({ ...visit, photos: null, photoUrl: null, photoData: undefined }));
        if (vErr) {
          console.error("salvar visita prospecção:", vErr.message);
          toast.error("Não foi possível salvar a visita", { description: vErr.message });
          return;
        }
        // 2) depois as fotos
        const lista = args.photoDataList?.length
          ? args.photoDataList
          : args.photoData
            ? [args.photoData]
            : [];
        const uploaded = await uploadVisitPhotos(visit, lista.filter((d) => d.startsWith("data:")));
        if (uploaded.length) {
          const synced: Visit = {
            ...visit,
            photos: uploaded,
            photoUrl: uploaded[0] ?? null,
            photoData: uploaded[0],
            photoDataList: undefined,
          };
          const { error: upErr } = await supabase
            .from("visits")
            .update({ photo_url: synced.photoUrl, photos: synced.photos })
            .eq("id", visit.id);
          if (!upErr) {
            setAppState((prev) => ({
              ...prev,
              visits: prev.visits.map((v) => (v.id === visit.id ? synced : v)),
            }));
          }
        }
      })();
    },
    [setAppState, state.routeVisits, state.settings, uploadVisitPhotos],
  );

  /** finaliza a prospecção (fechado ou proposta recusada) — trava depois de decidido */
  const setProspeccaoStatus = useCallback(
    (clientId: string, status: "fechado" | "proposta_recusada", justificativa?: string) => {
      const target = state.clients.find((c) => c.id === clientId);
      const current = target?.prospeccaoStatus ?? "em_negociacao";
      if (current === "fechado" || current === "proposta_recusada") {
        toast.error("Esta prospecção já foi finalizada e não pode mais ser alterada.");
        return;
      }
      if (status === "proposta_recusada" && !justificativa?.trim()) {
        toast.error("Escreva a justificativa para marcar a proposta como recusada.");
        return;
      }
      const texto =
        status === "proposta_recusada" ? justificativa!.trim() : target?.prospeccaoJustificativa ?? null;
      // fechado = virou cliente: sai da prospecção e entra na lista de clientes ativos
      const virouCliente = status === "fechado";
      setAppState((prev) => ({
        ...prev,
        clients: prev.clients.map((c) =>
          c.id === clientId
            ? {
                ...c,
                prospeccaoStatus: status,
                prospeccaoJustificativa: texto,
                isProspecao: virouCliente ? false : c.isProspecao,
                active: virouCliente ? true : c.active,
              }
            : c,
        ),
      }));
      if (!uidRef.current) return;
      void supabase
        .from("clients")
        .update({
          prospeccao_status: status,
          prospeccao_justificativa: texto,
          ...(virouCliente ? { is_prospecao: false, active: true } : {}),
          updated_at: new Date().toISOString(),
        })
        .eq("id", clientId)
        .then(({ error }) => {
          if (error) {
            console.error("atualizar prospecção:", error.message);
            toast.error("Não foi possível atualizar a prospecção", { description: error.message });
          } else {
            toast.success(
              virouCliente
                ? "Prospecção fechada — o cliente entrou na lista de clientes ativos."
                : "Proposta recusada registrada.",
            );
          }
        });
    },
    [setAppState, state.clients],
  );

  const updateVisit = useCallback(
    (id: string, patch: Partial<Visit>) => {
      setAppState((prev) => {
        const visits = prev.visits.map((v) => (v.id === id ? { ...v, ...patch } : v));
        const changed = visits.find((v) => v.id === id);
        if (changed && uidRef.current) {
          void supabase
            .from("visits")
            .update({
              status: changed.status,
              result_comments: changed.resultComments,
              next_actions: changed.nextActions,
              visited_at: changed.visitedAt,
              within_radius: changed.withinRadius,
              gps_lat: changed.gpsLat,
              gps_lng: changed.gpsLng,
              gps_accuracy_m: changed.gpsAccuracyM,
              distance_from_client_m: changed.distanceFromClientM,
            })
            .eq("id", id);
        }
        return { ...prev, visits };
      });
    },
    [setAppState],
  );

  const deleteVisit = useCallback((id: string) => {
    setAppState((prev) => {
      const target = prev.visits.find((v) => v.id === id);
      const rv = target?.routeVisitId ? prev.routeVisits.find((r) => r.id === target.routeVisitId) : undefined;
      if (uidRef.current && target) {
        void (async () => {
          const { error } = await supabase.from("visits").delete().eq("id", id);
          if (error) {
            console.error("excluir visita:", error.message);
            toast.error("Não foi possível excluir a visita", { description: error.message });
            return;
          }
          // se a visita era de um item da rota concluído, volta o item para pendente
          if (rv && rv.status !== "pendente") {
            await supabase.from("route_visits").update({ status: "pendente" }).eq("id", rv.id);
            setAppState((p) => ({
              ...p,
              routeVisits: p.routeVisits.map((x) =>
                x.id === rv.id ? { ...x, status: "pendente" as const } : x,
              ),
            }));
          }
        })();
      }
      return { ...prev, visits: prev.visits.filter((v) => v.id !== id) };
    });
  }, [setAppState]);

  const markRouteVisitStatus = useCallback(
    (routeVisitId: string, status: RouteVisit["status"], reason?: string) => {
      setAppState((prev) => {
        const routeVisits = prev.routeVisits.map((rv) =>
          rv.id === routeVisitId ? { ...rv, status } : rv,
        );
        const changed = routeVisits.find((rv) => rv.id === routeVisitId);
        if (!changed) return { ...prev, routeVisits };

        // registra também uma "visita não realizada" (com justificativa) para o coordenador ver em Visitas
        const notDone = prev.visits.find(
          (v) => v.routeVisitId === routeVisitId && v.status === "nao_realizada",
        );
        if (status === "nao_realizada" && !notDone) {
          const nv: Visit = {
            id: `v-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            routeVisitId,
            clientId: changed.clientId,
            visitedAt: new Date().toISOString(),
            status: "nao_realizada",
            resultComments: reason ?? "",
            nextActions: "",
            gpsLat: null,
            gpsLng: null,
            gpsAccuracyM: null,
            distanceFromClientM: null,
            withinRadius: true,
          };
          // primeiro o registro de visita; depois o status da rota (o gatilho no banco
          // cria o registro caso o app não consiga — nunca duplica)
          if (uidRef.current) {
            void supabase
              .from("visits")
              .insert(visitToRow(nv))
              .then(({ error }) => {
                if (error) console.warn("registrar visita não realizada:", error.message);
              });
            upsertRv(changed);
          }
          return { ...prev, routeVisits, visits: [nv, ...prev.visits] };
        }
        if (status !== "nao_realizada" && notDone) {
          // ao reabrir ou concluir de verdade, remove o registro de "não realizada"
          if (uidRef.current) {
            void supabase.from("visits").delete().eq("id", notDone.id);
            upsertRv(changed);
          }
          return { ...prev, routeVisits, visits: prev.visits.filter((v) => v.id !== notDone.id) };
        }
        if (uidRef.current) upsertRv(changed);
        return { ...prev, routeVisits };
      });
    },
    [setAppState, upsertRv],
  );

  /** lista os usuários do app (nome e papel) */
  const listProfiles = useCallback(async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, role")
      .order("created_at");
    if (error) {
      console.warn("listar usuários:", error.message);
      return [];
    }
    return (data ?? []).map((r) => {
      const row = r as Record<string, unknown>;
      return {
        id: String(row.id),
        fullName: (row.full_name as string) ?? "",
        role: (row.role as Role) ?? "vendedor",
      };
    });
  }, []);

  /** define o papel de um usuário (só o coordenador consegue) */
  const setUserRole = useCallback(async (id: string, newRole: Role) => {
    const { error } = await supabase.from("profiles").update({ role: newRole }).eq("id", id);
    return error ? error.message : null;
  }, []);

  /* ---------- alertas manuais (coordenador e vendedor) ---------- */

  /** registra um alerta para qualquer cliente, mesmo sem ter feito a visita */
  const addAlert = useCallback(
    (clientId: string, motivo: string, photoData?: string) => {
      const texto = motivo.trim();
      if (!texto) {
        toast.error("Escreva o motivo do alerta.");
        return;
      }
      const id = `al-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const novo: ClientAlert = {
        id,
        clientId,
        motivo: texto,
        createdBy: uidRef.current,
        createdByName: user?.fullName ?? null,
        photoUrl: photoData ?? null,
        createdAt: new Date().toISOString(),
      };
      setAppState((prev) => ({ ...prev, alerts: [novo, ...prev.alerts] }));
      if (!uidRef.current) return;
      void (async () => {
        // a foto é opcional: sobe antes (se houver) e o alerta é gravado de qualquer forma
        const url =
          photoData && photoData.startsWith("data:")
            ? await uploadPhoto(`${clientId}/alerta-${id}.jpg`, photoData)
            : null;
        const { error } = await supabase.from("client_alerts").insert({
          id,
          client_id: clientId,
          motivo: texto,
          created_by: uidRef.current,
          created_by_name: novo.createdByName,
          photo_url: url,
        });
        if (error) {
          console.error("registrar alerta:", error.message);
          toast.error("Não foi possível salvar o alerta", { description: error.message });
          return;
        }
        if (url) {
          setAppState((prev) => ({
            ...prev,
            alerts: prev.alerts.map((a) => (a.id === id ? { ...a, photoUrl: url } : a)),
          }));
        }
        if (photoData && !url) {
          toast.warning("Alerta registrado, mas a foto não foi enviada.", {
            description: "Anexe a foto novamente se for necessário.",
          });
          return;
        }
        toast.success("Alerta registrado.");
      })();
    },
    [setAppState, uploadPhoto, user],
  );

  /** remove um alerta (quem criou ou o coordenador) */
  const deleteAlert = useCallback(
    (id: string) => {
      setAppState((prev) => ({ ...prev, alerts: prev.alerts.filter((a) => a.id !== id) }));
      if (!uidRef.current) return;
      void supabase
        .from("client_alerts")
        .delete()
        .eq("id", id)
        .then(({ error }) => {
          if (error) {
            console.error("excluir alerta:", error.message);
            toast.error("Não foi possível excluir o alerta", { description: error.message });
            return;
          }
          toast.success("Alerta removido.");
        });
    },
    [setAppState],
  );

  /* ---------- atividades extras do dia (viagem, manutenção, reunião…) ---------- */

  /** registra uma atividade do dia que não é visita a cliente */
  const addActivity = useCallback(
    (weekStart: string, day: number, titulo: string, obs: string, durationMin: number) => {
      const texto = titulo.trim();
      if (!texto) {
        toast.error("Escreva o que foi feito nessa atividade.");
        return;
      }
      const novo: RouteActivity = {
        id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        weekStart,
        day,
        titulo: texto,
        obs: obs.trim() || null,
        durationMin: Math.max(0, Math.round(durationMin) || 0),
        createdBy: uidRef.current,
        createdByName: user?.fullName ?? null,
        createdAt: new Date().toISOString(),
      };
      setAppState((prev) => ({ ...prev, activities: [...prev.activities, novo] }));
      if (!uidRef.current) return;
      void supabase
        .from("route_activities")
        .insert({
          id: novo.id,
          week_start: weekStart,
          day,
          titulo: texto,
          obs: novo.obs,
          duration_min: novo.durationMin,
          created_by: uidRef.current,
          created_by_name: novo.createdByName,
        })
        .then(({ error }) => {
          if (error) {
            console.error("registrar atividade:", error.message);
            toast.error("Não foi possível salvar a atividade", { description: error.message });
            return;
          }
          toast.success("Atividade registrada.");
        });
    },
    [setAppState, user],
  );

  /** remove uma atividade (quem criou ou o coordenador) */
  const deleteActivity = useCallback(
    (id: string) => {
      setAppState((prev) => ({ ...prev, activities: prev.activities.filter((a) => a.id !== id) }));
      if (!uidRef.current) return;
      void supabase
        .from("route_activities")
        .delete()
        .eq("id", id)
        .then(({ error }) => {
          if (error) {
            console.error("excluir atividade:", error.message);
            toast.error("Não foi possível excluir a atividade", { description: error.message });
            return;
          }
          toast.success("Atividade removida.");
        });
    },
    [setAppState],
  );

  /* ---------- backup / utilitários ---------- */

  const resetData = useCallback(() => {
    const base = emptyState();
    const clients = seedClients();
    const next: AppState = { ...base, clients, sessionRole: roleRef.current ?? "vendedor" };
    persistLocal(next);
    setState(next);
    if (canWriteClientData()) {
      void supabase.from("clients").upsert(clients.map((c) => clientToRow(c)));
      void supabase.from("settings").upsert(settingsToRow(next.settings));
    }
  }, []);

  const exportData = useCallback(() => JSON.stringify(state), [state]);

  const importData = useCallback((json: string): string | null => {
    try {
      const parsed = JSON.parse(json) as AppState;
      if (!parsed || !Array.isArray(parsed.clients)) return "Arquivo inválido: estrutura não reconhecida.";
      setAppState({
        ...emptyState(),
        ...parsed,
        alerts: parsed.alerts ?? [],
        activities: parsed.activities ?? [],
        volumes: parsed.volumes ?? [],
        settings: { ...defaultSettings, ...parsed.settings },
      });
      if (canWriteClientData()) {
        persistClientsBatch(parsed.clients);
        void supabase.from("settings").upsert(settingsToRow({ ...defaultSettings, ...parsed.settings }));
      }
      return null;
    } catch {
      return "Arquivo inválido: não é um JSON válido.";
    }
  }, [setAppState, persistClientsBatch]);

  const geocodeAll = useCallback(
    async (onProgress: (done: number, total: number, current: string) => void) => {
      if (roleRef.current !== "coordenador" || !uidRef.current) {
        toast.error("Geocodificação disponível apenas para o coordenador.");
        return { ok: 0, failed: state.clients.length };
      }
      const pending = state.clients.filter((c) => c.lat == null || c.geocodeStatus !== "ok");
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
        setAppState((prev) => ({
          ...prev,
          clients: prev.clients.map((x) =>
            x.id === c.id ? { ...x, geocodeStatus: status, lat, lng } : x,
          ),
        }));
        const { error } = await supabase
          .from("clients")
          .update({ lat, lng, geocode_status: status, updated_at: new Date().toISOString() })
          .eq("id", c.id);
        if (error) {
          console.warn("geocodificar/persistir cliente:", error.message);
          failed++;
        }
        if (i < pending.length - 1) {
          await new Promise((r) => setTimeout(r, 1100));
        }
      }
      return { ok, failed };
    },
    [state.clients, setAppState],
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
    user,
    role,
    authLoading,
    cloudReady,
    signIn,
    signUp,
    signOut,
    resetData,
    exportData,
    importData,
    geocodeAll,
    updateClient,
    createClient,
    deleteClient,
    loadClientColetas,
    listProfiles,
    setUserRole,
    recomputeTiers,
    updateSettings,
    generateRoute,
    createEmptyWeekRoute,
    updateWeekRoute,
    saveRoutePlan,
    updateRouteVisit,
    moveRouteVisit,
    removeRouteVisit,
    addRouteVisit,
    deleteRoute,
    publishRoute,
    addVisit,
    registerProspectVisit,
    setProspeccaoStatus,
    updateVisit,
    deleteVisit,
    markRouteVisitStatus,
    addAlert,
    deleteAlert,
    addActivity,
    deleteActivity,
    storageUsageKb,
    lastSyncAt,
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}
