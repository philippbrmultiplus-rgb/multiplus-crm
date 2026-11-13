-- =====================================================================
-- Multiplus — estrutura completa do banco (modelo atual do Paulínia)
-- ---------------------------------------------------------------------
-- Rode este arquivo no projeto da nova unidade, ANTES do primeiro login.
-- Cria tabelas que faltam, colunas (inclui toneladas, bairro, email,
-- telefone, representante, base de atendimento e nome da unidade),
-- funções, gatilhos, índices e políticas. Não apaga nem altera dados.
-- =====================================================================

begin;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role text not null default 'vendedor' check (role in ('coordenador','vendedor')),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_role text;
begin
  select case when not exists (select 1 from public.profiles) then 'coordenador' else 'vendedor' end
  into v_role;
  insert into public.profiles (id, full_name, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', split_part(coalesce(new.email,''),'@',1)), v_role)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.is_coordenador()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'coordenador');
$$;

create or replace function public.current_role()
returns text language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid();
$$;

drop policy if exists profiles_select on public.profiles;
create policy "profiles_select" on public.profiles for select to authenticated using (true);

drop policy if exists profiles_update_own on public.profiles;
create policy "profiles_update_own" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

create table if not exists public.clients (
  id text primary key,
  name text not null,
  segment text,
  address text,
  city text,
  state text default 'RS',
  active boolean default true,
  total_2025 numeric default 0,
  total_2026 numeric default 0,
  avg_monthly numeric default 0,
  tier text,
  freq_month numeric default 0.5,
  lat double precision,
  lng double precision,
  geocode_status text default 'pendente',
  obs text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.clients enable row level security;

drop policy if exists clients_select on public.clients;
create policy "clients_select" on public.clients for select to authenticated using (true);

drop policy if exists clients_insert_coord on public.clients;
create policy "clients_insert_coord" on public.clients for insert to authenticated with check (public.is_coordenador());

drop policy if exists clients_update_coord on public.clients;
create policy "clients_update_coord" on public.clients for update to authenticated using (public.is_coordenador()) with check (public.is_coordenador());

drop policy if exists clients_delete_coord on public.clients;
create policy "clients_delete_coord" on public.clients for delete to authenticated using (public.is_coordenador());

create table if not exists public.settings (
  id int primary key default 1 check (id = 1),
  home_lat double precision default -30.0346,
  home_lng double precision default -51.2177,
  work_start text default '07:00',
  work_end text default '17:00',
  visit_time_min int default 30,
  travel_speed_kmh int default 75,
  working_days int[] default array[1,2,3,4,5,6],
  tier_a_threshold numeric default 100,
  tier_b_threshold numeric default 20,
  visit_radius_m int default 300,
  updated_at timestamptz not null default now()
);

alter table public.settings enable row level security;

drop policy if exists settings_select on public.settings;
create policy "settings_select" on public.settings for select to authenticated using (true);

drop policy if exists settings_write on public.settings;
create policy "settings_write" on public.settings for insert to authenticated with check (public.is_coordenador());

drop policy if exists settings_update on public.settings;
create policy "settings_update" on public.settings for update to authenticated using (public.is_coordenador()) with check (public.is_coordenador());

create table if not exists public.weekly_routes (
  id text primary key,
  week_start date not null,
  status text default 'rascunho',
  generated_at timestamptz not null default now(),
  notes text,
  created_by uuid references public.profiles(id)
);

alter table public.weekly_routes enable row level security;

drop policy if exists routes_select on public.weekly_routes;
create policy "routes_select" on public.weekly_routes for select to authenticated using (true);

drop policy if exists routes_write on public.weekly_routes;
create policy "routes_write" on public.weekly_routes for insert to authenticated with check (public.is_coordenador());

drop policy if exists routes_update on public.weekly_routes;
create policy "routes_update" on public.weekly_routes for update to authenticated using (public.is_coordenador()) with check (public.is_coordenador());

drop policy if exists routes_delete on public.weekly_routes;
create policy "routes_delete" on public.weekly_routes for delete to authenticated using (public.is_coordenador());

create table if not exists public.route_visits (
  id text primary key,
  route_id text references public.weekly_routes(id) on delete cascade,
  client_id text references public.clients(id) on delete cascade,
  day int,
  position int,
  est_travel_min int default 0,
  est_visit_min int default 30,
  status text default 'pendente'
);

alter table public.route_visits enable row level security;

drop policy if exists rv_select on public.route_visits;
create policy "rv_select" on public.route_visits for select to authenticated using (true);

drop policy if exists rv_write on public.route_visits;
create policy "rv_write" on public.route_visits for insert to authenticated with check (public.is_coordenador());

drop policy if exists rv_update on public.route_visits;
create policy "rv_update" on public.route_visits for update to authenticated using (public.is_coordenador()) with check (public.is_coordenador());

drop policy if exists rv_delete on public.route_visits;
create policy "rv_delete" on public.route_visits for delete to authenticated using (public.is_coordenador());

create table if not exists public.visits (
  id text primary key,
  route_visit_id text references public.route_visits(id) on delete set null,
  client_id text references public.clients(id) on delete cascade,
  visited_at timestamptz not null default now(),
  status text,
  result_comments text,
  next_actions text,
  gps_lat double precision,
  gps_lng double precision,
  gps_accuracy_m int,
  distance_from_client_m numeric,
  within_radius boolean,
  photo_url text,
  created_by uuid references public.profiles(id) default auth.uid(),
  created_at timestamptz not null default now()
);

alter table public.visits enable row level security;

drop policy if exists visits_select on public.visits;
create policy "visits_select" on public.visits for select to authenticated using (true);

drop policy if exists visits_insert on public.visits;
create policy "visits_insert" on public.visits for insert to authenticated with check (true);

drop policy if exists visits_update on public.visits;
create policy "visits_update" on public.visits for update to authenticated using (auth.uid() = created_by or public.is_coordenador()) with check (true);

drop policy if exists visits_delete on public.visits;
create policy "visits_delete" on public.visits for delete to authenticated using (auth.uid() = created_by or public.is_coordenador());

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'visits') then
    alter publication supabase_realtime add table public.visits;
  end if;
end $$;

drop policy if exists visitas_public_read on storage.objects;
create policy "visitas_public_read" on storage.objects for select using (bucket_id = 'visitas');

drop policy if exists visitas_auth_upload on storage.objects;
create policy "visitas_auth_upload" on storage.objects for insert to authenticated with check (bucket_id = 'visitas');

alter table public.clients add column if not exists last_collect_at date;

alter table public.settings add column if not exists cadence_version int not null default 0;

ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS last_visit_at date;

COMMENT ON COLUMN public.clients.last_visit_at IS 'Data (dd) da ultima visita com status "realizada" registrada pelo vendedor; alimenta o contador de dias sem visita.';

CREATE OR REPLACE FUNCTION public.set_client_last_visit_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'realizada' AND NEW.client_id IS NOT NULL THEN
    UPDATE public.clients
       SET last_visit_at = (NEW.visited_at AT TIME ZONE 'America/Sao_Paulo')::date,
           updated_at = now()
     WHERE id = NEW.client_id
       AND (last_visit_at IS NULL
            OR last_visit_at < (NEW.visited_at AT TIME ZONE 'America/Sao_Paulo')::date);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_client_last_visit_at ON public.visits;

CREATE TRIGGER trg_set_client_last_visit_at
  AFTER INSERT ON public.visits
  FOR EACH ROW
  EXECUTE FUNCTION public.set_client_last_visit_at();

ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS is_prospecao boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.clients.is_prospecao IS 'Cliente marcado como prospecção (novo cliente em negociação).';

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'clients') then
    alter publication supabase_realtime add table "clients";
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'weekly_routes') then
    alter publication supabase_realtime add table "weekly_routes";
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'route_visits') then
    alter publication supabase_realtime add table "route_visits";
  end if;
end $$;

drop policy if exists visits_delete_coord on public.visits;
CREATE POLICY "visits_delete_coord" ON public.visits
  FOR DELETE USING (is_coordenador());

drop policy if exists rv_update_any on public.route_visits;
CREATE POLICY "rv_update_any" ON public.route_visits
  FOR UPDATE USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS contato text;

COMMENT ON COLUMN public.clients.contato IS 'Telefone/whatsapp de contato do cliente.';

drop policy if exists clients_insert_prospect on public.clients;
CREATE POLICY "clients_insert_prospect" ON public.clients
  FOR INSERT WITH CHECK (is_prospecao = true);

drop policy if exists rv_write_prospect on public.route_visits;
CREATE POLICY "rv_write_prospect" ON public.route_visits
  FOR INSERT WITH CHECK (exists (select 1 from public.clients c where c.id = client_id and c.is_prospecao = true));

CREATE UNIQUE INDEX IF NOT EXISTS visits_one_notdone ON public.visits (route_visit_id) WHERE status = 'nao_realizada' AND route_visit_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.sync_route_visit_not_done()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'nao_realizada' AND (OLD.status IS DISTINCT FROM 'nao_realizada') THEN
    BEGIN
      INSERT INTO public.visits (id, client_id, route_visit_id, visited_at, status, result_comments, next_actions, within_radius)
      VALUES (
        concat('v-', floor(extract(epoch from clock_timestamp()) * 1000)::bigint::text, '-', substr(md5(random()::text), 1, 6)),
        NEW.client_id,
        NEW.id,
        now(),
        'nao_realizada',
        '',
        '',
        true
      );
    EXCEPTION WHEN unique_violation THEN
      NULL; 
    END;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_route_visit_not_done ON public.route_visits;

CREATE TRIGGER trg_sync_route_visit_not_done
  AFTER UPDATE OF status ON public.route_visits
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_route_visit_not_done();

CREATE TABLE IF NOT EXISTS public.clientes_excluidos (
  id text NOT NULL,
  name text NOT NULL,
  deleted_at timestamptz NOT NULL DEFAULT now(),
  deleted_by uuid,
  last_collect_at date,
  last_visit_at date,
  CONSTRAINT clientes_excluidos_pkey PRIMARY KEY (id)
);

ALTER TABLE public.clientes_excluidos ENABLE ROW LEVEL SECURITY;

drop policy if exists ce_insert_coord on public.clientes_excluidos;
CREATE POLICY "ce_insert_coord" ON public.clientes_excluidos
  FOR INSERT WITH CHECK (is_coordenador());

drop policy if exists ce_select on public.clientes_excluidos;
CREATE POLICY "ce_select" ON public.clientes_excluidos
  FOR SELECT USING (true);

drop policy if exists ce_delete_coord on public.clientes_excluidos;
CREATE POLICY "ce_delete_coord" ON public.clientes_excluidos
  FOR DELETE USING (is_coordenador());

ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS responsavel text;

ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS prospeccao_status text;

COMMENT ON COLUMN public.clients.responsavel IS 'Nome do responsável do cliente (contato principal).';

COMMENT ON COLUMN public.clients.prospeccao_status IS 'Status da prospecção: em_negociacao | fechado | perdido.';

drop policy if exists clients_update_prospect on public.clients;
CREATE POLICY "clients_update_prospect" ON public.clients
  FOR UPDATE USING (is_prospecao = true) WITH CHECK (is_prospecao = true);

ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS prospeccao_justificativa text;

COMMENT ON COLUMN public.clients.prospeccao_justificativa IS 'Justificativa escrita quando a prospecção é marcada como perdida.';

drop policy if exists rv_write_vendor on public.route_visits;
CREATE POLICY "rv_write_vendor" ON public.route_visits
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

ALTER TABLE public.visits DROP CONSTRAINT IF EXISTS visits_route_visit_id_fkey;

ALTER TABLE public.visits
  ADD CONSTRAINT visits_route_visit_id_fkey
  FOREIGN KEY (route_visit_id) REFERENCES public.route_visits(id) ON DELETE SET NULL;

ALTER TABLE public.visits ADD COLUMN IF NOT EXISTS photos jsonb;

COMMENT ON COLUMN public.visits.photos IS 'Lista de URLs públicas das fotos de comprovação (a primeira também fica em photo_url).';

CREATE TABLE IF NOT EXISTS public.coletas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id text NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  collect_date date NOT NULL,
  note text,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT coletas_unique UNIQUE (client_id, collect_date)
);

CREATE INDEX IF NOT EXISTS coletas_client_idx ON public.coletas (client_id, collect_date DESC);

ALTER TABLE public.coletas ENABLE ROW LEVEL SECURITY;

drop policy if exists coletas_select on public.coletas;
CREATE POLICY "coletas_select" ON public.coletas FOR SELECT USING (true);

drop policy if exists coletas_insert on public.coletas;
CREATE POLICY "coletas_insert" ON public.coletas FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

drop policy if exists coletas_delete on public.coletas;
CREATE POLICY "coletas_delete" ON public.coletas FOR DELETE USING (is_coordenador());

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role = ANY (ARRAY['coordenador'::text, 'vendedor'::text, 'gerente'::text]));

drop policy if exists profiles_update_coord on public.profiles;
CREATE POLICY "profiles_update_coord" ON public.profiles
  FOR UPDATE USING (is_coordenador()) WITH CHECK (is_coordenador());

ALTER TABLE public.visits ADD COLUMN IF NOT EXISTS alerta boolean NOT NULL DEFAULT false;

ALTER TABLE public.visits ADD COLUMN IF NOT EXISTS alerta_motivo text;

COMMENT ON COLUMN public.visits.alerta IS 'Visita marcada pelo vendedor com alerta para o coordenador.';

COMMENT ON COLUMN public.visits.alerta_motivo IS 'Motivo do alerta informado pelo vendedor.';

ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS geo_aproximado boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.clients.geo_aproximado IS 'Coordenada aproximada (obtida pela cidade), não pelo endereço exato.';

SET LOCAL role authenticated;

SELECT set_config('request.jwt.claims', '{"sub":"8e34883d-e19e-410f-9b6d-06aa488cbe87","role":"authenticated"}', true);

SELECT city FROM public.clients WHERE id = 'teste-rls-coord';

ROLLBACK;

COMMENT ON COLUMN public.clients.prospeccao_status IS 'Status da prospecção: em_negociacao | fechado | proposta_recusada.';

create table if not exists public.client_alerts (
  id text primary key default gen_random_uuid()::text,
  client_id text not null references public.clients(id) on delete cascade,
  motivo text not null,
  created_by uuid,
  created_by_name text,
  created_at timestamptz not null default now()
);

create index if not exists client_alerts_created_at_idx on public.client_alerts (created_at desc);

create index if not exists client_alerts_client_id_idx on public.client_alerts (client_id);

grant select, insert, delete on public.client_alerts to authenticated;

alter table public.client_alerts enable row level security;

drop policy if exists ca_select on public.client_alerts;
create policy ca_select on public.client_alerts for select to authenticated using (true);

drop policy if exists ca_insert on public.client_alerts;
create policy ca_insert on public.client_alerts for insert to authenticated
with check (
  created_by = auth.uid()
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('coordenador', 'vendedor')
  )
);

drop policy if exists ca_delete on public.client_alerts;
create policy ca_delete on public.client_alerts for delete to authenticated
using (created_by = auth.uid() or public.is_coordenador());

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'client_alerts') then
    alter publication supabase_realtime add table public.client_alerts;
  end if;
end $$;

alter table public.client_alerts add column if not exists photo_url text;

create table if not exists public.route_activities (
  id text primary key default gen_random_uuid()::text,
  week_start date not null,
  day int not null,
  titulo text not null,
  obs text,
  duration_min int not null default 0,
  created_by uuid,
  created_by_name text,
  created_at timestamptz not null default now()
);

create index if not exists route_activities_week_idx on public.route_activities (week_start, day);

grant select, insert, delete on public.route_activities to authenticated;

alter table public.route_activities enable row level security;

drop policy if exists ra_select on public.route_activities;
create policy ra_select on public.route_activities for select to authenticated using (true);

drop policy if exists ra_insert on public.route_activities;
create policy ra_insert on public.route_activities for insert to authenticated
with check (
  created_by = auth.uid()
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('coordenador', 'vendedor')
  )
);

drop policy if exists ra_delete on public.route_activities;
create policy ra_delete on public.route_activities for delete to authenticated
using (created_by = auth.uid() or public.is_coordenador());

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'route_activities') then
    alter publication supabase_realtime add table public.route_activities;
  end if;
end $$;

create table if not exists public.client_monthly_volumes (
  id text primary key default gen_random_uuid()::text,
  client_id text not null references public.clients(id) on delete cascade,
  month date not null,
  volume_m3 numeric not null default 0,
  created_at timestamptz not null default now(),
  unique (client_id, month)
);

create index if not exists client_monthly_volumes_month_idx on public.client_monthly_volumes (month);

grant select on public.client_monthly_volumes to authenticated;

alter table public.client_monthly_volumes enable row level security;

drop policy if exists cmv_select on public.client_monthly_volumes;
create policy cmv_select on public.client_monthly_volumes for select to authenticated using (true);

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'client_monthly_volumes') then
    alter publication supabase_realtime add table public.client_monthly_volumes;
  end if;
end $$;

alter table public.client_monthly_volumes add column if not exists label text;

alter table public.client_monthly_volumes alter column client_id drop not null;

create unique index if not exists client_monthly_volumes_label_month_key on public.client_monthly_volumes (label, month) where client_id is null;

alter table public.coletas add column if not exists volume_m3 numeric;

alter table public.coletas add column if not exists trocas integer not null default 1;

drop policy if exists coletas_update on public.coletas;
create policy coletas_update on public.coletas for update to authenticated
using (public.is_coordenador()) with check (public.is_coordenador());

create table if not exists public.client_cadence (
  id text primary key default gen_random_uuid()::text,
  client_id text references public.clients(id) on delete cascade,
  nome_planilha text not null,
  media_dias numeric,
  coletas integer not null default 0,
  ultima_coleta date,
  atualizado_em timestamptz not null default now(),
  unique (nome_planilha)
);

grant select on public.client_cadence to authenticated;

alter table public.client_cadence enable row level security;

drop policy if exists cc_select on public.client_cadence;
create policy cc_select on public.client_cadence for select to authenticated using (true);

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'client_cadence') then
    alter publication supabase_realtime add table public.client_cadence;
  end if;
end $$;

alter table public.client_cadence add column if not exists datas date[];

alter table public.clients add column if not exists segmento_comercial text;

alter table public.visits add column if not exists tipo_contato text;

comment on column public.visits.tipo_contato is 'presencial (vazio/null) ou telefone — contato feito por telefone com o cliente';

create table if not exists public.internal_prospects (
  id text primary key default gen_random_uuid()::text,
  nome text not null,
  cidade text,
  endereco text,
  contato text,
  telefone text,
  segmento_comercial text,
  segmento_logistico text,
  observacoes text,
  created_by uuid,
  created_by_name text,
  created_at timestamptz not null default now()
);

grant select, insert, delete on public.internal_prospects to authenticated;

alter table public.internal_prospects enable row level security;

drop policy if exists ip_select on public.internal_prospects;
create policy ip_select on public.internal_prospects for select to authenticated using (true);

drop policy if exists ip_insert on public.internal_prospects;
create policy ip_insert on public.internal_prospects for insert to authenticated
with check (
  created_by = auth.uid()
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('coordenador', 'vendedor')
  )
);

drop policy if exists ip_delete on public.internal_prospects;
create policy ip_delete on public.internal_prospects for delete to authenticated
using (created_by = auth.uid() or public.is_coordenador());

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'internal_prospects') then
    alter publication supabase_realtime add table public.internal_prospects;
  end if;
end $$;

create table if not exists public.internal_prospect_notes (
  id text primary key default gen_random_uuid()::text,
  prospect_id text not null references public.internal_prospects(id) on delete cascade,
  texto text not null,
  created_by uuid,
  created_by_name text,
  created_at timestamptz not null default now()
);

create index if not exists internal_prospect_notes_prospect_idx on public.internal_prospect_notes (prospect_id, created_at);

grant select, insert, delete on public.internal_prospect_notes to authenticated;

alter table public.internal_prospect_notes enable row level security;

drop policy if exists ipn_select on public.internal_prospect_notes;
create policy ipn_select on public.internal_prospect_notes for select to authenticated using (true);

drop policy if exists ipn_insert on public.internal_prospect_notes;
create policy ipn_insert on public.internal_prospect_notes for insert to authenticated
with check (
  created_by = auth.uid()
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('coordenador', 'vendedor')
  )
);

drop policy if exists ipn_delete on public.internal_prospect_notes;
create policy ipn_delete on public.internal_prospect_notes for delete to authenticated
using (created_by = auth.uid() or public.is_coordenador());

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'internal_prospect_notes') then
    alter publication supabase_realtime add table public.internal_prospect_notes;
  end if;
end $$;

alter table public.internal_prospects add column if not exists visita_agendada date;

grant update on public.internal_prospects to authenticated;

drop policy if exists ip_update on public.internal_prospects;
create policy ip_update on public.internal_prospects for update to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('coordenador', 'vendedor')
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('coordenador', 'vendedor')
  )
);

alter table public.clients add column if not exists visita_agendada date;

comment on column public.clients.visita_agendada is 'data (yyyy-mm-dd) agendada para visitar o cliente (prospecção)';

create table if not exists public.client_prospect_notes (
  id text primary key default gen_random_uuid()::text,
  client_id text not null references public.clients(id) on delete cascade,
  texto text not null,
  created_by uuid,
  created_by_name text,
  created_at timestamptz not null default now()
);

create index if not exists client_prospect_notes_client_idx on public.client_prospect_notes (client_id, created_at);

grant select, insert, delete on public.client_prospect_notes to authenticated;

alter table public.client_prospect_notes enable row level security;

drop policy if exists cpn_select on public.client_prospect_notes;
create policy cpn_select on public.client_prospect_notes for select to authenticated using (true);

drop policy if exists cpn_insert on public.client_prospect_notes;
create policy cpn_insert on public.client_prospect_notes for insert to authenticated
with check (
  created_by = auth.uid()
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('coordenador', 'vendedor')
  )
);

drop policy if exists cpn_delete on public.client_prospect_notes;
create policy cpn_delete on public.client_prospect_notes for delete to authenticated
using (created_by = auth.uid() or public.is_coordenador());

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'client_prospect_notes') then
    alter publication supabase_realtime add table public.client_prospect_notes;
  end if;
end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role text not null default 'vendedor' check (role in ('coordenador','vendedor')),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_role text;
begin
  select case when not exists (select 1 from public.profiles) then 'coordenador' else 'vendedor' end
  into v_role;
  insert into public.profiles (id, full_name, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', split_part(coalesce(new.email,''),'@',1)), v_role)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.is_coordenador()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'coordenador');
$$;

create or replace function public.current_role()
returns text language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid();
$$;

drop policy if exists profiles_select on public.profiles;
create policy "profiles_select" on public.profiles for select to authenticated using (true);

drop policy if exists profiles_update_own on public.profiles;
create policy "profiles_update_own" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

create table if not exists public.clients (
  id text primary key,
  name text not null,
  segment text,
  address text,
  city text,
  state text default 'SP',
  active boolean default true,
  total_2025 numeric default 0,
  total_2026 numeric default 0,
  avg_monthly numeric default 0,
  tier text,
  freq_month numeric default 0.5,
  lat double precision,
  lng double precision,
  geocode_status text default 'pendente',
  obs text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.clients enable row level security;

drop policy if exists clients_select on public.clients;
create policy "clients_select" on public.clients for select to authenticated using (true);

drop policy if exists clients_insert_coord on public.clients;
create policy "clients_insert_coord" on public.clients for insert to authenticated with check (public.is_coordenador());

drop policy if exists clients_update_coord on public.clients;
create policy "clients_update_coord" on public.clients for update to authenticated using (public.is_coordenador()) with check (public.is_coordenador());

drop policy if exists clients_delete_coord on public.clients;
create policy "clients_delete_coord" on public.clients for delete to authenticated using (public.is_coordenador());

create table if not exists public.settings (
  id int primary key default 1 check (id = 1),
  home_lat double precision default -22.7617,
  home_lng double precision default -47.1542,
  work_start text default '07:00',
  work_end text default '17:00',
  visit_time_min int default 30,
  travel_speed_kmh int default 75,
  working_days int[] default array[1,2,3,4,5],
  tier_a_threshold numeric default 100,
  tier_b_threshold numeric default 20,
  visit_radius_m int default 300,
  updated_at timestamptz not null default now()
);

alter table public.settings enable row level security;

drop policy if exists settings_select on public.settings;
create policy "settings_select" on public.settings for select to authenticated using (true);

drop policy if exists settings_write on public.settings;
create policy "settings_write" on public.settings for insert to authenticated with check (public.is_coordenador());

drop policy if exists settings_update on public.settings;
create policy "settings_update" on public.settings for update to authenticated using (public.is_coordenador()) with check (public.is_coordenador());

create table if not exists public.weekly_routes (
  id text primary key,
  week_start date not null,
  status text default 'rascunho',
  generated_at timestamptz not null default now(),
  notes text,
  created_by uuid references public.profiles(id)
);

alter table public.weekly_routes enable row level security;

drop policy if exists routes_select on public.weekly_routes;
create policy "routes_select" on public.weekly_routes for select to authenticated using (true);

drop policy if exists routes_write on public.weekly_routes;
create policy "routes_write" on public.weekly_routes for insert to authenticated with check (public.is_coordenador());

drop policy if exists routes_update on public.weekly_routes;
create policy "routes_update" on public.weekly_routes for update to authenticated using (public.is_coordenador()) with check (public.is_coordenador());

drop policy if exists routes_delete on public.weekly_routes;
create policy "routes_delete" on public.weekly_routes for delete to authenticated using (public.is_coordenador());

create table if not exists public.route_visits (
  id text primary key,
  route_id text references public.weekly_routes(id) on delete cascade,
  client_id text references public.clients(id) on delete cascade,
  day int,
  position int,
  est_travel_min int default 0,
  est_visit_min int default 30,
  status text default 'pendente'
);

alter table public.route_visits enable row level security;

drop policy if exists rv_select on public.route_visits;
create policy "rv_select" on public.route_visits for select to authenticated using (true);

drop policy if exists rv_write on public.route_visits;
create policy "rv_write" on public.route_visits for insert to authenticated with check (public.is_coordenador());

drop policy if exists rv_update on public.route_visits;
create policy "rv_update" on public.route_visits for update to authenticated using (public.is_coordenador()) with check (public.is_coordenador());

drop policy if exists rv_delete on public.route_visits;
create policy "rv_delete" on public.route_visits for delete to authenticated using (public.is_coordenador());

create table if not exists public.visits (
  id text primary key,
  route_visit_id text references public.route_visits(id) on delete set null,
  client_id text references public.clients(id) on delete cascade,
  visited_at timestamptz not null default now(),
  status text,
  result_comments text,
  next_actions text,
  gps_lat double precision,
  gps_lng double precision,
  gps_accuracy_m int,
  distance_from_client_m numeric,
  within_radius boolean,
  photo_url text,
  created_by uuid references public.profiles(id) default auth.uid(),
  created_at timestamptz not null default now()
);

alter table public.visits enable row level security;

drop policy if exists visits_select on public.visits;
create policy "visits_select" on public.visits for select to authenticated using (true);

drop policy if exists visits_insert on public.visits;
create policy "visits_insert" on public.visits for insert to authenticated with check (true);

drop policy if exists visits_update on public.visits;
create policy "visits_update" on public.visits for update to authenticated using (auth.uid() = created_by or public.is_coordenador()) with check (true);

drop policy if exists visits_delete on public.visits;
create policy "visits_delete" on public.visits for delete to authenticated using (auth.uid() = created_by or public.is_coordenador());

drop policy if exists visitas_public_read on storage.objects;
create policy "visitas_public_read" on storage.objects for select using (bucket_id = 'visitas');

drop policy if exists visitas_auth_upload on storage.objects;
create policy "visitas_auth_upload" on storage.objects for insert to authenticated with check (bucket_id = 'visitas');

alter table public.clients add column if not exists last_collect_at date;

alter table public.settings add column if not exists cadence_version int not null default 0;

alter table public.clients add column if not exists last_visit_at date;

CREATE OR REPLACE FUNCTION public.set_client_last_visit_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'realizada' AND NEW.client_id IS NOT NULL THEN
    UPDATE public.clients
       SET last_visit_at = (NEW.visited_at AT TIME ZONE 'America/Sao_Paulo')::date,
           updated_at = now()
     WHERE id = NEW.client_id
       AND (last_visit_at IS NULL
            OR last_visit_at < (NEW.visited_at AT TIME ZONE 'America/Sao_Paulo')::date);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_client_last_visit_at ON public.visits;

CREATE TRIGGER trg_set_client_last_visit_at
  AFTER INSERT ON public.visits
  FOR EACH ROW
  EXECUTE FUNCTION public.set_client_last_visit_at();

alter table public.clients add column if not exists is_prospecao boolean not null default false;

drop policy if exists visits_delete_coord on public.visits;
CREATE POLICY "visits_delete_coord" ON public.visits
  FOR DELETE USING (is_coordenador());

drop policy if exists rv_update_any on public.route_visits;
CREATE POLICY "rv_update_any" ON public.route_visits
  FOR UPDATE USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

alter table public.clients add column if not exists contato text;

drop policy if exists clients_insert_prospect on public.clients;
CREATE POLICY "clients_insert_prospect" ON public.clients
  FOR INSERT WITH CHECK (is_prospecao = true);

drop policy if exists rv_write_prospect on public.route_visits;
CREATE POLICY "rv_write_prospect" ON public.route_visits
  FOR INSERT WITH CHECK (exists (select 1 from public.clients c where c.id = client_id and c.is_prospecao = true));

CREATE UNIQUE INDEX IF NOT EXISTS visits_one_notdone ON public.visits (route_visit_id) WHERE status = 'nao_realizada' AND route_visit_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.sync_route_visit_not_done()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'nao_realizada' AND (OLD.status IS DISTINCT FROM 'nao_realizada') THEN
    BEGIN
      INSERT INTO public.visits (id, client_id, route_visit_id, visited_at, status, result_comments, next_actions, within_radius)
      VALUES (
        concat('v-', floor(extract(epoch from clock_timestamp()) * 1000)::bigint::text, '-', substr(md5(random()::text), 1, 6)),
        NEW.client_id,
        NEW.id,
        now(),
        'nao_realizada',
        '',
        '',
        true
      );
    EXCEPTION WHEN unique_violation THEN
      NULL;
    END;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_route_visit_not_done ON public.route_visits;

CREATE TRIGGER trg_sync_route_visit_not_done
  AFTER UPDATE OF status ON public.route_visits
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_route_visit_not_done();

CREATE TABLE IF NOT EXISTS public.clientes_excluidos (
  id text NOT NULL,
  name text NOT NULL,
  deleted_at timestamptz NOT NULL DEFAULT now(),
  deleted_by uuid,
  last_collect_at date,
  last_visit_at date,
  CONSTRAINT clientes_excluidos_pkey PRIMARY KEY (id)
);

ALTER TABLE public.clientes_excluidos ENABLE ROW LEVEL SECURITY;

drop policy if exists ce_insert_coord on public.clientes_excluidos;
CREATE POLICY "ce_insert_coord" ON public.clientes_excluidos
  FOR INSERT WITH CHECK (is_coordenador());

drop policy if exists ce_select on public.clientes_excluidos;
CREATE POLICY "ce_select" ON public.clientes_excluidos
  FOR SELECT USING (true);

drop policy if exists ce_delete_coord on public.clientes_excluidos;
CREATE POLICY "ce_delete_coord" ON public.clientes_excluidos
  FOR DELETE USING (is_coordenador());

alter table public.clients add column if not exists responsavel text;

alter table public.clients add column if not exists prospeccao_status text;

drop policy if exists clients_update_prospect on public.clients;
CREATE POLICY "clients_update_prospect" ON public.clients
  FOR UPDATE USING (is_prospecao = true) WITH CHECK (is_prospecao = true);

alter table public.clients add column if not exists prospeccao_justificativa text;

drop policy if exists rv_write_vendor on public.route_visits;
CREATE POLICY "rv_write_vendor" ON public.route_visits
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

alter table public.visits drop constraint if exists visits_route_visit_id_fkey;

alter table public.visits
  add constraint visits_route_visit_id_fkey
  foreign key (route_visit_id) references public.route_visits(id) on delete set null;

alter table public.visits add column if not exists photos jsonb;

CREATE TABLE IF NOT EXISTS public.coletas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id text NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  collect_date date NOT NULL,
  note text,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT coletas_unique UNIQUE (client_id, collect_date)
);

CREATE INDEX IF NOT EXISTS coletas_client_idx ON public.coletas (client_id, collect_date DESC);

ALTER TABLE public.coletas ENABLE ROW LEVEL SECURITY;

drop policy if exists coletas_select on public.coletas;
CREATE POLICY "coletas_select" ON public.coletas FOR SELECT USING (true);

drop policy if exists coletas_insert on public.coletas;
CREATE POLICY "coletas_insert" ON public.coletas FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

drop policy if exists coletas_delete on public.coletas;
CREATE POLICY "coletas_delete" ON public.coletas FOR DELETE USING (is_coordenador());

alter table public.profiles drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check
  check (role = ANY (ARRAY['coordenador'::text, 'vendedor'::text, 'gerente'::text]));

drop policy if exists profiles_update_coord on public.profiles;
CREATE POLICY "profiles_update_coord" ON public.profiles
  FOR UPDATE USING (is_coordenador()) WITH CHECK (is_coordenador());

alter table public.visits add column if not exists alerta boolean not null default false;

alter table public.visits add column if not exists alerta_motivo text;

alter table public.clients add column if not exists geo_aproximado boolean not null default false;

create table if not exists public.client_alerts (
  id text primary key default gen_random_uuid()::text,
  client_id text not null references public.clients(id) on delete cascade,
  motivo text not null,
  created_by uuid,
  created_by_name text,
  created_at timestamptz not null default now()
);

create index if not exists client_alerts_created_at_idx on public.client_alerts (created_at desc);

create index if not exists client_alerts_client_id_idx on public.client_alerts (client_id);

grant select, insert, delete on public.client_alerts to authenticated;

alter table public.client_alerts enable row level security;

drop policy if exists ca_select on public.client_alerts;
create policy ca_select on public.client_alerts for select to authenticated using (true);

drop policy if exists ca_insert on public.client_alerts;
create policy ca_insert on public.client_alerts for insert to authenticated
with check (
  created_by = auth.uid()
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('coordenador', 'vendedor')
  )
);

drop policy if exists ca_delete on public.client_alerts;
create policy ca_delete on public.client_alerts for delete to authenticated
using (created_by = auth.uid() or public.is_coordenador());

alter table public.client_alerts add column if not exists photo_url text;

create table if not exists public.route_activities (
  id text primary key default gen_random_uuid()::text,
  week_start date not null,
  day int not null,
  titulo text not null,
  obs text,
  duration_min int not null default 0,
  created_by uuid,
  created_by_name text,
  created_at timestamptz not null default now()
);

create index if not exists route_activities_week_idx on public.route_activities (week_start, day);

grant select, insert, delete on public.route_activities to authenticated;

alter table public.route_activities enable row level security;

drop policy if exists ra_select on public.route_activities;
create policy ra_select on public.route_activities for select to authenticated using (true);

drop policy if exists ra_insert on public.route_activities;
create policy ra_insert on public.route_activities for insert to authenticated
with check (
  created_by = auth.uid()
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('coordenador', 'vendedor')
  )
);

drop policy if exists ra_delete on public.route_activities;
create policy ra_delete on public.route_activities for delete to authenticated
using (created_by = auth.uid() or public.is_coordenador());

create table if not exists public.client_monthly_volumes (
  id text primary key default gen_random_uuid()::text,
  client_id text not null references public.clients(id) on delete cascade,
  month date not null,
  volume_m3 numeric not null default 0,
  created_at timestamptz not null default now(),
  unique (client_id, month)
);

create index if not exists client_monthly_volumes_month_idx on public.client_monthly_volumes (month);

grant select on public.client_monthly_volumes to authenticated;

alter table public.client_monthly_volumes enable row level security;

drop policy if exists cmv_select on public.client_monthly_volumes;
create policy cmv_select on public.client_monthly_volumes for select to authenticated using (true);

alter table public.client_monthly_volumes add column if not exists label text;

alter table public.client_monthly_volumes alter column client_id drop not null;

create unique index if not exists client_monthly_volumes_label_month_key on public.client_monthly_volumes (label, month) where client_id is null;

alter table public.coletas add column if not exists volume_m3 numeric;

alter table public.coletas add column if not exists trocas integer not null default 1;

drop policy if exists coletas_update on public.coletas;
create policy coletas_update on public.coletas for update to authenticated
using (public.is_coordenador()) with check (public.is_coordenador());

create table if not exists public.client_cadence (
  id text primary key default gen_random_uuid()::text,
  client_id text references public.clients(id) on delete cascade,
  nome_planilha text not null,
  media_dias numeric,
  coletas integer not null default 0,
  ultima_coleta date,
  atualizado_em timestamptz not null default now(),
  unique (nome_planilha)
);

grant select on public.client_cadence to authenticated;

alter table public.client_cadence enable row level security;

drop policy if exists cc_select on public.client_cadence;
create policy cc_select on public.client_cadence for select to authenticated using (true);

alter table public.client_cadence add column if not exists datas date[];

alter table public.clients add column if not exists segmento_comercial text;

alter table public.visits add column if not exists tipo_contato text;

create table if not exists public.internal_prospects (
  id text primary key default gen_random_uuid()::text,
  nome text not null,
  cidade text,
  endereco text,
  contato text,
  telefone text,
  segmento_comercial text,
  segmento_logistico text,
  observacoes text,
  created_by uuid,
  created_by_name text,
  created_at timestamptz not null default now()
);

grant select, insert, delete on public.internal_prospects to authenticated;

alter table public.internal_prospects enable row level security;

drop policy if exists ip_select on public.internal_prospects;
create policy ip_select on public.internal_prospects for select to authenticated using (true);

drop policy if exists ip_insert on public.internal_prospects;
create policy ip_insert on public.internal_prospects for insert to authenticated
with check (
  created_by = auth.uid()
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('coordenador', 'vendedor')
  )
);

drop policy if exists ip_delete on public.internal_prospects;
create policy ip_delete on public.internal_prospects for delete to authenticated
using (created_by = auth.uid() or public.is_coordenador());

create table if not exists public.internal_prospect_notes (
  id text primary key default gen_random_uuid()::text,
  prospect_id text not null references public.internal_prospects(id) on delete cascade,
  texto text not null,
  created_by uuid,
  created_by_name text,
  created_at timestamptz not null default now()
);

create index if not exists internal_prospect_notes_prospect_idx on public.internal_prospect_notes (prospect_id, created_at);

grant select, insert, delete on public.internal_prospect_notes to authenticated;

alter table public.internal_prospect_notes enable row level security;

drop policy if exists ipn_select on public.internal_prospect_notes;
create policy ipn_select on public.internal_prospect_notes for select to authenticated using (true);

drop policy if exists ipn_insert on public.internal_prospect_notes;
create policy ipn_insert on public.internal_prospect_notes for insert to authenticated
with check (
  created_by = auth.uid()
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('coordenador', 'vendedor')
  )
);

drop policy if exists ipn_delete on public.internal_prospect_notes;
create policy ipn_delete on public.internal_prospect_notes for delete to authenticated
using (created_by = auth.uid() or public.is_coordenador());

alter table public.internal_prospects add column if not exists visita_agendada date;

grant update on public.internal_prospects to authenticated;

drop policy if exists ip_update on public.internal_prospects;
create policy ip_update on public.internal_prospects for update to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('coordenador', 'vendedor')
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('coordenador', 'vendedor')
  )
);

alter table public.clients add column if not exists visita_agendada date;

create table if not exists public.client_prospect_notes (
  id text primary key default gen_random_uuid()::text,
  client_id text not null references public.clients(id) on delete cascade,
  texto text not null,
  created_by uuid,
  created_by_name text,
  created_at timestamptz not null default now()
);

create index if not exists client_prospect_notes_client_idx on public.client_prospect_notes (client_id, created_at);

grant select, insert, delete on public.client_prospect_notes to authenticated;

alter table public.client_prospect_notes enable row level security;

drop policy if exists cpn_select on public.client_prospect_notes;
create policy cpn_select on public.client_prospect_notes for select to authenticated using (true);

drop policy if exists cpn_insert on public.client_prospect_notes;
create policy cpn_insert on public.client_prospect_notes for insert to authenticated
with check (
  created_by = auth.uid()
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('coordenador', 'vendedor')
  )
);

drop policy if exists cpn_delete on public.client_prospect_notes;
create policy cpn_delete on public.client_prospect_notes for delete to authenticated
using (created_by = auth.uid() or public.is_coordenador());

create table if not exists public.client_payments (
  id text primary key,
  client_id text references public.clients(id) on delete cascade,
  label text,
  valor_a_pagar text,
  a_pagar_maquina text,
  tipo_servico text,
  modalidade text,
  created_at timestamptz not null default now()
);

alter table public.client_payments enable row level security;

grant select, insert, update, delete on public.client_payments to authenticated;

grant select, insert, update, delete on public.profiles to authenticated;

grant select, insert, update, delete on public.clients to authenticated;

grant select, insert, update, delete on public.settings to authenticated;

grant select, insert, update, delete on public.weekly_routes to authenticated;

grant select, insert, update, delete on public.route_visits to authenticated;

grant select, insert, update, delete on public.visits to authenticated;

grant select, insert, update, delete on public.clientes_excluidos to authenticated;

grant select, insert, update, delete on public.coletas to authenticated;

drop policy if exists cp_select on public.client_payments;
create policy cp_select on public.client_payments for select to authenticated using (true);

drop policy if exists cp_insert on public.client_payments;
create policy cp_insert on public.client_payments for insert to authenticated
with check (public.is_coordenador());

drop policy if exists cp_update on public.client_payments;
create policy cp_update on public.client_payments for update to authenticated
using (public.is_coordenador()) with check (public.is_coordenador());

drop policy if exists cp_delete on public.client_payments;
create policy cp_delete on public.client_payments for delete to authenticated
using (public.is_coordenador());

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'client_alerts') then
    alter publication supabase_realtime add table public.client_alerts;
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'client_cadence') then
    alter publication supabase_realtime add table public.client_cadence;
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'client_monthly_volumes') then
    alter publication supabase_realtime add table public.client_monthly_volumes;
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'client_prospect_notes') then
    alter publication supabase_realtime add table public.client_prospect_notes;
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'clients') then
    alter publication supabase_realtime add table public.clients;
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'client_payments') then
    alter publication supabase_realtime add table public.client_payments;
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'internal_prospect_notes') then
    alter publication supabase_realtime add table public.internal_prospect_notes;
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'internal_prospects') then
    alter publication supabase_realtime add table public.internal_prospects;
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'route_activities') then
    alter publication supabase_realtime add table public.route_activities;
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'route_visits') then
    alter publication supabase_realtime add table public.route_visits;
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'visits') then
    alter publication supabase_realtime add table public.visits;
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'weekly_routes') then
    alter publication supabase_realtime add table public.weekly_routes;
  end if;
end $$;

drop policy if exists cmv_insert on public.client_monthly_volumes;
create policy cmv_insert on public.client_monthly_volumes for insert to authenticated with check (is_coordenador());

drop policy if exists cmv_update on public.client_monthly_volumes;
create policy cmv_update on public.client_monthly_volumes for update to authenticated using (is_coordenador()) with check (is_coordenador());

drop policy if exists cmv_delete on public.client_monthly_volumes;
create policy cmv_delete on public.client_monthly_volumes for delete to authenticated using (is_coordenador());

drop policy if exists cc_insert on public.client_cadence;
create policy cc_insert on public.client_cadence for insert to authenticated with check (is_coordenador());

drop policy if exists cc_update on public.client_cadence;
create policy cc_update on public.client_cadence for update to authenticated using (is_coordenador()) with check (is_coordenador());

drop policy if exists cc_delete on public.client_cadence;
create policy cc_delete on public.client_cadence for delete to authenticated using (is_coordenador());

select count(*) as coletas_teste from public.coletas where client_id = 'cli-0';

rollback;

create table if not exists public.user_permissoes (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  editar_clientes boolean not null default false,
  gerir_rota boolean not null default false,
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid
);

alter table public.user_permissoes enable row level security;

drop policy if exists up_select on public.user_permissoes;
create policy up_select on public.user_permissoes for select to authenticated
  using (auth.uid() = user_id or is_coordenador());

drop policy if exists up_insert on public.user_permissoes;
create policy up_insert on public.user_permissoes for insert to authenticated
  with check (is_coordenador());

drop policy if exists up_update on public.user_permissoes;
create policy up_update on public.user_permissoes for update to authenticated
  using (is_coordenador()) with check (is_coordenador());

drop policy if exists up_delete on public.user_permissoes;
create policy up_delete on public.user_permissoes for delete to authenticated
  using (is_coordenador());

create or replace function public.is_liberado_editar_clientes()
returns boolean language sql stable security definer set search_path to 'public' as $$
  select is_coordenador() or exists (
    select 1 from public.user_permissoes p where p.user_id = auth.uid() and p.editar_clientes
  );
$$;

create or replace function public.is_liberado_gerir_rota()
returns boolean language sql stable security definer set search_path to 'public' as $$
  select is_coordenador() or exists (
    select 1 from public.user_permissoes p where p.user_id = auth.uid() and p.gerir_rota
  );
$$;

alter policy clients_insert_coord on public.clients
  with check (is_liberado_editar_clientes());

alter policy clients_update_coord on public.clients
  using (is_liberado_editar_clientes()) with check (is_liberado_editar_clientes());

alter policy routes_write on public.weekly_routes
  with check (is_liberado_gerir_rota());

alter policy routes_update on public.weekly_routes
  using (is_liberado_gerir_rota()) with check (is_liberado_gerir_rota());

alter policy routes_delete on public.weekly_routes
  using (is_liberado_gerir_rota());

alter policy rv_delete on public.route_visits
  using (is_liberado_gerir_rota());

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'user_permissoes') then
    alter publication supabase_realtime add table public.user_permissoes;
  end if;
end $$;

alter table public.settings add column if not exists planilha_versao text;

create or replace function public.is_leitor_apenas()
returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'gerente');
$$;

alter policy coletas_insert on public.coletas
  with check (auth.uid() is not null and not is_leitor_apenas());

alter policy rv_write_vendor on public.route_visits
  with check (auth.uid() is not null and not is_leitor_apenas());

alter policy rv_update_any on public.route_visits
  using (auth.uid() is not null and not is_leitor_apenas())
  with check (auth.uid() is not null and not is_leitor_apenas());

alter policy rv_write_prospect on public.route_visits
  with check (
    exists (select 1 from public.clients c where c.id = route_visits.client_id and c.is_prospecao = true)
    and not is_leitor_apenas()
  );

alter policy visits_insert on public.visits
  with check (not is_leitor_apenas());

alter policy visits_update on public.visits
  using (((auth.uid() = created_by) or is_coordenador()) and not is_leitor_apenas())
  with check (not is_leitor_apenas());

alter policy visits_delete on public.visits
  using (((auth.uid() = created_by) or is_coordenador()) and not is_leitor_apenas());

alter policy clients_insert_prospect on public.clients
  with check (is_prospecao = true and not is_leitor_apenas());

alter policy clients_update_prospect on public.clients
  using (is_prospecao = true and not is_leitor_apenas())
  with check (is_prospecao = true and not is_leitor_apenas());

alter policy visitas_auth_upload on storage.objects
  with check (bucket_id = 'visitas' and not public.is_leitor_apenas());

create or replace function public.protege_papel_perfil()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  if new.role is distinct from old.role and auth.uid() is not null and not is_coordenador() then
    raise exception 'Somente o coordenador pode alterar papéis de usuário';
  end if;
  return new;
end $$;

create trigger trg_protege_papel
  before update on public.profiles
  for each row execute function public.protege_papel_perfil();

alter table public.user_permissoes
  add column if not exists atualizar_planilha boolean not null default false;

create or replace function public.is_liberado_planilha()
returns boolean language sql stable security definer set search_path to 'public' as $$
  select is_coordenador() or exists (
    select 1 from public.user_permissoes p where p.user_id = auth.uid() and p.atualizar_planilha
  );
$$;

create table if not exists public.planilha_lancamentos (
  id text primary key default (gen_random_uuid())::text,
  nome_planilha text not null,
  collect_date date not null,
  volume_m3 numeric,
  trocas integer not null default 1,
  enviado_por uuid,
  enviado_em timestamptz not null default now(),
  unique (nome_planilha, collect_date)
);

alter table public.planilha_lancamentos enable row level security;

drop policy if exists pl_select on public.planilha_lancamentos;
create policy pl_select on public.planilha_lancamentos for select to authenticated using (true);

drop policy if exists pl_insert on public.planilha_lancamentos;
create policy pl_insert on public.planilha_lancamentos for insert to authenticated with check (is_liberado_planilha());

drop policy if exists pl_update on public.planilha_lancamentos;
create policy pl_update on public.planilha_lancamentos for update to authenticated using (is_liberado_planilha()) with check (is_liberado_planilha());

drop policy if exists pl_delete on public.planilha_lancamentos;
create policy pl_delete on public.planilha_lancamentos for delete to authenticated using (is_coordenador());

alter policy cmv_insert on public.client_monthly_volumes with check (is_liberado_planilha());

alter policy cmv_update on public.client_monthly_volumes
  using (is_liberado_planilha()) with check (is_liberado_planilha());

alter policy cc_insert on public.client_cadence with check (is_liberado_planilha());

alter policy cc_update on public.client_cadence
  using (is_liberado_planilha()) with check (is_liberado_planilha());

alter policy coletas_insert on public.coletas
  with check ((auth.uid() is not null and not is_leitor_apenas()) or is_liberado_planilha());

alter policy coletas_update on public.coletas
  using (is_liberado_planilha()) with check (is_liberado_planilha());

alter policy clients_update_coord on public.clients
  using (is_liberado_editar_clientes() or is_liberado_planilha())
  with check (is_liberado_editar_clientes() or is_liberado_planilha());

create or replace function public.limita_edicao_planilha()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare
  data_enviada date := new.last_collect_at;
begin
  if auth.uid() is not null
     and not is_coordenador()
     and not is_liberado_editar_clientes()
     and is_liberado_planilha() then
    new := old;
    if data_enviada is not null and (old.last_collect_at is null or old.last_collect_at < data_enviada) then
      new.last_collect_at := data_enviada;
    end if;
  end if;
  return new;
end $$;

create trigger trg_limita_edicao_planilha
  before update on public.clients
  for each row execute function public.limita_edicao_planilha();

alter policy cmv_delete on public.client_monthly_volumes using (is_liberado_planilha());

alter policy cc_delete on public.client_cadence using (is_liberado_planilha());

alter table public.clients
  add column if not exists cnpj text,
  add column if not exists inscricao_estadual text,
  add column if not exists contrato_numero text,
  add column if not exists equipamento text,
  add column if not exists equipamentos_qtd integer,
  add column if not exists trocas_minimas integer,
  add column if not exists valor_troca text,
  add column if not exists dia_pagamento integer,
  add column if not exists forma_pagamento text,
  add column if not exists local_coleta text;

alter table public.settings
  add column if not exists empresa_razao text,
  add column if not exists empresa_cnpj text,
  add column if not exists empresa_ie text,
  add column if not exists empresa_endereco text,
  add column if not exists empresa_cidade text,
  add column if not exists empresa_uf text,
  add column if not exists empresa_cep text,
  add column if not exists contrato_foro text,
  add column if not exists contrato_prazo_meses integer,
  add column if not exists contrato_valor_viagem numeric,
  add column if not exists contrato_valor_equipamento numeric,
  add column if not exists contrato_testemunha_nome text,
  add column if not exists contrato_testemunha_cpf text;

create table if not exists public.client_notes (
  id text primary key default (gen_random_uuid())::text,
  client_id text not null references public.clients(id) on delete cascade,
  texto text not null,
  created_by uuid,
  created_by_name text,
  created_at timestamptz not null default now()
);

create index if not exists client_notes_client_idx on public.client_notes (client_id, created_at desc);

alter table public.client_notes enable row level security;

drop policy if exists cn_select on public.client_notes;
create policy cn_select on public.client_notes for select to authenticated using (true);

drop policy if exists cn_insert on public.client_notes;
create policy cn_insert on public.client_notes for insert to authenticated
  with check (
    auth.uid() is not null and (
      is_coordenador()
      or is_liberado_editar_clientes()
      or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'vendedor')
    )
  );

drop policy if exists cn_delete on public.client_notes;
create policy cn_delete on public.client_notes for delete to authenticated
  using (is_coordenador() or created_by = auth.uid());

alter table public.settings
  add column if not exists meta_dia_rollon numeric,
  add column if not exists meta_dia_poli numeric,
  add column if not exists meta_dia_terceiro numeric,
  add column if not exists meta_mes numeric;

alter table settings add column if not exists meta_dia_pap numeric default 10;

create table if not exists metas_mes (
  mes date primary key,
  meta_dia_rollon numeric not null default 0,
  meta_dia_poli numeric not null default 0,
  meta_dia_pap numeric not null default 0,
  meta_dia_terceiro numeric not null default 0,
  atualizado_em timestamptz not null default now()
);

alter table metas_mes enable row level security;

drop policy if exists mm_select on metas_mes;
create policy mm_select on metas_mes for select using (true);

drop policy if exists mm_write on metas_mes;
create policy mm_write on metas_mes for insert with check (is_coordenador());

drop policy if exists mm_update on metas_mes;
create policy mm_update on metas_mes for update using (is_coordenador()) with check (is_coordenador());

drop policy if exists mm_delete on metas_mes;
create policy mm_delete on metas_mes for delete using (is_coordenador());

create table if not exists apresentacao_cacambas (
  mes date primary key,
  rollon jsonb not null default '{"total":0,"clientes":0,"estoques":0,"manutencao":0,"caminhoes":0,"segmentos":[]}'::jsonb,
  poli jsonb not null default '{"total":0,"clientes":0,"estoques":0,"manutencao":0,"caminhoes":0,"segmentos":[]}'::jsonb,
  atualizado_em timestamptz not null default now()
);

alter table apresentacao_cacambas enable row level security;

drop policy if exists cac_select on apresentacao_cacambas;
create policy cac_select on apresentacao_cacambas for select using (true);

drop policy if exists cac_write on apresentacao_cacambas;
create policy cac_write on apresentacao_cacambas for insert with check (is_coordenador());

drop policy if exists cac_update on apresentacao_cacambas;
create policy cac_update on apresentacao_cacambas for update using (is_coordenador()) with check (is_coordenador());

create table if not exists apresentacao_fila (
  id uuid primary key default gen_random_uuid(),
  mes date not null,
  cliente text not null,
  cidade text not null default '',
  volume numeric not null default 0,
  posicao integer not null default 0,
  atualizado_em timestamptz not null default now()
);

create index if not exists apresentacao_fila_mes_idx on apresentacao_fila (mes);

alter table apresentacao_fila enable row level security;

drop policy if exists fila_select on apresentacao_fila;
create policy fila_select on apresentacao_fila for select using (true);

drop policy if exists fila_write on apresentacao_fila;
create policy fila_write on apresentacao_fila for insert with check (is_coordenador());

drop policy if exists fila_update on apresentacao_fila;
create policy fila_update on apresentacao_fila for update using (is_coordenador()) with check (is_coordenador());

drop policy if exists fila_delete on apresentacao_fila;
create policy fila_delete on apresentacao_fila for delete using (is_coordenador());

alter table apresentacao_fila add column if not exists tipo text not null default 'rollon';

create table if not exists apresentacao_faturamento (
  id uuid primary key default gen_random_uuid(),
  mes date not null,
  cliente text not null,
  valor numeric not null default 0,
  posicao integer not null default 0,
  atualizado_em timestamptz not null default now()
);

create index if not exists apresentacao_faturamento_mes_idx on apresentacao_faturamento (mes);

alter table apresentacao_faturamento enable row level security;

drop policy if exists fat_select on apresentacao_faturamento;
create policy fat_select on apresentacao_faturamento for select using (true);

drop policy if exists fat_write on apresentacao_faturamento;
create policy fat_write on apresentacao_faturamento for insert with check (is_coordenador());

drop policy if exists fat_update on apresentacao_faturamento;
create policy fat_update on apresentacao_faturamento for update using (is_coordenador()) with check (is_coordenador());

drop policy if exists fat_delete on apresentacao_faturamento;
create policy fat_delete on apresentacao_faturamento for delete using (is_coordenador());

alter policy cac_write on apresentacao_cacambas with check (is_coordenador() or is_liberado_editar_clientes());

alter policy cac_update on apresentacao_cacambas using (is_coordenador() or is_liberado_editar_clientes()) with check (is_coordenador() or is_liberado_editar_clientes());

alter policy fila_write on apresentacao_fila with check (is_coordenador() or is_liberado_editar_clientes());

alter policy fila_update on apresentacao_fila using (is_coordenador() or is_liberado_editar_clientes()) with check (is_coordenador() or is_liberado_editar_clientes());

alter policy fila_delete on apresentacao_fila using (is_coordenador() or is_liberado_editar_clientes());

alter policy fat_write on apresentacao_faturamento with check (is_coordenador() or is_liberado_editar_clientes());

alter policy fat_update on apresentacao_faturamento using (is_coordenador() or is_liberado_editar_clientes()) with check (is_coordenador() or is_liberado_editar_clientes());

alter policy fat_delete on apresentacao_faturamento using (is_coordenador() or is_liberado_editar_clientes());

alter table settings add column if not exists unidade_nome text default 'Multiplus Paulínia';

alter policy cac_write on apresentacao_cacambas with check (auth.uid() is not null);

alter policy cac_update on apresentacao_cacambas using (auth.uid() is not null) with check (auth.uid() is not null);

alter policy fila_write on apresentacao_fila with check (auth.uid() is not null);

alter policy fila_update on apresentacao_fila using (auth.uid() is not null) with check (auth.uid() is not null);

alter policy fila_delete on apresentacao_fila using (auth.uid() is not null);

alter policy fat_write on apresentacao_faturamento with check (auth.uid() is not null);

alter policy fat_update on apresentacao_faturamento using (auth.uid() is not null) with check (auth.uid() is not null);

alter policy fat_delete on apresentacao_faturamento using (auth.uid() is not null);

alter table clients add column if not exists bairro text;

alter table clients add column if not exists email text;

alter table clients add column if not exists telefone text;

alter table clients add column if not exists representante text;

alter table clients add column if not exists base_atendimento text;

alter table coletas add column if not exists toneladas numeric;

alter table client_monthly_volumes add column if not exists toneladas numeric;
insert into public.settings (id) values (1) on conflict (id) do nothing;

commit;

notify pgrst, 'reload schema';
