export type Role = "coordenador" | "vendedor" | "gerente";

export type Tier = "A" | "B" | "C" | "D";

export type GeocodeStatus = "pendente" | "ok" | "falha";

/** situação de uma prospecção */
export type ProspeccaoStatus = "em_negociacao" | "fechado" | "proposta_recusada";

export interface Client {
  id: string;
  name: string;
  /** segmento logístico (como a coleta é feita: Rollon, Poli, Porta a Porta…) */
  segment: string;
  /** segmento comercial (como o cliente atua no mercado) */
  segmentoComercial?: string | null;
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
  /** data (yyyy-mm-dd) agendada para visitar este cliente */
  visitaAgendada?: string | null;
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
  /** segmento logístico (escolhido entre os já cadastrados) */
  segmento?: string;
  /** segmento comercial informado pelo vendedor */
  segmentoComercial?: string;
  /** data (yyyy-mm-dd) agendada para visitar o cliente */
  visitaAgendada?: string;
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
  /** como o contato foi feito: presencial (vazio) ou por telefone */
  tipoContato?: "telefone" | null;
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

/** condições de pagamento acertadas com o cliente (planilha de pagamentos) */
export interface ClientPayment {
  id: string;
  /** cliente cadastrado; null quando a linha da planilha não tem cadastro */
  clientId: string | null;
  /** nome usado na planilha */
  label: string | null;
  /** "R$ 800.00", "35m³", "R$45,00 a ton", "16,00 m³"… */
  valor: string;
  /** como a máquina é paga ("Não", "Sim", "R$440,00 (fixo)"…) */
  maquina: string | null;
  /** tipo de serviço: ROLL ON, POLI, PP, CARREG. NA HORA… */
  servico: string | null;
  /** modalidade: "Fechamento mensal", "Coletou pagou", "Antecipação de 3 cargas"… */
  modalidade: string | null;
}

/** cadência de troca de um cliente: média de dias entre coletas (planilha de cadência) */
export interface ClientCadence {
  clientId: string | null;
  /** média de dias entre uma coleta e a próxima */
  mediaDias: number | null;
  /** quantas coletas do cliente entraram no cálculo */
  coletas: number;
  /** data da última coleta considerada (yyyy-mm-dd) */
  ultimaColeta: string | null;
  /** datas das coletas que entraram no cálculo (yyyy-mm-dd) */
  datas: string[];
}

/** prospecção interna: ficha preenchida pela equipe (sem visita em campo) */
export interface InternalProspect {
  id: string;
  nome: string;
  cidade: string;
  endereco: string;
  /** pessoa de contato na empresa */
  contato: string;
  /** número de telefone */
  telefone: string;
  segmentoComercial: string;
  /** segmento logístico (lista dos já cadastrados) */
  segmentoLogistico: string;
  /** o que foi conversado com o cliente */
  observacoes: string;
  /** data (yyyy-mm-dd) agendada para visitar o cliente */
  visitaAgendada?: string | null;
  createdBy?: string | null;
  createdByName?: string | null;
  createdAt: string;
}

/** anotação datada do histórico de conversa de uma prospecção interna */
export interface InternalProspectNote {
  id: string;
  prospectId: string;
  texto: string;
  createdBy?: string | null;
  createdByName?: string | null;
  createdAt: string;
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
  payments: ClientPayment[];
  cadence: ClientCadence[];
  internalProspects: InternalProspect[];
  internalProspectNotes: InternalProspectNote[];
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
