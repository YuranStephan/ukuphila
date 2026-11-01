/** The business day is the Maputo day (UTC+2, no daylight saving), wherever the server runs. */
const OFFSET_MS = 2 * 3_600_000;
const DAY_MS = 86_400_000;

export function maputoDay(at: Date | number = new Date()) {
  return new Date(new Date(at).getTime() + OFFSET_MS).toISOString().slice(0, 10);
}

export function addDays(day: string, days: number) {
  return new Date(Date.parse(`${day}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

export function daysBetween(from: string, to: string) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);
}

/** UTC instant at which a Maputo day starts. */
export function dayStart(day: string) {
  return new Date(Date.parse(`${day}T00:00:00Z`) - OFFSET_MS);
}

export function daysAgo(days: number, from: Date = new Date()) {
  return new Date(from.getTime() - days * DAY_MS);
}

const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const WEEKDAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

export function formatDay(value: string | Date) {
  const day = typeof value === "string" ? value.slice(0, 10) : maputoDay(value);
  const [year, month, date] = day.split("-").map(Number);
  return `${date} ${MONTHS[month - 1]} ${year}`;
}

export function formatShortDay(value: string | Date) {
  const day = typeof value === "string" ? value.slice(0, 10) : maputoDay(value);
  const [, month, date] = day.split("-").map(Number);
  return `${date} ${MONTHS[month - 1]}`;
}

export function weekdayName(day: string) {
  return WEEKDAYS[new Date(`${day}T00:00:00Z`).getUTCDay()];
}

export function formatTime(value: Date | string) {
  const shifted = new Date(new Date(value).getTime() + OFFSET_MS);
  return shifted.toISOString().slice(11, 16);
}

export function formatDateTime(value: Date | string) {
  return `${formatDay(new Date(value))}, ${formatTime(value)}`;
}

export function relativeTime(value: Date | string, now: Date = new Date()) {
  const seconds = Math.round((now.getTime() - new Date(value).getTime()) / 1000);
  if (seconds < 60) return "agora mesmo";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.round(hours / 24);
  if (days === 1) return "ontem";
  if (days < 30) return `há ${days} dias`;
  return formatDay(new Date(value));
}

export function greeting(at: Date = new Date()) {
  const hour = new Date(at.getTime() + OFFSET_MS).getUTCHours();
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}
