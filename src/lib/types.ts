export type Role = "coordenador" | "vendedor";

export type Tier = "A" | "B" | "C" | "D";

export type GeocodeStatus = "pendente" | "ok" | "falha";

export interface Client {
  id: string;
  name: string;
  segment: string;
  address: string;
  city: string;
  state: string;
  active: boolean;
  total2025: number;
  total2026: number;
  avgMonthly: number;
  tier: Tier;
  /** cadência de visitas por mês (ex.: 4 = 4x/mês, 1 = mensal, 0.5 = a cada 2 meses, 0 = fora da rota) */
  freqMonth: number;
  /** data (yyyy-mm-dd) da última troca/coleta de material informada */
  lastCollectAt?: string | null;
  lat: number | null;
  lng: number | null;
  geocodeStatus: GeocodeStatus;
  obs?: string;
}

export interface Settings {
  homeLat: number;
  homeLng: number;
  workStart: string; // "07:00"
  workEnd: string; // "17:00"
  visitTimeMin: number;
  travelSpeedKmh: number;
  workingDays: number[]; // 1=seg ... 6=sáb (Date.getDay())
  tierAThreshold: number;
  tierBThreshold: number;
  visitRadiusM: number;
}

export type RouteStatus = "rascunho" | "publicada" | "encerrada";

export interface WeeklyRoute {
  id: string;
  weekStart: string; // ISO date (segunda-feira)
  status: RouteStatus;
  generatedAt: string;
  notes?: string;
}

export type RouteVisitStatus = "pendente" | "concluida" | "nao_realizada";

export interface RouteVisit {
  id: string;
  routeId: string;
  clientId: string;
  day: number; // 1..6 (seg-sáb)
  position: number;
  estTravelMin: number;
  estVisitMin: number;
  status: RouteVisitStatus;
}

export type VisitStatus = "realizada" | "nao_encontrado" | "recusada";

export interface Visit {
  id: string;
  routeVisitId: string | null;
  clientId: string;
  visitedAt: string; // ISO
  status: VisitStatus;
  resultComments: string;
  nextActions: string;
  gpsLat: number | null;
  gpsLng: number | null;
  gpsAccuracyM: number | null;
  distanceFromClientM: number | null;
  withinRadius: boolean;
  /** fonte da imagem de comprovação (base64 local ou URL pública da nuvem) */
  photoData?: string;
  /** URL pública quando a foto está na nuvem */
  photoUrl?: string | null;
  createdBy?: string;
}

export interface AppState {
  version: number;
  sessionRole: Role;
  clients: Client[];
  settings: Settings;
  routes: WeeklyRoute[];
  routeVisits: RouteVisit[];
  visits: Visit[];
}

export interface DaySummary {
  day: number;
  count: number;
  travelKm: number;
  totalMin: number;
  endClock: string;
}

export interface RoutePlanResult {
  route: WeeklyRoute;
  routeVisits: RouteVisit[];
  warnings: string[];
  daySummaries: DaySummary[];
}

export interface ScheduledVisit {
  routeVisit: RouteVisit;
  client: Client;
  /** minutos corridos desde o início do expediente */
  arrivalMin: number;
  arrivalClock: string;
  depClock: string;
  travelMin: number;
  visitMin: number;
}
