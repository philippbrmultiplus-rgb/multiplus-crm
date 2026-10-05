export type Role = "coordenador" | "vendedor" | "gerente";

export type Tier = "A" | "B" | "C" | "D";

export type GeocodeStatus = "pendente" | "ok" | "falha";

/** situação de uma prospecção */
export type ProspeccaoStatus = "em_negociacao" | "fechado" | "proposta_recusada";

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
  /** justificativa escrita quando a proposta é recusada */
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

/** alerta registrado à mão sobre um cliente (não depende de visita) */
export interface ClientAlert {
  id: string;
  clientId: string;
  /** motivo escrito por quem registrou */
  motivo: string;
  createdBy?: string | null;
  createdByName?: string | null;
  /** foto opcional anexada ao alerta (URL pública ou base64 antes do envio) */
  photoUrl?: string | null;
  /** data/hora do registro (ISO) */
  createdAt: string;
}

/** atividade extra do dia (viagem, manutenção, reunião…) — não é visita a cliente */
export interface RouteActivity {
  id: string;
  /** segunda-feira da semana (yyyy-mm-dd) */
  weekStart: string;
  /** 1 = segunda … 6 = sábado */
  day: number;
  /** descrição curta: "Viagem a Caxias do Sul", "Carro em manutenção"… */
  titulo: string;
  obs?: string | null;
  /** tempo gasto na atividade, em minutos */
  durationMin: number;
  createdBy?: string | null;
  createdByName?: string | null;
  createdAt: string;
}

/** volume coletado de um cliente em um mês (m³) — alimenta o comparativo mensal */
export interface MonthlyVolume {
  id: string;
  /** cliente cadastrado; null quando a linha da planilha não tem cadastro vinculado */
  clientId: string | null;
  /** nome usado na planilha, quando não há cadastro vinculado */
  label: string | null;
  /** primeiro dia do mês da coleta (yyyy-mm-dd) */
  month: string;
  volumeM3: number;
}

export interface AppState {
  version: number;
  sessionRole: Role;
  clients: Client[];
  settings: Settings;
  routes: WeeklyRoute[];
  routeVisits: RouteVisit[];
  visits: Visit[];
  alerts: ClientAlert[];
  activities: RouteActivity[];
  volumes: MonthlyVolume[];
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
