import type {
  Client,
  DaySummary,
  RoutePlanResult,
  RouteVisit,
  ScheduledVisit,
  Settings,
  WeeklyRoute,
} from "./types";
import {
  DAY_NAMES,
  daysSinceToday,
  formatMinutes,
  hashStr,
  minutesToClock,
  roadKm,
  timeToMinutes,
  travelMinutes,
} from "./geo";
import { intervalDays } from "./cadence";

interface Candidate {
  client: Client;
  distHomeKm: number;
}

interface DayState {
  items: Client[];
  lastLat: number;
  lastLng: number;
  /** minutos usados, incluindo o retorno à base ao fim do dia */
  usedMin: number;
}

/** Cliente deve ser visitado nesta semana pela rotação da cadência? */
export function shouldVisit(client: Client, weekIndex: number, monthIndex: number, monthWeek: number): boolean {
  if (!client.active || client.freqMonth <= 0) return false;
  const h = hashStr(client.id);
  const f = client.freqMonth;
  if (f >= 4) return true; // ~semanal
  if (f >= 3) return (h + weekIndex) % 4 < 3; // 3 de cada 4 semanas
  if (f >= 2) return (h + weekIndex) % 2 === 0; // a cada 2 semanas
  if (f >= 1) return monthWeek === (h % 4) + 1; // 1x por mês
  return monthIndex % 2 === 0 && monthWeek === (h % 4) + 1; // 1x a cada 2 meses
}

/** Atrasado se o tempo desde a última troca já passou do intervalo ideal. */
export function isOverdue(client: Client): boolean {
  const days = daysSinceToday(client.lastCollectAt);
  const interval = intervalDays(client.freqMonth);
  if (days == null || interval <= 0) return false;
  return days >= interval;
}

export function weekMeta(weekStartIso: string) {
  const d = new Date(`${weekStartIso}T12:00:00`);
  const epochDays = Math.floor(d.getTime() / 86400000);
  const weekIndex = Math.floor(epochDays / 7);
  const monthIndex = d.getMonth();
  const monthWeek = Math.floor((d.getDate() - 1) / 7) + 1;
  return { weekIndex, monthIndex, monthWeek };
}

/**
 * Gera a rota semanal respeitando 07h–17h (ida e volta à base no mesmo dia):
 * 1. Seleciona candidatos pela rotação de frequência.
 * 2. Processa primeiro os clientes mais distantes (mais restritivos).
 * 3. Insere cada cliente no dia com mais folga de horário que comporte o
 *    deslocamento incremental + visita + retorno à base.
 * 4. Reordena cada dia por vizinho-mais-próximo a partir da base.
 */
export function generateWeekRoute(
  clients: Client[],
  settings: Settings,
  weekStart: string,
  existingRoutes: WeeklyRoute[],
): RoutePlanResult {
  const warnings: string[] = [];
  const startMin = timeToMinutes(settings.workStart);
  const endMin = timeToMinutes(settings.workEnd);
  const budgetMin = endMin - startMin;
  const days = [...settings.workingDays].sort((a, b) => a - b);

  // sem cadência: todo cliente ATIVO com coordenadas entra na semana, distribuído
  // pelos dias úteis dentro do expediente (sábado/domingo ficam de fora)
  const candidates: Candidate[] = [];
  const noCoord: string[] = [];
  const farClients: string[] = [];
  // raio máximo para "dia único" (ida+visita+volta dentro do expediente)
  const oneWayBudgetMin = budgetMin / 2;
  const maxDayTripKm = (oneWayBudgetMin / 60) * settings.travelSpeedKmh / 1.3;
  for (const c of clients) {
    if (!c.active) continue;
    if (c.lat == null || c.lng == null) {
      noCoord.push(c.name);
      continue;
    }
    const dist = roadKm(settings.homeLat, settings.homeLng, c.lat, c.lng);
    if (dist > maxDayTripKm) {
      farClients.push(c.name);
      continue;
    }
    candidates.push({ client: c, distHomeKm: dist });
  }
  if (noCoord.length > 0) {
    warnings.push(
      `${noCoord.length} cliente(s) sem coordenadas ficaram de fora: ${noCoord.slice(0, 4).join(", ")}${noCoord.length > 4 ? "…" : ""}. Marque no mapa ou ajuste a frequência.`,
    );
  }
  if (farClients.length > 0) {
    warnings.push(
      `${farClients.length} cliente(s) muito distantes para um dia único (ex.: ${farClients.slice(0, 4).join(", ")}${farClients.length > 4 ? "…" : ""}). Inclua-os manualmente como viagem especial.`,
    );
  }
  if (candidates.length === 0) {
    warnings.push("Nenhum cliente ativo com coordenadas disponível para esta semana.");
  }

  // distantes primeiro
  candidates.sort((a, b) => b.distHomeKm - a.distHomeKm);

  const dayState = new Map<number, DayState>();
  days.forEach((d) =>
    dayState.set(d, {
      items: [],
      lastLat: settings.homeLat,
      lastLng: settings.homeLng,
      usedMin: 0,
    }),
  );

  const travel = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) =>
    travelMinutes(roadKm(a.lat, a.lng, b.lat, b.lng), settings.travelSpeedKmh);

  const home = { lat: settings.homeLat, lng: settings.homeLng };
  const lastPt = (st: DayState) => ({ lat: st.lastLat, lng: st.lastLng });

  for (const cand of candidates) {
    const c = cand.client;
    const pt = { lat: c.lat!, lng: c.lng! };

    let chosen: number | null = null;
    let bestIncr = Infinity;
    let bestRemaining = -Infinity;
    for (const d of days) {
      const st = dayState.get(d)!;
      const retPrev = travel(lastPt(st), home);
      const incr = travel(lastPt(st), pt);
      const retNew = travel(pt, home);
      const newCost = st.usedMin - retPrev + incr + settings.visitTimeMin + retNew;
      if (newCost <= budgetMin) {
        // prefere o dia cujo último ponto é o mais próximo (agrupa por região);
        // desempate: dia com mais folga
        if (incr < bestIncr || (incr === bestIncr && budgetMin - newCost > bestRemaining)) {
          bestIncr = incr;
          bestRemaining = budgetMin - newCost;
          chosen = d;
        }
      }
    }
    if (chosen === null) {
      // não cabe em nenhum dia: coloca no dia com mais folga (gera aviso)
      let maxRem = -Infinity;
      for (const d of days) {
        const rem = budgetMin - dayState.get(d)!.usedMin;
        if (rem > maxRem) {
          maxRem = rem;
          chosen = d;
        }
      }
    }

    const st = dayState.get(chosen!)!;
    const retPrev = travel(lastPt(st), home);
    const incr = travel(lastPt(st), pt);
    const retNew = travel(pt, home);
    st.usedMin = st.usedMin - retPrev + incr + settings.visitTimeMin + retNew;
    st.lastLat = c.lat!;
    st.lastLng = c.lng!;
    st.items.push(c);
  }

  // monta a rota final com ordem vizinho-mais-próximo por dia
  const routeId = `route-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const route: WeeklyRoute = {
    id: routeId,
    weekStart,
    status: "rascunho",
    generatedAt: new Date().toISOString(),
  };
  const routeVisits: RouteVisit[] = [];
  const daySummaries: DaySummary[] = [];

  for (const day of days) {
    const st = dayState.get(day)!;
    if (st.items.length === 0) continue;

    const remaining = [...st.items];
    const ordered: Client[] = [];
    const travelSeq: number[] = [];
    let cur = { lat: settings.homeLat, lng: settings.homeLng };
    while (remaining.length > 0) {
      let bestIdx = 0;
      let bestDist = Infinity;
      remaining.forEach((c, i) => {
        const dist = roadKm(cur.lat, cur.lng, c.lat!, c.lng!);
        if (dist < bestDist) {
          bestDist = dist;
          bestIdx = i;
        }
      });
      const next = remaining.splice(bestIdx, 1)[0];
      ordered.push(next);
      travelSeq.push(bestDist);
      cur = { lat: next.lat!, lng: next.lng! };
    }

    let running = 0;
    let travelKmTotal = 0;
    ordered.forEach((client, idx) => {
      const travelMin = travelMinutes(travelSeq[idx], settings.travelSpeedKmh);
      running += travelMin;
      running += settings.visitTimeMin;
      travelKmTotal += travelSeq[idx];
      routeVisits.push({
        id: `rv-${routeId}-${day}-${idx}`,
        routeId,
        clientId: client.id,
        day,
        position: idx,
        estTravelMin: travelMin,
        estVisitMin: settings.visitTimeMin,
        status: "pendente",
      });
    });
    const returnKm = roadKm(
      settings.homeLat,
      settings.homeLng,
      ordered[ordered.length - 1].lat!,
      ordered[ordered.length - 1].lng!,
    );
    travelKmTotal += returnKm;
    const endClock = minutesToClock(startMin + running);
    if (running > budgetMin) {
      warnings.push(
        `${DAY_NAMES[day]}: a rota não fecha em 1 dia (termina às ${endClock}, com ~${formatMinutes(running - budgetMin)} além do expediente). Considere dividir em 2 dias ou remover visitas.`,
      );
    }
    daySummaries.push({ day, count: ordered.length, travelKm: travelKmTotal, totalMin: running, endClock });
  }

  const prev = existingRoutes.filter((r) => r.weekStart === weekStart);
  if (prev.length > 0) {
    warnings.push(`Havia ${prev.length} rota(s) para esta semana; substituída pela nova.`);
  }

  return { route, routeVisits, warnings, daySummaries };
}

/** Calcula horários de chegada/saída de cada visita de um dia, em ordem. */
export function computeSchedule(
  routeVisits: RouteVisit[],
  clients: Client[],
  settings: Settings,
  day: number,
): ScheduledVisit[] {
  const items = routeVisits
    .filter((rv) => rv.day === day)
    .sort((a, b) => a.position - b.position);
  const clientMap = new Map(clients.map((c) => [c.id, c]));
  const result: ScheduledVisit[] = [];
  let curLat = settings.homeLat;
  let curLng = settings.homeLng;
  let running = 0;
  for (const rv of items) {
    const client = clientMap.get(rv.clientId);
    if (!client) continue;
    let travel = rv.estTravelMin;
    if (client.lat != null) {
      travel = travelMinutes(roadKm(curLat, curLng, client.lat, client.lng), settings.travelSpeedKmh);
    }
    running += travel;
    const arrival = running;
    const dep = running + rv.estVisitMin;
    result.push({
      routeVisit: rv,
      client,
      arrivalMin: arrival,
      arrivalClock: minutesToClock(timeToMinutes(settings.workStart) + arrival),
      depClock: minutesToClock(timeToMinutes(settings.workStart) + dep),
      travelMin: travel,
      visitMin: rv.estVisitMin,
    });
    running = dep;
    if (client.lat != null) {
      curLat = client.lat;
      curLng = client.lng;
    }
  }
  return result;
}

export function routeTotalKm(visits: ScheduledVisit[], settings: Settings): string {
  const total = visits.reduce((acc, s) => acc + s.travelMin, 0);
  return formatMinutes(total);
}
