export type Role = "coordenador" | "vendedor" | "gerente";

export type Tier = "A" | "B" | "C" | "D";

export type GeocodeStatus = "pendente" | "ok" | "falha";

/** situação de uma prospecção */
export type ProspeccaoStatus = "em_negociacao" | "fechado" | "perdido";

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
  /** data (yyyy-mm-dd) da última visita REALIZADA registrada pelo vendedor (zera o contador de dias sem visita) */
  lastVisitAt?: string | null;
  /** cliente marcado como prospecção (novo cliente em negociação) */
  isProspecao: boolean;
  /** telefone/whatsapp de contato */
  contato?: string | null;
  /** nome do responsável (contato principal) */
  responsavel?: string | null;
  /** situação da prospecção (só para clientes de prospecção) */
  prospeccaoStatus?: ProspeccaoStatus | null;
  /** justificativa escrita quando a prospecção é marcada como perdida */
  prospeccaoJustificativa?: string | null;
  lat: number | null;
  /** coordenada aproximada (obtida pela cidade, não pelo endereço exato) */
  geoAproximado?: boolean;
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

export type VisitStatus = "realizada" | "nao_encontrado" | "recusada" | "nao_realizada";

/** dados de uma "visita prospecção" registrada pelo vendedor (cliente novo + visita) */
export interface ProspectVisitInput {
  routeId?: string | null;
  day: number;
  nome: string;
  responsavel?: string;
  contato?: string;
  endereco?: string;
  cidade?: string;
  segmento?: string;
  obs?: string;
  status: VisitStatus;
  comments: string;
  nextActions: string;
  photoData?: string;
  photoDataList?: string[];
  alerta?: boolean;
  alertaMotivo?: string;
  gpsLat?: number | null;
  gpsLng?: number | null;
  gpsAccuracyM?: number | null;
  /** coordenadas do cliente prospectado (para já entrar geocodificado no cadastro) */
  clientLat?: number | null;
  clientLng?: number | null;
}

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
  /** lista (local, base64) das fotos escolhidas antes de subir */
  photoDataList?: string[];
  /** lista de URLs públicas das fotos na nuvem */
  photos?: string[] | null;
  /** visita marcada pelo vendedor como alerta */
  alerta?: boolean;
  /** motivo do alerta */
  alertaMotivo?: string;
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
