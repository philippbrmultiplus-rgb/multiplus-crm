# App de Controle de Visitas e Rotas — Vendedor Externo (Região Sul)

## Contexto

O usuário é coordenador comercial de uma recicladora de gesso da construção civil e coordena um vendedor externo (que mora em Porto Alegre/RS e se desloca de carro, 07h–17h). Ele precisa de um app para:

1. **Planejar rotas semanais** de visitas, dia a dia, agrupando clientes próximos e priorizando os de maior volume mensal (que devem ser visitados mais de uma vez por mês).
2. **Comprovar a presença** do vendedor em cada visita (foto + confirmação de localização via GPS).
3. **Registrar o resultado** da visita: o que foi realizado e o que será feito na próxima visita ao mesmo cliente.

A base de clientes vem da planilha anexada, aba **CARTEIRA POA** (~250 clientes do RS + alguns de SC atendidos pela carteira, com endereço, cidade, segmento, status ativo e volumes mensais 2025/2026).

### Decisões acordadas com o usuário
- **Carteira:** apenas a do RS (aba CARTEIRA POA) — foco no vendedor externo.
- **Frequência:** automática por faixa de volume mensal (com ajuste manual).
- **Acesso:** login com papéis (coordenador e vendedor).
- **Rota:** geração automática (proximidade + prioridade de volume, respeitando 07h–17h) com ajuste manual (arrastar/reordenar/mover clientes entre dias).

---

## Arquitetura

Backend **Enter Cloud** (banco, auth, storage, funções de backend) + frontend React/Vite/Tailwind/shadcn.

### Banco de dados (tabelas)
- `profiles` — id (ref auth.users), full_name, role (`coordenador` | `vendedor`), created_at.
- `settings` — linha única: home_lat/home_lng (POA), work_start `07:00`, work_end `17:00`, visit_time_min (30), travel_speed_kmh (60), working_days [1..6], tier_a_threshold (100 t/mês), tier_b_threshold (20 t/mês), visit_radius_m (300).
- `clients` — name, segment, address, city, state, active, total_2025, total_2026, avg_monthly_2026 (= Total 2 / 5), tier (A/B/C), freq_month (2 / 1 / 0.5), lat, lng, geocode_status (`pendente`|`ok`|`falha`), obs.
- `weekly_routes` — week_start (segunda-feira), salesperson_id, status (`rascunho`|`publicada`|`encerrada`), created_by, notes.
- `route_visits` — route_id, client_id, day_of_week (1–6), position (ordem do dia), est_travel_min, est_visit_min, status (`pendente`|`concluida`|`nao_realizada`), coordinator_note. Unique (route_id, client_id).
- `visits` — route_visit_id (nullable), client_id, salesperson_id, visited_at (server), status (`realizada`|`nao_encontrado`|`recusada`), result_comments ("o que foi realizado"), next_actions ("próxima visita"), gps_lat, gps_lng, gps_accuracy_m, distance_from_client_m, within_radius, photo_url.

RLS: vendedor lê/grava apenas as próprias visitas e a rota atribuída a ele; coordenador lê/grava tudo. Bucket de storage público `visitas` para as fotos.

### Funções de backend (Enter Cloud / edge functions)
- `seed_clients` — upsert da carteira (payload = dados extraídos da planilha) e cálculo de média/tier/frequência; marca geocode como pendente.
- `geocode_batch` — processa em lotes (8/cliente por chamada, Nominatim, countrycodes=br) os clientes com geocode pendente; atualiza lat/lng/status; falhas ficam `falha` para ajuste manual no mapa.
- `generate_weekly_route` — gera a rota da semana (algoritmo abaixo) e grava `weekly_routes` + `route_visits`.

### Algoritmo da rota semanal
1. Candidatos da semana: clientes ativos conforme rotação da frequência (A = 2x/mês → semanas alternadas; B = 1x/mês → 1 semana por mês; C = 1x a cada 2 meses), usando determinismo por id para distribuir.
2. Agrupamento por proximidade (Haversine): clusters por cidade/região (POA-metrô, Serra, Litoral, Sul/Pelotas, Oeste/Santa Maria, SC).
3. Cada dia começa e termina em POA (base). Clusters ordenados por distância da base; cidades próximas compartilham o dia.
4. Dentro do cluster: ordenação vizinho-mais-próximo a partir de POA. Tempo = distância (linha reta × 1,3) / velocidade + tempo de visita. Se estourar 07h–17h, transborda para o próximo dia; avisa se faltarem dias.
5. Resultado: dia por dia com ordem, horários estimados e resumo (distância total, nº de visitas/dia).

---

## Frontend — páginas e componentes

- `src/lib/supabase.ts` (cliente), `src/lib/auth.tsx` (AuthProvider + useAuth), `src/lib/geo.ts` (haversine, formatação, validação de raio), `src/lib/types.ts`.
- `src/data/clientsRS.ts` — dados extraídos da aba CARTEIRA POA (seed).
- `src/components/map/LeafletMap.tsx` — mapa Leaflet + OSM (polilinhas da rota, marcadores por tier); `MapPin.tsx` — pin manual para geocode falho.
- `src/components/layout/AppShell.tsx` — sidebar shadcn + navegação.
- `src/components/rota/` — `DayColumn.tsx`, `RouteClientCard.tsx`, `RouteBoard.tsx` (drag & drop com @dnd-kit).
- `src/components/visitas/VisitForm.tsx` — fluxo do vendedor: captura GPS + foto + comentários + validação de raio.
- Páginas: `Login`, `Dashboard` (coordenador: resumo da semana, cobertura, alertas de raio), `Clientes` (busca/filtros, mapa, pin manual, frequência/tier editáveis, botão geocodificar), `RotaSemanal` (seletor de semana → gerar → quadro de dias com ajuste manual → publicar → mapa), `MinhaRota` (vendedor: visitas de hoje em ordem, "Navegar" p/ Google Maps, fluxo de confirmação), `Visitas` (histórico com fotos, GPS, distância, comentários), `Equipe` (coordenador cria contas de vendedor).
- Rotas no `src/router.tsx`; proteção por papel.

### Design
Tokens no `index.css`/`tailwind.config.ts` com paleta verde-esmeralda (reciclagem) + neutros, tema claro/escuro; layout responsivo (vendedor usa celular). Novas dependências: `leaflet`, `react-leaflet`, `@types/leaflet`, `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`.

---

## Implementação (ordem de execução)

### Checklist de implementação
- [ ] Habilitar Enter Cloud (`supabase_enable`) e carregar skill `enter_cloud`.
- [ ] Criar SQL: tabelas (`profiles`, `settings`, `clients`, `weekly_routes`, `route_visits`, `visits`) + triggers de perfil no signup + RLS + bucket `visitas`.
- [ ] Extrair a aba CARTEIRA POA da planilha para `src/data/clientsRS.ts` (campos: nome, segmento, endereço, cidade, estado, ativo, total 2025, total 2026; média 2026 = Total2/5).
- [ ] Criar funções de backend `seed_clients`, `geocode_batch` (Nominatim em lotes) e `generate_weekly_route` (algoritmo acima).
- [ ] Base frontend: cliente Supabase, AuthProvider, página de Login, AppShell/sidebar, rotas protegidas.
- [ ] Página Clientes: lista com busca/filtros (cidade, tier, ativo), edição de frequência/tier, botão "Geocodificar", pin manual no mapa para falhas.
- [ ] Página RotaSemanal: seletor de semana, "Gerar rota", quadro dia a dia (seg–sáb) com drag & drop, validação 07h–17h, publicar, visualização em mapa.
- [ ] Página MinhaRota (vendedor): visitas de hoje em ordem com link de navegação e fluxo de confirmação (GPS + raio ≤ 300 m + foto obrigatória + comentários + próxima ação), com fallback "fora do raio" justificado.
- [ ] Página Visitas: histórico filtrado com fotos, distância GPS e comentários.
- [ ] Dashboard do coordenador: resumo semanal, cobertura, alertas de raio; página Equipe (criar vendedor).
- [ ] Design system (tokens/cores), revisão dark/light, responsividade.

## Verificação

### Checklist de verificação
- [ ] `pnpm lint` e `pnpm exec tsc --noEmit` e `pnpm build` passam sem erros.
- [ ] Fluxo: signup do coordenador → seed da carteira → geocodificar (clientes com coordenadas ok; falhas recebem pin manual) → gerar rota da semana → rota respeita 07h–17h e ordena por proximidade.
- [ ] Ajuste manual: mover/reordenar clientes entre dias persiste e a publicar atualiza o vendedor.
- [ ] Vendedor: vê a rota do dia, confirma presença com GPS + foto; visita salva com distância calculada e raio validado.
- [ ] Alertas: visita fora do raio (distância > 300 m) registrada como "fora do raio" e destacada no dashboard.
- [ ] Papéis: vendedor não acessa páginas de coordenador; rotas protegidas por auth.
- [ ] Responsividade: fluxo do vendedor verificado em `mobile_390` e coordenador em `desktop_1280` (screenshot).
