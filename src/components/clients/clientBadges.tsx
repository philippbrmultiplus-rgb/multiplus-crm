import { Badge } from "@/components/ui/badge";
import {
  coletaDays,
  coletaStatus,
  COLETA_BADGE_TONE,
  isColetaOverdue,
  tierBadgeClass,
  TIER_LABEL,
} from "@/components/clients/clientBits";
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

export function ColetaBadge({ c, withLabel }: { c: Client; withLabel?: boolean }) {
  const days = coletaDays(c);
  if (days == null) return <Badge variant="outline">sem data</Badge>;
  const status = coletaStatus(c);
  const base = days === 0 ? "hoje" : `há ${days} ${days === 1 ? "dia" : "dias"}`;
  const text = withLabel && status === "late" ? `${base} · atrasada` : base;
  return <Badge className={COLETA_BADGE_TONE[status]}>{text}</Badge>;
}
