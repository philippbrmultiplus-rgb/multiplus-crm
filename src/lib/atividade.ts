/** sugestões rápidas para uma atividade extra do dia */
export const SUGESTOES_ATIVIDADE = [
  "Viagem a outra cidade",
  "Carro em manutenção",
  "Reunião na empresa",
  "Prospecção na fábrica",
  "Prospecção em campo",
  "Compra de material",
  "Carga e descarga",
  "Outro",
];

/** durações rápidas (minutos) oferecidas no registro */
export const DURACOES = [15, 30, 45, 60, 90, 120, 180, 240, 480];

/** "90" -> "1h30" · "45" -> "45 min" · "120" -> "2h" */
export function formatDuracao(min: number): string {
  if (!min || min <= 0) return "sem tempo informado";
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h}h`;
  return `${h}h${String(m).padStart(2, "0")}`;
}

/** soma os minutos das atividades de um dia */
export function totalMinutos(atividades: Array<{ durationMin: number }>): number {
  return atividades.reduce((acc, a) => acc + (a.durationMin || 0), 0);
}
