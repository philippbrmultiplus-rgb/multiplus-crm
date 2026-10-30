import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export interface MultiSelectOption {
  value: string;
  label: string;
  count?: number;
}

/**
 * Filtro com seleção múltipla: dá para marcar mais de uma opção e ver todas juntas.
 * Sem nenhuma marcada, vale "todos".
 */
export function MultiSelect({
  values,
  onChange,
  placeholder,
  options,
  allLabel = "Todos",
  widthClass = "w-56",
}: {
  values: string[];
  onChange: (values: string[]) => void;
  /** texto quando nada está selecionado */
  placeholder: string;
  options: MultiSelectOption[];
  allLabel?: string;
  widthClass?: string;
}) {
  const resumo =
    values.length === 0
      ? placeholder
      : values.length === 1
        ? (options.find((o) => o.value === values[0])?.label ?? "1 selecionado")
        : `${values.length} selecionados`;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={`${widthClass} justify-between font-normal ${
            values.length > 0 ? "border-primary/50 text-foreground" : "text-muted-foreground"
          }`}
        >
          <span className="truncate">{resumo}</span>
          <ChevronDown className="ml-1 h-4 w-4 shrink-0 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2" align="start">
        <div className="max-h-64 space-y-0.5 overflow-y-auto overscroll-contain">
          <label className="flex cursor-pointer items-center gap-2 rounded px-1 py-1.5 text-sm hover:bg-secondary/50">
            <Checkbox checked={values.length === 0} onCheckedChange={() => onChange([])} />
            <span className="min-w-0 flex-1 truncate">{placeholder}</span>
          </label>
          {options.map((o) => (
            <label
              key={o.value}
              className="flex cursor-pointer items-center gap-2 rounded px-1 py-1.5 text-sm hover:bg-secondary/50"
            >
              <Checkbox
                checked={values.includes(o.value)}
                onCheckedChange={(c) =>
                  onChange(c ? [...values, o.value] : values.filter((v) => v !== o.value))
                }
              />
              <span className="min-w-0 flex-1 truncate">{o.label}</span>
              {o.count != null && (
                <span className="shrink-0 text-xs text-muted-foreground">{o.count}</span>
              )}
            </label>
          ))}
          {options.length === 0 && (
            <p className="px-1 py-2 text-sm text-muted-foreground">Nada disponível.</p>
          )}
        </div>
        {values.length > 0 && (
          <div className="mt-2 border-t pt-2">
            <Button variant="ghost" size="sm" className="w-full" onClick={() => onChange([])}>
              {allLabel}
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
