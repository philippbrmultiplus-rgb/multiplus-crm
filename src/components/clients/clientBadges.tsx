import { Badge } from "@/components/ui/badge";
import { intervalDays } from "@/lib/cadence";
import { coletaDays, isColetaOverdue, tierBadgeClass, TIER_LABEL } from "@/components/clients/clientBits";
import type { Client, Tier } from "@/lib/types";

export function TierBadge({ tier, showFreq }: { tier: Tier; showFreq?: boolean }) {
  const freq = tier === "A" ? "4x" : tier === "B" ? "3x" : tier === "C" ? "2x" : "<2x";
  return (
    <span className="inline-flex shrink-0 items-center gap-1" title={TIER_LABEL[tier]}>
      <Badge className={tierBadgeClass(tier)}>{tier}</Badge>
      {showFreq && <span className="text-[10px] text-muted-foreground">{freq}</span>}
    </span>
  );
}

function coletaBadgeClass(c: Client): string {
  if (isColetaOverdue(c)) return "bg-destructive/15 text-destructive ring-1 ring-destructive/30";
  const days = coletaDays(c);
  if (days == null) return "";
  const interval = intervalDays(c.freqMonth);
  if (interval <= 0) return "";
  if (days >= Math.max(3, Math.floor(interval / 2)))
    return "bg-amber-500/15 text-amber-700 ring-1 ring-amber-500/30 dark:text-amber-300";
  return "bg-primary/10 text-primary";
}

export function ColetaBadge({ c, withLabel }: { c: Client; withLabel?: boolean }) {
  const days = coletaDays(c);
  if (days == null) return <Badge variant="outline">sem data</Badge>;
  const overdue = isColetaOverdue(c);
  const base = days === 0 ? "hoje" : `há ${days} ${days === 1 ? "dia" : "dias"}`;
  const text = withLabel && overdue ? `${base} · atrasada` : base;
  return <Badge className={coletaBadgeClass(c)}>{text}</Badge>;
}
