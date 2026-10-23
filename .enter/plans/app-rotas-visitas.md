# Plano — Rota semanal sem cadência, navegação de semanas e prospecção

## Contexto

No RotaSul o coordenador monta a rota semanal. Hoje a geração usa a cadência
(`shouldVisit` em `src/lib/route.ts`) para escolher quais clientes entram na
semana. O usuário quer:

1. **Geração sem cadência**: todo cliente **ativo** entra **ao menos 1x na
   semana**, distribuído entre os dias úteis (seg–sex, sáb/dom fora), de modo que
   o calendário se mantenha com o passar dos dias.
2. **Navegação de semanas**: manter o modelo por semana, mas deixar a semana
   **anterior e a seguinte** navegáveis (gerar quando o coordenador clicar em
   "Gerar").
3. **Prospecção**: poder criar um registro de cliente marcado como "Prospecção",
   com todos os campos que um cliente comum tem, e adicioná-lo direto no dia da
   rota. Podem existir várias prospecções.

## Mudanças

### 1. Geração sem cadência — `src/lib/route.ts`
- Em `generateWeekRoute`, substituir a seleção por cadência (`shouldVisit` +
  `isOverdue` + `OVERDUE_CAP_PER_WEEK`) por: **todos os clientes ativos com
  lat/lng** como candidatos.
- Manter os avisos existentes de "sem coordenadas" e "muito distantes" e o
  algoritmo de distribuição pelos dias dentro do expediente (o dia estoura →
  aviso, como hoje).
- `shouldVisit`/`isOverdue`/`weekMeta` ficam exportados mas sem uso interno
  (nenhum outro arquivo os importa — confirmado por busca).

### 2. Navegação de semanas — `src/pages/RotaSemanal.tsx`
- No cabeçalho da semana, além das setas já existentes, adicionar botões
  rápidos: **"Semana anterior"**, **"Esta semana"** e **"Próxima semana"**
  (`setWeekStart(addDays(weekStart, ∓7))` e `mondayOf(todayKey())`).
- O quadro continua mostrando só seg–sex (`settings.workingDays`), e cada dia
  tem o botão "Adicionar cliente" — já existente.

### 3. Prospecção
- **Migração** (`supabase_migration`): `clients.is_prospecao boolean NOT NULL
  DEFAULT false` (RLS preservada — validar com `supabase_get_table_schema`).
- **`src/lib/types.ts`**: campo `isProspecao: boolean` em `Client`.
- **`src/lib/DataContext.tsx`**:
  - `clientFromRow`/`clientToRow` mapeiam `is_prospecao ↔ isProspecao`.
  - `seedClients` seta `isProspecao: false`.
  - Nova função `createClient(c: Client)` (estado + `upsert` em `clients`
    quando o papel for coordenador).
- **`src/pages/Clientes.tsx`**: badge "Prospecção" junto ao nome quando
  `isProspecao`; Switch "Prospecção" no diálogo de edição.
- **`src/pages/RotaSemanal.tsx` (AddClientDialog)**: botão **"Nova prospecção"**
  que abre um formulário (reusar padrão do `EditClientDialog`) com os campos de
  um cliente comum: Nome (padrão "Prospecção"), Cidade, Endereço, Segmento,
  Cadência (`FREQ_OPTIONS`), Observações, Ativo e posição no mapa (opcional).
  Ao salvar: `createClient(...)` + `addRouteVisit(route, novoId, day)` + toast.

## Arquivos alterados
- `src/lib/route.ts` — seleção de candidatos na geração.
- `src/pages/RotaSemanal.tsx` — pager de semanas + criação de prospecção.
- `src/lib/types.ts` — campo `isProspecao`.
- `src/lib/DataContext.tsx` — mapeamento + `createClient`.
- `src/pages/Clientes.tsx` — badge e switch de prospecção.
- Migração SQL no Enter Cloud (coluna `is_prospecao`).

## Implementation checklist
- [ ] Migração adiciona `clients.is_prospecao` (default false); `supabase_get_table_schema` confirma coluna + políticas RLS intactas.
- [ ] `route.ts`: `generateWeekRoute` usa todos os clientes ativos com coordenadas (sem cadência), mantendo avisos de sem-coord/distante e distribuição seg–sex.
- [ ] `types.ts`: `Client.isProspecao: boolean`.
- [ ] `DataContext.tsx`: mapeia `is_prospecao` em `clientFromRow`/`clientToRow`; `seedClients` com `false`; exporta `createClient`.
- [ ] `RotaSemanal.tsx`: pager "Semana anterior / Esta semana / Próxima semana" funcional; quadro segue seg–sex.
- [ ] `RotaSemanal.tsx`: diálogo "Nova prospecção" cria o cliente e o adiciona ao dia da rota.
- [ ] `Clientes.tsx`: badge "Prospecção" + Switch no editar.
- [ ] `pnpm exec tsc --noEmit`, `pnpm lint` e `pnpm build` passam.

## Verification checklist
- [ ] **Positivo**: com clientes geocodificados, "Gerar rota" inclui todos os ativos distribuídos entre seg–sex; sábado/domingo não aparecem no quadro.
- [ ] **Positivo**: criar 2 prospecções (dias diferentes) → aparecem em Clientes com o badge e entram na rota do dia escolhido.
- [ ] **Padrão**: prospecção sem coordenadas é adicionada manualmente no dia (não depende de geocodificação).
- [ ] **Contorno**: navegar para semana anterior/próxima sem rota → estado vazio com botão "Gerar agora".
- [ ] **Negativo**: clientes inativos e clientes sem coordenadas ficam fora da geração (avisos mantidos).
- [ ] **Build**: `tsc --noEmit`, `lint`, `build` limpos.
