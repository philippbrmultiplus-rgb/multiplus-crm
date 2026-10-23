/** Utilidades geográficas (Haversine) e de tempo. */

export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** Estimativa de distância por estrada (linha reta × 1,3). */
export function roadKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  return haversineKm(lat1, lng1, lat2, lng2) * 1.3;
}

export function travelMinutes(km: number, speedKmh: number): number {
  return Math.max(1, Math.round((km / speedKmh) * 60));
}

export function distanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  return haversineKm(lat1, lng1, lat2, lng2) * 1000;
}

/** ponto de partida das rotas (base) */
export const BASE_ADDRESS = "Centro, Paulínia - SP";
export const BASE_LAT = -22.7617;
export const BASE_LNG = -47.1542;

/** distância rodoviária aproximada (km) da base até um ponto */
export function distanciaDaBaseKm(lat: number | null, lng: number | null): number | null {
  if (lat == null || lng == null) return null;
  return roadKm(BASE_LAT, BASE_LNG, lat, lng);
}

export function formatKm(km: number): string {
  if (km >= 100) return `${Math.round(km)} km`;
  return `${km.toFixed(1)} km`;
}

export function formatDistanceM(m: number): string {
  if (m >= 1000) return `${(m / 1000).toFixed(2)} km`;
  return `${Math.round(m)} m`;
}

/** "07:30" -> minutos desde meia-noite */
export function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

/** minutos desde meia-noite -> "HH:MM" */
export function minutesToClock(min: number): string {
  const clamped = Math.max(0, min);
  const h = Math.floor(clamped / 60);
  const m = Math.round(clamped % 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function formatMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h <= 0) return `${m} min`;
  return `${h}h${m > 0 ? String(m).padStart(2, "0") : ""}`;
}

export function todayKey(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

/** converte um instante (ISO) para "yyyy-mm-dd" no fuso local do aparelho */
export function toLocalDateKey(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

/** dias inteiros entre uma data (yyyy-mm-dd) e hoje (0 = hoje; cresce sozinho dia a dia) */
export function daysSinceToday(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return null;
  const from = new Date(y, m - 1, d).getTime();
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.max(0, Math.floor((today - from) / 86400000));
}

/** nomes dos meses em português */
export const MESES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

/** "2026-07-01" -> "Julho/2026" */
export function mesLabel(iso: string): string {
  const [y, m] = iso.split("-").map(Number);
  return `${MESES[(m || 1) - 1]}/${y}`;
}

/** número no padrão pt-BR com até 1 casa decimal (ex.: 13,4) */
export function formatNumero(n: number): string {
  return n.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
}

/** volume em m³ (sem casas decimais quando é inteiro) */
export function formatM3(n: number): string {
  return formatNumero(n);
}

/** "porto alegre" -> "Porto Alegre" (conectivos ficam minúsculos) */
export function tituloCidade(valor: string): string {
  const conectivos = new Set(["de", "da", "do", "das", "dos", "e"]);
  return valor
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .split(" ")
    .map((p, i) => (i > 0 && conectivos.has(p) ? p : p.charAt(0).toUpperCase() + p.slice(1)))
    .join(" ");
}

/**
 * Devolve a grafia já conhecida da cidade (evita "porto alegre" e "Porto Alegre"
 * virarem duas cidades); se for nova, devolve em formato de título.
 */
export function canonicalCidade(valor: string, conhecidas: string[]): string {
  const chave = cidadeKey(valor);
  const achada = conhecidas.find((c) => cidadeKey(c) === chave);
  return achada ?? tituloCidade(valor);
}

/** chave de comparação de cidade: sem acento, sem espaços repetidos e em minúsculas */
export function cidadeKey(cidade: string | null | undefined): string {
  return (cidade ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export interface CidadeOpcao {
  /** grafia exibida — sempre com letra maiúscula */
  label: string;
  count: number;
}

/**
 * agrupa as cidades da carteira em ordem alfabética: grafias que só diferem por
 * maiúscula/minúscula (ou acento) viram uma única opção, mantendo o rótulo com letra maiúscula
 */
export function agruparCidades(valores: Array<string | null | undefined>): CidadeOpcao[] {
  const grupos = new Map<string, { grafias: Map<string, number>; count: number }>();
  for (const valor of valores) {
    const grafia = (valor ?? "").replace(/\s+/g, " ").trim();
    if (!grafia) continue;
    const chave = cidadeKey(grafia);
    const grupo = grupos.get(chave) ?? { grafias: new Map<string, number>(), count: 0 };
    grupo.grafias.set(grafia, (grupo.grafias.get(grafia) ?? 0) + 1);
    grupo.count += 1;
    grupos.set(chave, grupo);
  }
  const temMaiuscula = (s: string) => (/[A-ZÀ-Þ]/.test(s) ? 0 : 1);
  const minusculas = (s: string) => (s.match(/[a-zà-þ]/g) ?? []).length;
  return [...grupos.values()]
    .map((g) => {
      const grafias = [...g.grafias.entries()].sort(
        (a, b) =>
          temMaiuscula(a[0]) - temMaiuscula(b[0]) ||
          minusculas(b[0]) - minusculas(a[0]) ||
          b[1] - a[1] ||
          a[0].localeCompare(b[0], "pt-BR"),
      );
      return { label: grafias[0][0], count: g.count };
    })
    .sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
}

/** Segunda-feira da semana de uma data ISO. */
export function mondayOf(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  const dow = (d.getDay() + 6) % 7; // seg=0 ... dom=6
  d.setDate(d.getDate() - dow);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export function formatDateBR(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export const DAY_NAMES: Record<number, string> = {
  1: "Segunda",
  2: "Terça",
  3: "Quarta",
  4: "Quinta",
  5: "Sexta",
  6: "Sábado",
  0: "Domingo",
};

/** Hash determinístico simples para rotação de frequência. */
export function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0;
  }
  return h;
}
