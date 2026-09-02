# App de Controle de Visitas e Rotas — Vendedor Externo (Região Sul)

## Contexto

O usuário é coordenador comercial de uma recicladora de gesso da construção civil e coordena um vendedor externo (que mora em Porto Alegre/RS e se desloca de carro, 07h–17h). Ele precisa de um app para:

1. **Planejar rotas semanais** de visitas, dia a dia, agrupando clientes próximos e priorizando os de maior volume mensal (que devem ser visitados mais de uma vez por mês).
2. **Comprovar a presença** do vendedor em cada visita (foto + confirmação de localização via GPS).
3. **Registrar o resultado** da visita: o que foi realizado e o que será feito na próxima visita ao mesmo cliente.

A base de clientes vem da planilha anexada, aba **CARTEIRA POA** (249 clientes do RS + alguns de SC, com endereço, cidade, segmento, status ativo e volumes mensais 2025/2026).

### Decisões acordadas com o usuário
- **Carteira:** apenas a do RS (aba CARTEIRA POA) — foco no vendedor externo.
- **Frequência:** automática por faixa de volume mensal (com ajuste manual).
- **Acesso:** login com papéis (coordenador e vendedor). *(Sem backend — versão local com seleção de perfil.)*
- **Rota:** geração automática (proximidade + prioridade de volume, respeitando 07h–17h) com ajuste manual (arrastar/reordenar/mover clientes entre dias).

---

## Arquitetura (versão local, sem backend)

- Dados persistidos em **localStorage** (estado único `rs-app-state.v1`) com **exportação/importação de backup em JSON** para transferência entre aparelhos.
- **Perfis** por seleção (Coordenador / Vendedor), sem senha.
- **Geocodificação** dos endereços via Nominatim (OpenStreetMap) em lote com 1,1 s entre chamadas; falhas recebem pin manual no mapa.
- **Mapa** Leaflet + OpenStreetMap; **drag & drop** com @dnd-kit.

### Arquivos criados
- `src/data/clientsRS.ts` — 249 clientes extraídos da planilha (seed).
- `src/lib/types.ts` — modelos (Client, Settings, RouteVisit, Visit, …).
- `src/lib/geo.ts` — Haversine, distâncias, horários, datas.
- `src/lib/route.ts` — gerador da rota semanal + schedule.
- `src/lib/DataContext.tsx` — estado global + persistência + geocodificação + CRUD.
- `src/lib/image.ts` — compressão de foto (base64 JPEG).
- `src/components/map/LeafletMap.tsx` — mapa com marcadores/polilinhas por dia.
- `src/components/layout/AppShell.tsx` — sidebar por papel.
- `src/components/visitas/VisitForm.tsx` — comprovação (GPS + foto + comentários).
- `src/pages/RoleSelect.tsx`, `Dashboard.tsx`, `Clientes.tsx`, `RotaSemanal.tsx`, `MinhaRota.tsx`, `Visitas.tsx`, `Backup.tsx`.
- `src/router.tsx`, `src/App.tsx`, `src/index.css` (design tokens verde-esmeralda).
- Dependências: `leaflet`, `react-leaflet`, `@dnd-kit/*`.

### Algoritmo da rota semanal
1. Candidatos da semana pela rotação de frequência (A=2x/mês semanas alternadas, B=1x/mês, C=1x a cada 2 meses; determinístico por id).
2. Clientes sem coordenadas e clientes muito distantes para dia único (> raio de ½ expediente) ficam de fora com aviso claro.
3. Processamento distante-primeiro, inserindo cada cliente no dia cujo último ponto é o mais próximo, desde que o custo (ida + visita + volta à base) caiba em 07h–17h.
4. Cada dia é reordenado por vizinho-mais-próximo a partir de POA; horários de chegada/saída calculados.

---

## Status de implementação

### Checklist de implementação
- [x] Extração da carteira (aba CARTEIRA POA) → `src/data/clientsRS.ts` (249 clientes).
- [x] Tipos, geolocalização e algoritmo de rota (`types.ts`, `geo.ts`, `route.ts`).
- [x] Estado global com localStorage, seed, backup export/import e geocodificação (Nominatim) (`DataContext.tsx`).
- [x] Mapa Leaflet com marcadores por dia e polilinhas (`LeafletMap.tsx`).
- [x] Layout com sidebar por papel e troca de perfil (`AppShell.tsx`).
- [x] Página Clientes: busca/filtros, frequência por cliente, geocodificar com progresso, edição com pin manual no mapa.
- [x] Página Rota Semanal: seletor de semana, gerar, quadro dia a dia com drag & drop, adicionar/remover visitas, publicar, mapa.
- [x] Página Minha Rota (vendedor): visitas do dia com horário, navegação (Google Maps) e fluxo de registro (GPS + foto + comentários + próxima ação), com alerta de "fora do raio".
- [x] Página Visitas: histórico com filtros (fora do raio / realizadas), foto, distância GPS e comentários.
- [x] Dashboard do coordenador: resumo semanal, cobertura, alertas.
- [x] Dados & backup: exportar/importar JSON, configurações da rota (horário, velocidade, prioridades, raio, dias úteis), reset.
- [x] Design system (tokens verde-esmeralda, claro/escuro) e responsividade.

### Checklist de verificação
- [x] `pnpm lint` e `pnpm exec tsc --noEmit` e `pnpm build` passam sem erros.
- [x] Algoritmo testado com a carteira real (simulando coordenadas por cidade): dias balanceados, todos terminam antes de 17h, clientes distantes isolados com aviso.
- [x] Tela de entrada, dashboard, clientes, rota, backup e visitas verificados por screenshot (desktop).
- [x] Fluxo mobile do vendedor verificado em `mobile_390` (sem problemas de layout).
- [ ] Verificação final pelo usuário: clicar "Geocodificar" (uma vez, ~4–5 min) e depois "Gerar rota da semana".
- [ ] Comprovação completa de visita (foto + GPS) requer dispositivo físico com câmera/localização (não testável por screenshot).
