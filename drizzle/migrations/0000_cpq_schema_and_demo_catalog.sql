-- =========================================================================
-- JoRPA CPQ demo — schema. ALL SEED DATA IS SYNTHETIC DEMO/TEST DATA.
-- =========================================================================
create type public.app_role as enum ('verkoper','productbeheerder','manager','productie');
create type public.quote_status as enum ('concept','interne_controle','goedgekeurd','verzonden','aanvaard','afgewezen','vervallen');

create or replace function public.set_updated_at() returns trigger
language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end $$;

-- ---------- identity & roles ----------
create table public.roles (
  code public.app_role primary key,
  name text not null,
  description text not null,
  sort int not null default 0
);
grant select on public.roles to authenticated;
grant all on public.roles to service_role;
alter table public.roles enable row level security;
create policy "roles readable" on public.roles for select to authenticated using (true);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  email text,
  locale text not null default 'nl',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;
create or replace function public.has_any_role(_user_id uuid, _roles public.app_role[])
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = any(_roles))
$$;
create or replace function public.is_member(_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id)
$$;

create policy "members read profiles" on public.profiles for select to authenticated using (public.is_member(auth.uid()) or id = auth.uid());
create policy "own profile update" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy "read own or managed roles" on public.user_roles for select to authenticated
  using (user_id = auth.uid() or public.has_any_role(auth.uid(), array['manager','productbeheerder']::public.app_role[]));

-- ---------- catalog ----------
create table public.price_books (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  version int not null default 1,
  currency text not null default 'EUR',
  factor numeric(6,4) not null default 1,
  valid_from date,
  valid_to date,
  parent_price_book_id uuid references public.price_books(id),
  is_default boolean not null default false,
  status text not null default 'actief' check (status in ('actief','concept','gearchiveerd')),
  vat_default numeric(5,2) not null default 21,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.price_book_entries (
  id uuid primary key default gen_random_uuid(),
  price_book_id uuid not null references public.price_books(id) on delete cascade,
  entry_type text not null check (entry_type in ('base','matrix','option','service','labour','component')),
  system_code text,
  option_code text,
  value_code text,
  component_code text,
  width_upto int,
  height_upto int,
  amount numeric(12,2) not null default 0,
  unit text not null default 'piece' check (unit in ('piece','m2','m_width','percent','per_section','unit')),
  label text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.price_book_entries (price_book_id, entry_type);

create table public.product_families (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name_nl text not null, name_fr text, name_en text,
  description text,
  sort int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  family_code text not null references public.product_families(code),
  name text not null,
  description text,
  default_config jsonb not null default '{}',
  sort int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.systems (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  material text not null,
  families text[] not null default '{}',
  description text,
  production_ready boolean not null default true,
  sort int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.options (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name_nl text not null, name_fr text, name_en text,
  step text not null,
  input_type text not null default 'single' check (input_type in ('single','multi')),
  required boolean not null default false,
  families text[],
  sort int not null default 0,
  help_text text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.option_values (
  id uuid primary key default gen_random_uuid(),
  option_id uuid not null references public.options(id) on delete cascade,
  code text not null,
  name_nl text not null, name_fr text, name_en text,
  attributes jsonb not null default '{}',
  sort int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (option_id, code)
);

create table public.configuration_rules (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  rule_type text not null check (rule_type in ('dimension_limit','restrict_values','exclude_values','requires_value','forbid','auto_include','surcharge','placeholder')),
  conditions jsonb not null default '[]',
  params jsonb not null default '{}',
  message text not null default '',
  severity text not null default 'error' check (severity in ('error','warning')),
  active boolean not null default true,
  version int not null default 1,
  created_by uuid default auth.uid(),
  updated_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.rule_versions (
  id uuid primary key default gen_random_uuid(),
  rule_id uuid not null references public.configuration_rules(id) on delete cascade,
  version int not null,
  snapshot jsonb not null,
  changed_by uuid,
  created_at timestamptz not null default now()
);

create table public.discounts (
  id uuid primary key default gen_random_uuid(),
  discount_type text not null check (discount_type in ('quantity','role_limit','margin_threshold')),
  role public.app_role,
  min_quantity int,
  percent numeric(5,2),
  approval_above_percent numeric(5,2),
  label text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.component_costs (
  id uuid primary key default gen_random_uuid(),
  component_code text not null unique,
  unit_cost numeric(12,4) not null default 0,
  unit text not null default 'st',
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.bom_templates (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  conditions jsonb not null default '[]',
  geometry_ref text,
  sort int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.bom_lines (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.bom_templates(id) on delete cascade,
  component_code text not null,
  description text not null,
  qty_basis text not null check (qty_basis in ('fixed','per_piece','perimeter_m','area_m2','glass_area_m2','width_m','height_m','per_section','per_opening_section','sash_perimeter_m','mullion_m')),
  qty_factor numeric(10,4) not null default 1,
  unit text not null default 'st',
  conditions jsonb not null default '[]',
  geometry_ref text,
  sort int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.quote_templates (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  intro_text text not null default '',
  conditions_text text not null default '',
  validity_days int not null default 30,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- customers & projects ----------
create sequence public.project_number_seq start 1;
create sequence public.quote_number_seq start 1;
create or replace function public.next_project_number() returns text language sql volatile set search_path = public as $$
  select 'P-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.project_number_seq')::text, 4, '0')
$$;
create or replace function public.next_quote_number() returns text language sql volatile set search_path = public as $$
  select 'OFF-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.quote_number_seq')::text, 4, '0')
$$;

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  company_type text not null default 'particulier' check (company_type in ('particulier','aannemer','dealer','architect')),
  vat_number text,
  email text,
  phone text,
  street text,
  postal_code text,
  city text,
  country text not null default 'BE',
  price_book_id uuid references public.price_books(id),
  notes text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  version int not null default 1
);

create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  first_name text not null,
  last_name text not null,
  email text,
  phone text,
  job_title text,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  project_number text not null unique default public.next_project_number(),
  name text not null,
  company_id uuid not null references public.companies(id),
  contact_id uuid references public.contacts(id) on delete set null,
  street text,
  postal_code text,
  city text,
  owner_id uuid default auth.uid(),
  status text not null default 'in_opmaak' check (status in ('lead','in_opmaak','offerte','gewonnen','verloren','in_productie')),
  desired_delivery_date date,
  vat_rate numeric(5,2) not null default 21,
  notes text,
  sync_status text not null default 'niet_gesynchroniseerd',
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  version int not null default 1
);

create table public.project_items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  seq int not null,
  label text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.configurations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  description text,
  is_primary boolean not null default false,
  source_configuration_id uuid references public.configurations(id) on delete set null,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  version int not null default 1
);

create table public.configuration_items (
  id uuid primary key default gen_random_uuid(),
  configuration_id uuid not null references public.configurations(id) on delete cascade,
  project_item_id uuid not null references public.project_items(id) on delete cascade,
  data jsonb not null default '{}',
  manual_overrides text[] not null default '{}',
  status text not null default 'concept',
  validation jsonb not null default '{}',
  net_total numeric(12,2),
  price_book_version int,
  version int not null default 1,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (configuration_id, project_item_id)
);

create table public.attachments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  file_name text not null,
  storage_path text not null,
  mime_type text,
  size_bytes bigint,
  description text,
  uploaded_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- ---------- quotes ----------
create table public.quotes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  quote_number text not null unique default public.next_quote_number(),
  title text not null,
  status public.quote_status not null default 'concept',
  current_revision_no int not null default 0,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.quote_revisions (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes(id) on delete cascade,
  revision_no int not null,
  status public.quote_status not null default 'concept',
  primary_configuration_id uuid references public.configurations(id) on delete set null,
  alternative_configuration_ids uuid[] not null default '{}',
  discount_percent numeric(5,2) not null default 0,
  vat_rate numeric(5,2) not null default 21,
  valid_until date,
  template_id uuid references public.quote_templates(id) on delete set null,
  subtotal_net numeric(12,2) not null default 0,
  discount_amount numeric(12,2) not null default 0,
  total_net numeric(12,2) not null default 0,
  vat_amount numeric(12,2) not null default 0,
  total_gross numeric(12,2) not null default 0,
  price_book_id uuid references public.price_books(id),
  price_book_code text,
  price_book_version int,
  rules_version int,
  snapshot jsonb not null default '{}',
  requires_approval boolean not null default false,
  approval_reasons text[] not null default '{}',
  production_ready boolean not null default false,
  locked boolean not null default false,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  submitted_at timestamptz,
  approved_at timestamptz,
  sent_at timestamptz,
  decided_at timestamptz,
  unique (quote_id, revision_no)
);

create table public.quote_revision_costs (
  revision_id uuid primary key references public.quote_revisions(id) on delete cascade,
  cost_total numeric(12,2),
  margin_amount numeric(12,2),
  margin_percent numeric(6,2),
  created_at timestamptz not null default now()
);

create table public.quote_lines (
  id uuid primary key default gen_random_uuid(),
  revision_id uuid not null references public.quote_revisions(id) on delete cascade,
  configuration_id uuid,
  variant_name text,
  is_alternative boolean not null default false,
  seq int not null,
  label text not null,
  description text not null,
  quantity int not null,
  unit_price numeric(12,2) not null,
  line_total numeric(12,2) not null,
  status text,
  created_at timestamptz not null default now()
);

create table public.approvals (
  id uuid primary key default gen_random_uuid(),
  revision_id uuid not null references public.quote_revisions(id) on delete cascade,
  requested_by uuid,
  reason text not null,
  status text not null default 'in_afwachting' check (status in ('in_afwachting','goedgekeurd','afgewezen','automatisch')),
  decided_by uuid,
  decided_at timestamptz,
  comment text,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  quote_revision_id uuid references public.quote_revisions(id) on delete cascade,
  doc_type text not null check (doc_type in ('offerte_pdf','technische_fiche_pdf')),
  file_name text not null,
  meta jsonb not null default '{}',
  generated_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);

-- ---------- integration (mock) ----------
create table public.integration_jobs (
  id uuid primary key default gen_random_uuid(),
  connector text not null default 'jorpa-mock',
  entity_type text not null,
  entity_id uuid not null,
  action text not null,
  idempotency_key text not null unique,
  status text not null default 'wachtend' check (status in ('wachtend','bezig','geslaagd','mislukt')),
  attempts int not null default 0,
  payload jsonb not null default '{}',
  response jsonb,
  error_code text,
  error_message text,
  external_ref text,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_attempt_at timestamptz
);

create table public.sync_events (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.integration_jobs(id) on delete cascade,
  event_type text not null,
  message text not null,
  created_at timestamptz not null default now()
);

create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  table_name text not null,
  record_id uuid,
  action text not null,
  actor_id uuid,
  changed_fields text[] not null default '{}',
  summary text,
  created_at timestamptz not null default now()
);
create index on public.audit_log (created_at desc);

-- ---------- grants & RLS ----------
do $$
declare t text;
begin
  foreach t in array array['companies','contacts','projects','project_items','configurations','attachments'] loop
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "members read" on public.%I for select to authenticated using (public.is_member(auth.uid()))', t);
    execute format('create policy "sales insert" on public.%I for insert to authenticated with check (public.has_any_role(auth.uid(), array[''verkoper'',''manager'']::public.app_role[]))', t);
    execute format('create policy "sales update" on public.%I for update to authenticated using (public.has_any_role(auth.uid(), array[''verkoper'',''manager'']::public.app_role[])) with check (public.has_any_role(auth.uid(), array[''verkoper'',''manager'']::public.app_role[]))', t);
    execute format('create policy "sales delete" on public.%I for delete to authenticated using (public.has_any_role(auth.uid(), array[''verkoper'',''manager'']::public.app_role[]))', t);
  end loop;

  foreach t in array array['product_families','products','systems','options','option_values','configuration_rules','price_books','price_book_entries','discounts','bom_templates','bom_lines'] loop
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "members read" on public.%I for select to authenticated using (public.is_member(auth.uid()))', t);
    execute format('create policy "catalog insert" on public.%I for insert to authenticated with check (public.has_role(auth.uid(), ''productbeheerder''))', t);
    execute format('create policy "catalog update" on public.%I for update to authenticated using (public.has_role(auth.uid(), ''productbeheerder'')) with check (public.has_role(auth.uid(), ''productbeheerder''))', t);
    execute format('create policy "catalog delete" on public.%I for delete to authenticated using (public.has_role(auth.uid(), ''productbeheerder''))', t);
  end loop;

  foreach t in array array['configuration_items','quotes','quote_revisions','quote_lines','approvals','integration_jobs','sync_events','rule_versions'] loop
    execute format('grant select on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "members read" on public.%I for select to authenticated using (public.is_member(auth.uid()))', t);
  end loop;
end $$;

grant select, insert, update, delete on public.quote_templates to authenticated;
grant all on public.quote_templates to service_role;
alter table public.quote_templates enable row level security;
create policy "members read" on public.quote_templates for select to authenticated using (public.is_member(auth.uid()));
create policy "templates write" on public.quote_templates for all to authenticated
  using (public.has_any_role(auth.uid(), array['productbeheerder','manager']::public.app_role[]))
  with check (public.has_any_role(auth.uid(), array['productbeheerder','manager']::public.app_role[]));

grant select, insert, update, delete on public.component_costs to authenticated;
grant all on public.component_costs to service_role;
alter table public.component_costs enable row level security;
create policy "cost read" on public.component_costs for select to authenticated
  using (public.has_any_role(auth.uid(), array['productbeheerder','manager']::public.app_role[]));
create policy "cost write" on public.component_costs for all to authenticated
  using (public.has_role(auth.uid(), 'productbeheerder')) with check (public.has_role(auth.uid(), 'productbeheerder'));

grant select on public.quote_revision_costs to authenticated;
grant all on public.quote_revision_costs to service_role;
alter table public.quote_revision_costs enable row level security;
create policy "margin read" on public.quote_revision_costs for select to authenticated
  using (public.has_any_role(auth.uid(), array['productbeheerder','manager']::public.app_role[]));

grant select, insert on public.documents to authenticated;
grant all on public.documents to service_role;
alter table public.documents enable row level security;
create policy "members read" on public.documents for select to authenticated using (public.is_member(auth.uid()));
create policy "members log documents" on public.documents for insert to authenticated
  with check (public.is_member(auth.uid()) and generated_by = auth.uid());

grant select on public.audit_log to authenticated;
grant all on public.audit_log to service_role;
alter table public.audit_log enable row level security;
create policy "audit read" on public.audit_log for select to authenticated
  using (public.has_any_role(auth.uid(), array['manager','productbeheerder']::public.app_role[]));

create policy "members read attachments" on storage.objects for select to authenticated
  using (bucket_id = 'attachments' and public.is_member(auth.uid()));
create policy "sales upload attachments" on storage.objects for insert to authenticated
  with check (bucket_id = 'attachments' and public.has_any_role(auth.uid(), array['verkoper','manager']::public.app_role[]));
create policy "sales delete attachments" on storage.objects for delete to authenticated
  using (bucket_id = 'attachments' and public.has_any_role(auth.uid(), array['verkoper','manager']::public.app_role[]));

-- ---------- triggers ----------
do $$
declare t text;
begin
  foreach t in array array['profiles','price_books','price_book_entries','product_families','products','systems','options','option_values','configuration_rules','discounts','component_costs','bom_templates','bom_lines','quote_templates','companies','contacts','projects','project_items','configurations','configuration_items','attachments','quotes','quote_revisions','approvals','integration_jobs'] loop
    execute format('create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()', t);
  end loop;
end $$;

create or replace function public.bump_rule_version() returns trigger
language plpgsql set search_path = public as $$
begin
  if (new.conditions, new.params, new.message, new.severity, new.active, new.rule_type, new.name)
     is distinct from (old.conditions, old.params, old.message, old.severity, old.active, old.rule_type, old.name) then
    new.version = old.version + 1;
  end if;
  return new;
end $$;
create trigger bump_rule_version before update on public.configuration_rules for each row execute function public.bump_rule_version();

create or replace function public.snapshot_rule_version() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' or new.version <> old.version then
    insert into public.rule_versions (rule_id, version, snapshot, changed_by)
    values (new.id, new.version, to_jsonb(new) - 'created_at' - 'updated_at', coalesce(auth.uid(), new.updated_by));
  end if;
  return new;
end $$;
create trigger snapshot_rule_version after insert or update on public.configuration_rules for each row execute function public.snapshot_rule_version();

create or replace function public.protect_locked_revision() returns trigger
language plpgsql set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    if old.locked then raise exception 'Revisie % is vergrendeld en kan niet verwijderd worden', old.revision_no; end if;
    return old;
  end if;
  if old.locked and (
    new.snapshot is distinct from old.snapshot or new.total_net is distinct from old.total_net or
    new.total_gross is distinct from old.total_gross or new.discount_percent is distinct from old.discount_percent or
    new.primary_configuration_id is distinct from old.primary_configuration_id or new.locked = false) then
    raise exception 'Revisie % is vergrendeld: maak een nieuwe revisie', old.revision_no;
  end if;
  return new;
end $$;
create trigger protect_locked_revision before update or delete on public.quote_revisions for each row execute function public.protect_locked_revision();

insert into public.roles (code, name, description, sort) values
 ('verkoper','Verkoper','Klanten en projecten beheren, configuraties en offertes maken, varianten vergelijken.',1),
 ('productbeheerder','Productbeheerder / engineer','Productfamilies, opties, compatibiliteitsregels, prijstabellen en BOM-regels beheren.',2),
 ('manager','Manager','Offertes beoordelen, kortingen goedkeuren en rapporten bekijken.',3),
 ('productie','Productie / lezer','Goedgekeurde configuraties, technische fiche en BOM bekijken. Geen commerciële wijzigingen.',4);

-- =========================================================================
-- DEMO CATALOG — synthetic test data, NOT validated production information
-- =========================================================================
insert into public.price_books (code, name, version, factor, valid_from, valid_to, is_default, status) values
 ('PB-STD-2026','Standaard prijsboek 2026 (demo)',3,1,'2026-01-01','2026-12-31',true,'actief');
insert into public.price_books (code, name, version, factor, valid_from, valid_to, is_default, status, parent_price_book_id)
 select 'PB-DEALER-2026','Dealerprijsboek 2026 (demo)',1,0.88,'2026-01-01','2026-12-31',false,'actief', id from public.price_books where code = 'PB-STD-2026';

insert into public.product_families (code, name_nl, name_fr, name_en, sort) values
 ('raam','Raam','Fenêtre','Window',1),
 ('deur','Deur','Porte','Door',2),
 ('schuifraam','Schuifraam','Coulissant','Sliding window',3),
 ('vast','Vast element','Châssis fixe','Fixed light',4);

insert into public.systems (code, name, material, families, description, production_ready, sort) values
 ('PVC-70','Demo PVC 70 Classic','pvc','{raam,deur,vast}','Fictief 5-kamerprofiel, bouwdiepte 70 mm (demo).',true,1),
 ('PVC-82','Demo PVC 82 Comfort','pvc','{raam,vast}','Fictief 7-kamerprofiel, bouwdiepte 82 mm (demo).',true,2),
 ('ALU-75','Demo ALU 75 Slim','alu','{raam,deur,vast}','Fictief thermisch onderbroken aluminiumprofiel (demo).',true,3),
 ('ALU-SL160','Demo ALU Schuif 160','alu','{schuifraam}','Fictief aluminium schuifsysteem, 2 rails (demo).',true,4),
 ('PVC-HST','Demo PVC Hefschuif','pvc','{schuifraam}','Placeholder: hefschuifbeslag nog niet aangeleverd.',true,5),
 ('HOUT-68','Demo Hout 68 Meranti','hout','{raam,deur}','Placeholder: houtprofielen nog niet aangeleverd.',false,6);

insert into public.options (code, name_nl, name_fr, name_en, step, input_type, required, families, sort, help_text) values
 ('material','Materiaal','Matériau','Material','materiaal','single',true,null,1,null),
 ('opening','Openingswijze','Ouverture','Opening type','opening','single',true,null,2,'Per vak in te stellen.'),
 ('hinge','Draairichting','Sens d''ouverture','Hinge side','opening','single',false,null,3,'Scharnierzijde, gezien van binnen.'),
 ('kleur_binnen','Kleur binnen','Couleur intérieure','Colour inside','afwerking','single',true,null,4,null),
 ('kleur_buiten','Kleur buiten','Couleur extérieure','Colour outside','afwerking','single',true,null,5,null),
 ('glas','Glasopbouw','Vitrage','Glazing','glas','single',true,null,6,'Ug-waarden zijn demowaarden.'),
 ('beslag','Beslag','Quincaillerie','Hardware','accessoires','single',true,'{raam,deur,schuifraam}',7,null),
 ('ventilatie','Ventilatie','Ventilation','Ventilation','accessoires','single',false,'{raam,schuifraam,vast}',8,null),
 ('vliegenraam','Vliegenraam','Moustiquaire','Insect screen','accessoires','single',false,'{raam,deur,schuifraam}',9,null),
 ('zonwering','Rolluik / screen','Volet / screen','Shutter / screen','accessoires','single',false,'{raam,schuifraam,vast}',10,null),
 ('dorpel','Dorpel','Seuil','Threshold','accessoires','single',true,'{deur}',11,null),
 ('diensten','Diensten','Services','Services','diensten','multi',false,null,12,null);

insert into public.option_values (option_id, code, name_nl, name_fr, name_en, attributes, sort)
select o.id, v.code, v.nl, v.fr, v.en, v.attr::jsonb, v.sort
from (values
 ('material','pvc','PVC','PVC','PVC','{}',1),
 ('material','alu','Aluminium','Aluminium','Aluminium','{}',2),
 ('material','hout','Hout','Bois','Wood','{}',3),
 ('opening','vast','Vast','Fixe','Fixed','{"needs_hinge":false}',1),
 ('opening','draai','Draai','Battant','Side hung','{"needs_hinge":true}',2),
 ('opening','kiep','Kiep','Basculant','Bottom hung','{"needs_hinge":false}',3),
 ('opening','draaikiep','Draai-kiep','Oscillo-battant','Tilt & turn','{"needs_hinge":true}',4),
 ('opening','schuif','Schuivend','Coulissant','Sliding','{"needs_hinge":false}',5),
 ('opening','deur_binnen','Deur, naar binnen draaiend','Porte, ouvrant intérieur','Door, inward opening','{"needs_hinge":true}',6),
 ('opening','deur_buiten','Deur, naar buiten draaiend','Porte, ouvrant extérieur','Door, outward opening','{"needs_hinge":true}',7),
 ('hinge','links','Links','Gauche','Left','{}',1),
 ('hinge','rechts','Rechts','Droite','Right','{}',2),
 ('kleur_binnen','wit','Wit (RAL 9016)','Blanc (RAL 9016)','White (RAL 9016)','{"hex":"#f1f0ea"}',1),
 ('kleur_binnen','cremewit','Crèmewit (RAL 9001)','Blanc crème (RAL 9001)','Cream (RAL 9001)','{"hex":"#e9e0d0"}',2),
 ('kleur_binnen','antraciet','Antraciet (RAL 7016)','Anthracite (RAL 7016)','Anthracite (RAL 7016)','{"hex":"#383e42"}',3),
 ('kleur_binnen','zwart','Zwart (RAL 9005)','Noir (RAL 9005)','Black (RAL 9005)','{"hex":"#16181a"}',4),
 ('kleur_binnen','eik','Golden oak (folie)','Chêne doré (film)','Golden oak (foil)','{"hex":"#9a6a3a"}',5),
 ('kleur_binnen','hout_naturel','Naturel geolied hout','Bois huilé naturel','Natural oiled wood','{"hex":"#b07a4a"}',6),
 ('kleur_binnen','hout_wit','Wit gelakt hout','Bois laqué blanc','White lacquered wood','{"hex":"#f3f1ea"}',7),
 ('kleur_buiten','wit','Wit (RAL 9016)','Blanc (RAL 9016)','White (RAL 9016)','{"hex":"#f1f0ea"}',1),
 ('kleur_buiten','cremewit','Crèmewit (RAL 9001)','Blanc crème (RAL 9001)','Cream (RAL 9001)','{"hex":"#e9e0d0"}',2),
 ('kleur_buiten','antraciet','Antraciet (RAL 7016)','Anthracite (RAL 7016)','Anthracite (RAL 7016)','{"hex":"#383e42"}',3),
 ('kleur_buiten','zwart','Zwart (RAL 9005)','Noir (RAL 9005)','Black (RAL 9005)','{"hex":"#16181a"}',4),
 ('kleur_buiten','eik','Golden oak (folie)','Chêne doré (film)','Golden oak (foil)','{"hex":"#9a6a3a"}',5),
 ('kleur_buiten','hout_naturel','Naturel geolied hout','Bois huilé naturel','Natural oiled wood','{"hex":"#b07a4a"}',6),
 ('kleur_buiten','hout_wit','Wit gelakt hout','Bois laqué blanc','White lacquered wood','{"hex":"#f3f1ea"}',7),
 ('glas','dubbel_hr','Dubbel HR-glas (demo Ug 1,0)','Double vitrage HR (démo Ug 1,0)','Double HR glazing (demo Ug 1.0)','{"ug_demo":1.0}',1),
 ('glas','triple','Driedubbel glas (demo Ug 0,6)','Triple vitrage (démo Ug 0,6)','Triple glazing (demo Ug 0.6)','{"ug_demo":0.6}',2),
 ('glas','gelaagd','Gelaagd veiligheidsglas 33.1 (demo)','Verre feuilleté 33.1 (démo)','Laminated safety glass 33.1 (demo)','{"ug_demo":1.1}',3),
 ('glas','akoestisch','Akoestisch dubbel glas (demo)','Vitrage acoustique (démo)','Acoustic double glazing (demo)','{"ug_demo":1.1}',4),
 ('glas','mat','Dubbel glas mat/satijn','Double vitrage satiné','Satin double glazing','{"ug_demo":1.0}',5),
 ('beslag','standaard','Standaard beslag','Quincaillerie standard','Standard hardware','{}',1),
 ('beslag','verborgen','Verborgen scharnieren','Paumelles invisibles','Concealed hinges','{}',2),
 ('beslag','inbraak','Inbraakwerend beslag (RC2-voorbereid)','Quincaillerie anti-effraction (RC2)','Burglar-resistant hardware (RC2-ready)','{}',3),
 ('ventilatie','geen','Geen ventilatie','Sans ventilation','No ventilation','{}',1),
 ('ventilatie','rooster','Ventilatierooster standaard','Grille de ventilation','Trickle vent','{}',2),
 ('ventilatie','rooster_ak','Ventilatierooster akoestisch','Grille acoustique','Acoustic trickle vent','{}',3),
 ('vliegenraam','geen','Geen vliegenraam','Sans moustiquaire','No insect screen','{}',1),
 ('vliegenraam','inzet','Inzetvliegenraam','Moustiquaire encastrable','Insert insect screen','{}',2),
 ('vliegenraam','plisse','Plissévliegenraam/-deur','Moustiquaire plissée','Pleated insect screen','{}',3),
 ('zonwering','geen','Geen rolluik of screen','Sans volet','None','{}',1),
 ('zonwering','rolluik_man','Rolluik manueel','Volet manuel','Manual roller shutter','{}',2),
 ('zonwering','rolluik_el','Rolluik elektrisch','Volet électrique','Electric roller shutter','{}',3),
 ('zonwering','screen','Screen elektrisch','Screen électrique','Electric screen','{}',4),
 ('dorpel','alu_laag','Lage aluminium dorpel (20 mm)','Seuil alu bas (20 mm)','Low aluminium threshold (20 mm)','{}',1),
 ('dorpel','pvc_dorpel','PVC-dorpel','Seuil PVC','PVC threshold','{}',2),
 ('diensten','opmeting','Opmeting ter plaatse','Mesurage sur place','On-site survey','{}',1),
 ('diensten','transport','Transport','Transport','Transport','{}',2),
 ('diensten','plaatsing','Plaatsing','Pose','Installation','{}',3),
 ('diensten','afbraak','Afbraak bestaand schrijnwerk','Démontage de l''existant','Removal of existing frames','{}',4),
 ('diensten','afvoer','Afvoer oud materiaal','Évacuation','Disposal','{}',5)
) as v(opt, code, nl, fr, en, attr, sort)
join public.options o on o.code = v.opt;

insert into public.products (code, family_code, name, description, default_config, sort) values
 ('RAAM-DK1','raam','Draai-kiepraam 1-vaks','Klassiek opengaand raam.',
  '{"family":"raam","material":"pvc","system":"PVC-70","width_mm":1000,"height_mm":1200,"quantity":1,"sections":[{"opening":"draaikiep","hinge":"links"}],"values":{"kleur_binnen":"wit","kleur_buiten":"wit","glas":"dubbel_hr","beslag":"standaard","ventilatie":"geen","vliegenraam":"geen","zonwering":"geen"},"services":["opmeting","plaatsing"]}',1),
 ('RAAM-2V','raam','Raam 2-vaks (draai-kiep + vast)','Breed raam met één opengaand en één vast vak.',
  '{"family":"raam","material":"pvc","system":"PVC-70","width_mm":1800,"height_mm":1300,"quantity":1,"sections":[{"opening":"draaikiep","hinge":"links"},{"opening":"vast"}],"values":{"kleur_binnen":"wit","kleur_buiten":"wit","glas":"dubbel_hr","beslag":"standaard","ventilatie":"geen","vliegenraam":"geen","zonwering":"geen"},"services":["opmeting","plaatsing"]}',2),
 ('DEUR-VD','deur','Voor- of achterdeur, enkel','Enkele deur met lage dorpel.',
  '{"family":"deur","material":"alu","system":"ALU-75","width_mm":1000,"height_mm":2200,"quantity":1,"sections":[{"opening":"deur_binnen","hinge":"rechts"}],"values":{"kleur_binnen":"antraciet","kleur_buiten":"antraciet","glas":"gelaagd","beslag":"standaard","vliegenraam":"geen","dorpel":"alu_laag"},"services":["opmeting","plaatsing"]}',3),
 ('SCHUIF-2','schuifraam','Schuifraam 2-delig','Eén schuivend en één vast deel.',
  '{"family":"schuifraam","material":"alu","system":"ALU-SL160","width_mm":3000,"height_mm":2200,"quantity":1,"sections":[{"opening":"schuif"},{"opening":"vast"}],"values":{"kleur_binnen":"wit","kleur_buiten":"antraciet","glas":"dubbel_hr","beslag":"standaard","ventilatie":"geen","vliegenraam":"geen","zonwering":"geen"},"services":["opmeting","transport","plaatsing"]}',4),
 ('VAST-1','vast','Vast raam','Vaste beglazing zonder opengaand deel.',
  '{"family":"vast","material":"pvc","system":"PVC-70","width_mm":800,"height_mm":1000,"quantity":1,"sections":[{"opening":"vast"}],"values":{"kleur_binnen":"wit","kleur_buiten":"wit","glas":"dubbel_hr","ventilatie":"geen","zonwering":"geen"},"services":["plaatsing"]}',5);

insert into public.configuration_rules (code, name, rule_type, conditions, params, message, severity) values
 ('R-OPEN-RAAM','Openingswijzen raam','restrict_values','[{"field":"family","op":"eq","value":"raam"}]','{"field":"opening","values":["vast","draai","kiep","draaikiep"]}','Bij een raam zijn enkel vast, draai, kiep en draai-kiep mogelijk.','error'),
 ('R-OPEN-DEUR','Openingswijzen deur','restrict_values','[{"field":"family","op":"eq","value":"deur"}]','{"field":"opening","values":["deur_binnen","deur_buiten","vast"]}','Bij een deur kies je een naar binnen of naar buiten draaiende deur (of een vast zijlicht).','error'),
 ('R-OPEN-SCHUIF','Openingswijzen schuifraam','restrict_values','[{"field":"family","op":"eq","value":"schuifraam"}]','{"field":"opening","values":["schuif","vast"]}','Een schuifraam bestaat uit schuivende en vaste delen.','error'),
 ('R-OPEN-VAST','Vast element','restrict_values','[{"field":"family","op":"eq","value":"vast"}]','{"field":"opening","values":["vast"]}','Een vast element heeft geen opengaande vakken.','error'),
 ('R-MAT-HOUT','Hout niet voor schuif/vast','restrict_values','[{"field":"family","op":"in","value":["schuifraam","vast"]}]','{"field":"material","values":["pvc","alu"]}','Hout is in deze demo niet beschikbaar voor schuiframen of vaste elementen.','error'),
 ('R-KLEUR-PVC-B','Kleuren PVC binnen','restrict_values','[{"field":"material","op":"eq","value":"pvc"}]','{"field":"kleur_binnen","values":["wit","cremewit","antraciet","eik"]}','Deze kleur bestaat niet voor PVC-profielen.','error'),
 ('R-KLEUR-PVC-O','Kleuren PVC buiten','restrict_values','[{"field":"material","op":"eq","value":"pvc"}]','{"field":"kleur_buiten","values":["wit","cremewit","antraciet","eik"]}','Deze kleur bestaat niet voor PVC-profielen.','error'),
 ('R-KLEUR-ALU-B','Kleuren aluminium binnen','restrict_values','[{"field":"material","op":"eq","value":"alu"}]','{"field":"kleur_binnen","values":["wit","cremewit","antraciet","zwart"]}','Aluminium wordt in de demo enkel gelakt in RAL-kleuren.','error'),
 ('R-KLEUR-ALU-O','Kleuren aluminium buiten','restrict_values','[{"field":"material","op":"eq","value":"alu"}]','{"field":"kleur_buiten","values":["wit","cremewit","antraciet","zwart"]}','Aluminium wordt in de demo enkel gelakt in RAL-kleuren.','error'),
 ('R-KLEUR-HOUT-B','Kleuren hout binnen','restrict_values','[{"field":"material","op":"eq","value":"hout"}]','{"field":"kleur_binnen","values":["hout_naturel","hout_wit"]}','Hout is enkel naturel geolied of wit gelakt beschikbaar.','error'),
 ('R-KLEUR-HOUT-O','Kleuren hout buiten','restrict_values','[{"field":"material","op":"eq","value":"hout"}]','{"field":"kleur_buiten","values":["hout_naturel","hout_wit"]}','Hout is enkel naturel geolied of wit gelakt beschikbaar.','error'),
 ('R-GLAS-PVC70','Geen driedubbel glas in PVC 70','exclude_values','[{"field":"system","op":"eq","value":"PVC-70"}]','{"field":"glas","values":["triple"]}','Het demoprofiel PVC 70 heeft een te smalle glassponning voor driedubbel glas. Kies PVC 82 of aluminium.','error'),
 ('R-DEUR-GLAS','Deur vereist veiligheidsglas','requires_value','[{"field":"family","op":"eq","value":"deur"}]','{"field":"glas","values":["gelaagd"]}','Een deur vereist gelaagd veiligheidsglas (demoregel).','error'),
 ('R-INBRAAK-GLAS','Inbraakwerend beslag vereist gelaagd glas','requires_value','[{"field":"beslag","op":"eq","value":"inbraak"}]','{"field":"glas","values":["gelaagd"]}','Inbraakwerend beslag heeft alleen zin met gelaagd glas.','error'),
 ('R-SCREEN-BREED','Screen maximaal 3000 mm','forbid','[{"field":"zonwering","op":"eq","value":"screen"},{"field":"width_mm","op":"gt","value":3000}]','{"field":"zonwering"}','Een elektrische screen is in de demo beperkt tot 3000 mm breedte.','error'),
 ('R-VAK-BREED','Draaiend vak maximaal 1300 mm','forbid','[{"field":"opening","op":"in","value":["draai","draaikiep"]},{"field":"max_section_width_mm","op":"gt","value":1300}]','{"field":"sections"}','Een draaiend vak mag in de demo maximaal 1300 mm breed zijn. Verdeel het element in meer vakken.','error'),
 ('R-GROOT-WAARSCHUWING','Groot raamoppervlak','forbid','[{"field":"family","op":"eq","value":"raam"},{"field":"area_m2","op":"gt","value":4}]','{"field":"width_mm"}','Groot raamoppervlak: laat de stabiliteit nakijken door engineering.','warning'),
 ('D-PVC70-RAAM','Afmetingen PVC 70 raam/vast','dimension_limit','[{"field":"system","op":"eq","value":"PVC-70"},{"field":"family","op":"in","value":["raam","vast"]}]','{"min_width":400,"max_width":2400,"min_height":400,"max_height":2400,"max_area_m2":4.5}','PVC 70 raam (demogrens)','error'),
 ('D-PVC82-RAAM','Afmetingen PVC 82 raam/vast','dimension_limit','[{"field":"system","op":"eq","value":"PVC-82"},{"field":"family","op":"in","value":["raam","vast"]}]','{"min_width":400,"max_width":2600,"min_height":400,"max_height":2600,"max_area_m2":5}','PVC 82 raam (demogrens)','error'),
 ('D-ALU75-RAAM','Afmetingen ALU 75 raam/vast','dimension_limit','[{"field":"system","op":"eq","value":"ALU-75"},{"field":"family","op":"in","value":["raam","vast"]}]','{"min_width":350,"max_width":3000,"min_height":350,"max_height":3000,"max_area_m2":6}','ALU 75 raam (demogrens)','error'),
 ('D-PVC70-DEUR','Afmetingen PVC 70 deur','dimension_limit','[{"field":"system","op":"eq","value":"PVC-70"},{"field":"family","op":"eq","value":"deur"}]','{"min_width":800,"max_width":1200,"min_height":1900,"max_height":2400}','PVC 70 deur (demogrens)','error'),
 ('D-ALU75-DEUR','Afmetingen ALU 75 deur','dimension_limit','[{"field":"system","op":"eq","value":"ALU-75"},{"field":"family","op":"eq","value":"deur"}]','{"min_width":800,"max_width":1300,"min_height":1900,"max_height":2600}','ALU 75 deur (demogrens)','error'),
 ('D-SL160','Afmetingen ALU schuif 160','dimension_limit','[{"field":"system","op":"eq","value":"ALU-SL160"}]','{"min_width":1800,"max_width":6000,"min_height":1800,"max_height":2800}','ALU schuif 160 (demogrens)','error'),
 ('A-ALU75-DORPEL','Lage dorpel bij ALU 75-deur','auto_include','[{"field":"family","op":"eq","value":"deur"},{"field":"system","op":"eq","value":"ALU-75"}]','{"field":"dorpel","value":"alu_laag"}','Bij het ALU 75-deursysteem is de lage aluminium dorpel automatisch inbegrepen.','error'),
 ('A-ROLLUIK-PLAATSING','Plaatsing bij elektrisch rolluik','auto_include','[{"field":"zonwering","op":"in","value":["rolluik_el","screen"]}]','{"field":"diensten","value":"plaatsing"}','Elektrische zonwering wordt altijd door ons geplaatst en aangesloten.','error'),
 ('S-TWEEKLEURIG','Toeslag tweekleurig','surcharge','[{"field":"kleur_buiten","op":"neq_field","value":"kleur_binnen"}]','{"label":"Toeslag afwijkende kleur binnen/buiten","unit":"percent","amount":12}','Afwijkende kleur binnen en buiten.','error'),
 ('S-GROOT-FORMAAT','Toeslag groot formaat','surcharge','[{"field":"area_m2","op":"gt","value":3}]','{"label":"Toeslag groot formaat (hantering)","unit":"piece","amount":65}','Elementen groter dan 3 m².','error'),
 ('S-FOLIE-PVC','Toeslag folie buiten PVC','surcharge','[{"field":"material","op":"eq","value":"pvc"},{"field":"kleur_buiten","op":"in","value":["antraciet","eik"]}]','{"label":"Toeslag foliëring buitenzijde","unit":"m2","amount":38}','Gefolieerde buitenzijde op PVC.','error'),
 ('P-INBRAAK','RC2-certificatie','placeholder','[{"field":"beslag","op":"eq","value":"inbraak"}]','{}','RC2-regels (sluitpunten per vak, glasklasse, montage) nog aan te leveren door Techwin.','error'),
 ('P-HST','Hefschuif PVC','placeholder','[{"field":"system","op":"eq","value":"PVC-HST"}]','{}','Hefschuifbeslag en gewichtsgrenzen van het PVC-hefschuifsysteem zijn nog niet aangeleverd.','error');

insert into public.price_book_entries (price_book_id, entry_type, system_code, amount, unit, label)
select pb.id, 'base', v.code, v.amount, 'piece', 'Basisprijs ' || v.name
from public.price_books pb, (values
 ('PVC-70',95,'Demo PVC 70'),('PVC-82',125,'Demo PVC 82'),('ALU-75',185,'Demo ALU 75'),
 ('ALU-SL160',420,'Demo ALU Schuif 160'),('PVC-HST',380,'Demo PVC Hefschuif'),('HOUT-68',210,'Demo Hout 68')
) as v(code, amount, name) where pb.code = 'PB-STD-2026';

insert into public.price_book_entries (price_book_id, entry_type, system_code, width_upto, height_upto, amount, unit)
select pb.id, 'matrix', s.code, w.w, h.h,
  round(s.m2::numeric * w.w::numeric * h.h::numeric / 1000000.0 + s.per::numeric * 2 * (w.w + h.h)::numeric / 1000.0, 2), 'piece'
from public.price_books pb
cross join (values
 ('PVC-70',165,22,array[600,800,1000,1200,1400,1600,1800,2000,2400],array[600,800,1000,1200,1400,1600,1800,2000,2200,2400]),
 ('PVC-82',195,26,array[600,800,1000,1200,1400,1600,1800,2000,2400,2600],array[600,800,1000,1200,1400,1600,1800,2000,2200,2400,2600]),
 ('ALU-75',290,38,array[600,800,1000,1200,1400,1600,1800,2000,2400,2600,3000],array[600,800,1000,1200,1400,1600,1800,2000,2200,2400,2600,3000]),
 ('ALU-SL160',340,45,array[2000,2400,3000,3500,4000,5000,6000],array[2000,2200,2400,2600,2800]),
 ('PVC-HST',300,40,array[2000,2400,3000,3500,4000,5000],array[2000,2200,2400,2600]),
 ('HOUT-68',260,34,array[600,800,1000,1200,1400,1600,1800,2000,2400],array[600,800,1000,1200,1400,1600,1800,2000,2200,2400])
) as s(code, m2, per, widths, heights)
cross join lateral unnest(s.widths) as w(w)
cross join lateral unnest(s.heights) as h(h)
where pb.code = 'PB-STD-2026';

insert into public.price_book_entries (price_book_id, entry_type, option_code, value_code, component_code, amount, unit, label)
select pb.id, v.t, v.opt, v.val, v.comp, v.amount, v.unit, v.label
from public.price_books pb, (values
 ('option','opening','draai',null,85,'per_section',null),
 ('option','opening','kiep',null,70,'per_section',null),
 ('option','opening','draaikiep',null,120,'per_section',null),
 ('option','opening','schuif',null,260,'per_section',null),
 ('option','opening','deur_binnen',null,340,'per_section',null),
 ('option','opening','deur_buiten',null,360,'per_section',null),
 ('option','glas','triple',null,48,'m2',null),
 ('option','glas','gelaagd',null,36,'m2',null),
 ('option','glas','akoestisch',null,52,'m2',null),
 ('option','glas','mat',null,28,'m2',null),
 ('option','beslag','verborgen',null,75,'per_section',null),
 ('option','beslag','inbraak',null,140,'per_section',null),
 ('option','vliegenraam','inzet',null,95,'piece',null),
 ('option','vliegenraam','plisse',null,240,'piece',null),
 ('option','zonwering','rolluik_man',null,210,'m_width',null),
 ('option','zonwering','rolluik_el',null,330,'m_width',null),
 ('option','zonwering','screen',null,360,'m_width',null),
 ('option','dorpel','alu_laag',null,85,'piece',null),
 ('option','dorpel','pvc_dorpel',null,45,'piece',null),
 ('service',null,'opmeting',null,35,'piece','Opmeting ter plaatse'),
 ('service',null,'transport',null,25,'piece','Transport'),
 ('service',null,'plaatsing',null,85,'m2','Plaatsing'),
 ('service',null,'afbraak',null,60,'piece','Afbraak bestaand schrijnwerk'),
 ('service',null,'afvoer',null,20,'piece','Afvoer oud materiaal'),
 ('labour',null,'montage',null,40,'piece','Assemblage in werkplaats'),
 ('component',null,null,'VENT-STD',42,'unit','Ventilatierooster standaard'),
 ('component',null,null,'VENT-AK',68,'unit','Ventilatierooster akoestisch')
) as v(t, opt, val, comp, amount, unit, label) where pb.code = 'PB-STD-2026';

insert into public.discounts (discount_type, role, min_quantity, percent, approval_above_percent, label) values
 ('quantity',null,5,3,null,'Hoeveelheidskorting vanaf 5 stuks'),
 ('quantity',null,10,5,null,'Hoeveelheidskorting vanaf 10 stuks'),
 ('quantity',null,20,7,null,'Hoeveelheidskorting vanaf 20 stuks'),
 ('role_limit','verkoper',null,15,8,'Verkoper: max 15%, goedkeuring boven 8%'),
 ('role_limit','manager',null,30,30,'Manager: max 30%'),
 ('role_limit','productbeheerder',null,0,0,'Productbeheerder: geen korting'),
 ('role_limit','productie',null,0,0,'Productie: geen korting'),
 ('margin_threshold',null,null,25,null,'Minimummarge 25%');

insert into public.bom_templates (code, name, conditions, geometry_ref, sort) values
 ('T-KADER','Kader','[]','frame',1),
 ('T-VLEUGEL','Vleugels (opengaande vakken)','[{"field":"section_open_count","op":"gt","value":0}]','sash',2),
 ('T-STIJL','Tussenstijlen','[{"field":"section_count","op":"gt","value":1}]','mullion',3),
 ('T-GLAS','Beglazing','[]','glass',4),
 ('T-BESLAG','Beslag','[{"field":"section_open_count","op":"gt","value":0}]','sash',5),
 ('T-DORPEL','Dorpel','[{"field":"family","op":"eq","value":"deur"}]','threshold',6),
 ('T-VENT','Ventilatie','[{"field":"ventilatie","op":"in","value":["rooster","rooster_ak"]}]','vent',7),
 ('T-ZONW','Zonwering','[{"field":"zonwering","op":"in","value":["rolluik_man","rolluik_el","screen"]}]','shutter',8),
 ('T-VLIEG','Vliegenraam','[{"field":"vliegenraam","op":"in","value":["inzet","plisse"]}]','sash',9),
 ('T-VERP','Verpakking en etikettering','[]',null,10);

insert into public.bom_lines (template_id, component_code, description, qty_basis, qty_factor, unit, conditions, geometry_ref, sort)
select t.id, v.comp, v.descr, v.basis, v.factor, v.unit, v.cond::jsonb, v.geo, v.sort
from (values
 ('T-KADER','PRF-{system}-KADER','Kaderprofiel {system} (incl. 5 % zaagverlies)','perimeter_m',1.05,'m','[]','frame',1),
 ('T-KADER','WAP-STAAL','Stalen wapening kader','perimeter_m',1,'m','[{"field":"material","op":"eq","value":"pvc"}]','frame',2),
 ('T-KADER','HOEKVERB-{material}','Hoekverbinding','fixed',4,'st','[]','frame',3),
 ('T-KADER','DICHT-KADER','Kaderdichting EPDM','perimeter_m',1,'m','[]','frame',4),
 ('T-VLEUGEL','PRF-{system}-VLEUGEL','Vleugelprofiel {system}','sash_perimeter_m',1.05,'m','[]','sash',1),
 ('T-VLEUGEL','DICHT-VLEUGEL','Vleugeldichting','sash_perimeter_m',1,'m','[]','sash',2),
 ('T-STIJL','PRF-{system}-STIJL','Tussenstijl {system}','mullion_m',1.02,'m','[]','mullion',1),
 ('T-GLAS','GLAS-{glas}','Glas: {glas}','glass_area_m2',1,'m²','[]','glass',1),
 ('T-GLAS','GLASLAT-{material}','Glaslat','perimeter_m',1.1,'m','[]','glass',2),
 ('T-GLAS','GLASBLOK','Glasblokjes','per_section',6,'st','[]','glass',3),
 ('T-BESLAG','BSL-{beslag}','Beslagset: {beslag}','per_opening_section',1,'set','[]','sash',1),
 ('T-BESLAG','KRUK-STD','Raamkruk / deurkruk','per_opening_section',1,'st','[]','sash',2),
 ('T-DORPEL','DORPEL-{dorpel}','Dorpel: {dorpel}','width_m',1,'m','[]','threshold',1),
 ('T-VENT','VENT-STD','Ventilatierooster standaard','width_m',1,'m','[{"field":"ventilatie","op":"eq","value":"rooster"}]','vent',1),
 ('T-VENT','VENT-AK','Ventilatierooster akoestisch','width_m',1,'m','[{"field":"ventilatie","op":"eq","value":"rooster_ak"}]','vent',2),
 ('T-ZONW','ROLLUIKKAST','Rolluikkast','width_m',1,'m','[{"field":"zonwering","op":"in","value":["rolluik_man","rolluik_el"]}]','shutter',1),
 ('T-ZONW','LAMELLEN-ALU','Rolluiklamellen aluminium','area_m2',1.1,'m²','[{"field":"zonwering","op":"in","value":["rolluik_man","rolluik_el"]}]','shutter',2),
 ('T-ZONW','MOTOR-RL','Buismotor rolluik','fixed',1,'st','[{"field":"zonwering","op":"eq","value":"rolluik_el"}]','shutter',3),
 ('T-ZONW','SCREENKAST','Screenkast met geleiders','width_m',1,'m','[{"field":"zonwering","op":"eq","value":"screen"}]','shutter',4),
 ('T-ZONW','SCREENDOEK','Screendoek','area_m2',1.05,'m²','[{"field":"zonwering","op":"eq","value":"screen"}]','shutter',5),
 ('T-ZONW','MOTOR-SCR','Motor screen','fixed',1,'st','[{"field":"zonwering","op":"eq","value":"screen"}]','shutter',6),
 ('T-VLIEG','VLR-{vliegenraam}','Vliegenraam: {vliegenraam}','per_piece',1,'st','[]','sash',1),
 ('T-VERP','VERP-STD','Verpakking, hoekbeschermers en etiket','fixed',1,'st','[]',null,1)
) as v(tpl, comp, descr, basis, factor, unit, cond, geo, sort)
join public.bom_templates t on t.code = v.tpl;

insert into public.component_costs (component_code, unit_cost, unit, description)
select 'PRF-' || s.code || '-' || p.part, round((s.base * p.f)::numeric, 4), 'm', 'Profiel ' || p.part || ' ' || s.code
from (values ('PVC-70',7.4),('PVC-82',9.1),('ALU-75',16.5),('ALU-SL160',24.0),('PVC-HST',14.0),('HOUT-68',13.2)) as s(code, base)
cross join (values ('KADER',1.0),('VLEUGEL',0.95),('STIJL',1.1)) as p(part, f);

insert into public.component_costs (component_code, unit_cost, unit, description) values
 ('WAP-STAAL',3.10,'m','Stalen wapening'),
 ('HOEKVERB-pvc',0.60,'st','Hoekverbinding PVC'),('HOEKVERB-alu',1.80,'st','Hoekverbinding alu'),('HOEKVERB-hout',1.20,'st','Hoekverbinding hout'),
 ('DICHT-KADER',0.85,'m','Kaderdichting'),('DICHT-VLEUGEL',0.75,'m','Vleugeldichting'),
 ('GLAS-dubbel_hr',38,'m²','Dubbel HR-glas'),('GLAS-triple',62,'m²','Driedubbel glas'),('GLAS-gelaagd',58,'m²','Gelaagd glas'),
 ('GLAS-akoestisch',66,'m²','Akoestisch glas'),('GLAS-mat',49,'m²','Mat glas'),
 ('GLASLAT-pvc',1.20,'m','Glaslat PVC'),('GLASLAT-alu',2.40,'m','Glaslat alu'),('GLASLAT-hout',2.10,'m','Glaslat hout'),
 ('GLASBLOK',0.08,'st','Glasblokje'),
 ('BSL-standaard',28,'set','Beslagset standaard'),('BSL-verborgen',61,'set','Beslagset verborgen'),('BSL-inbraak',95,'set','Beslagset inbraakwerend'),
 ('KRUK-STD',6.5,'st','Kruk'),
 ('DORPEL-alu_laag',31,'m','Lage alu dorpel'),('DORPEL-pvc_dorpel',14,'m','PVC-dorpel'),
 ('VENT-STD',17,'m','Ventilatierooster'),('VENT-AK',31,'m','Ventilatierooster akoestisch'),
 ('ROLLUIKKAST',46,'m','Rolluikkast'),('LAMELLEN-ALU',24,'m²','Lamellen'),('MOTOR-RL',78,'st','Buismotor'),
 ('SCREENKAST',58,'m','Screenkast'),('SCREENDOEK',19,'m²','Screendoek'),('MOTOR-SCR',96,'st','Screenmotor'),
 ('VLR-inzet',34,'st','Inzetvliegenraam'),('VLR-plisse',112,'st','Plissévliegenraam'),
 ('VERP-STD',4.5,'st','Verpakking'),
 ('DIENST:opmeting',22,'st','Kost opmeting'),('DIENST:transport',14,'st','Kost transport'),('DIENST:plaatsing',52,'m²','Kost plaatsing'),
 ('DIENST:afbraak',38,'st','Kost afbraak'),('DIENST:afvoer',12,'st','Kost afvoer'),('ARBEID:montage',24,'st','Kost assemblage');

insert into public.quote_templates (code, name, intro_text, conditions_text, validity_days, is_default) values
 ('STD','Standaardofferte particulier',
  'Beste klant, hartelijk dank voor uw interesse. Hieronder vindt u onze vrijblijvende offerte voor het geplande schrijnwerk.',
  'Levering en plaatsing volgens definitieve opmeting ter plaatse. Indicatieve levertermijn: 8 à 10 weken na akkoord en opmeting. Betaling: 30 % voorschot bij bestelling, saldo na plaatsing. Btw-tarief volgens attest; 6 % enkel bij renovatie van woningen ouder dan 10 jaar. Deze offerte bevat uitsluitend DEMO-prijzen en is niet bindend.',
  30, true),
 ('PRO','Offerte aannemer / dealer',
  'Geachte, in bijlage onze prijsofferte volgens uw aanvraag en de ontvangen plannen.',
  'Levering af fabriek of op werf (zie diensten). Plaatsing enkel indien vermeld. Betaling 30 dagen na factuurdatum. Prijzen excl. btw tenzij anders vermeld. DEMO-offerte: niet gebruiken voor verkoop.',
  45, false);

insert into public.companies (id, name, company_type, vat_number, email, phone, street, postal_code, city, price_book_id, notes, created_by) values
 ('c0000000-0000-4000-8000-000000000001','Familie Peeters (demo)','particulier',null,'peeters@example.com','+32 470 00 00 01','Kapelstraat 12','2800','Mechelen',null,'Renovatie rijwoning uit 1972.',null),
 ('c0000000-0000-4000-8000-000000000002','Bouwbedrijf Van Damme & Zonen (demo)','aannemer','BE0000.000.001','info@vandamme.example.com','+32 56 00 00 02','Industrielaan 4','8500','Kortrijk',null,'Hoofdaannemer nieuwbouwprojecten.',null),
 ('c0000000-0000-4000-8000-000000000003','Raamcentrum Kempen (demo)','dealer','BE0000.000.002','verkoop@kempen.example.com','+32 14 00 00 03','Markt 7','2440','Geel',(select id from public.price_books where code='PB-DEALER-2026'),'Dealer, gebruikt dealerprijsboek.',null),
 ('c0000000-0000-4000-8000-000000000004','Architectenbureau Lijn & Licht (demo)','architect','BE0000.000.003','studio@lijnlicht.example.com','+32 9 000 00 04','Veldstraat 88','9000','Gent',null,'Voorschrijver; nog geen project.',null);

insert into public.contacts (id, company_id, first_name, last_name, email, phone, job_title, is_primary) values
 ('d0000000-0000-4000-8000-000000000001','c0000000-0000-4000-8000-000000000001','An','Peeters','an.peeters@example.com','+32 470 00 00 11',null,true),
 ('d0000000-0000-4000-8000-000000000002','c0000000-0000-4000-8000-000000000002','Pieter','Van Damme','pieter@vandamme.example.com','+32 476 00 00 12','Projectleider',true),
 ('d0000000-0000-4000-8000-000000000003','c0000000-0000-4000-8000-000000000002','Sofie','Claes','sofie@vandamme.example.com','+32 476 00 00 13','Calculator',false),
 ('d0000000-0000-4000-8000-000000000004','c0000000-0000-4000-8000-000000000003','Wim','Janssens','wim@kempen.example.com','+32 477 00 00 14','Zaakvoerder',true),
 ('d0000000-0000-4000-8000-000000000005','c0000000-0000-4000-8000-000000000004','Lotte','De Smet','lotte@lijnlicht.example.com','+32 478 00 00 15','Architect',true);

insert into public.projects (id, project_number, name, company_id, contact_id, street, postal_code, city, owner_id, status, desired_delivery_date, vat_rate, notes, created_by) values
 ('e0000000-0000-4000-8000-000000000001','P-2026-0001','Renovatie woning Peeters','c0000000-0000-4000-8000-000000000001','d0000000-0000-4000-8000-000000000001','Kapelstraat 12','2800','Mechelen',null,'offerte','2027-03-15',6,'Klant twijfelt tussen PVC en aluminium. Woning ouder dan 10 jaar: 6 % btw.',null),
 ('e0000000-0000-4000-8000-000000000002','P-2026-0002','Nieuwbouw kantoor Kortrijk','c0000000-0000-4000-8000-000000000002','d0000000-0000-4000-8000-000000000002','Industrielaan 6','8500','Kortrijk',null,'offerte','2027-02-01',21,'Gevelelementen volgens plan architect (fictief).',null),
 ('e0000000-0000-4000-8000-000000000003','P-2026-0003','Showroom Kempen','c0000000-0000-4000-8000-000000000003','d0000000-0000-4000-8000-000000000004','Markt 7','2440','Geel',null,'in_opmaak','2027-04-30',21,'Dealerproject met houten etalageraam.',null);
select setval('public.project_number_seq', 3);

insert into public.project_items (id, project_id, seq, label) values
 ('f1000000-0000-4000-8000-000000000001','e0000000-0000-4000-8000-000000000001',1,'Raam leefruimte 01'),
 ('f1000000-0000-4000-8000-000000000002','e0000000-0000-4000-8000-000000000001',2,'Raam leefruimte 02'),
 ('f1000000-0000-4000-8000-000000000003','e0000000-0000-4000-8000-000000000001',3,'Raam keuken 01'),
 ('f1000000-0000-4000-8000-000000000004','e0000000-0000-4000-8000-000000000001',4,'Achterdeur 01'),
 ('f1000000-0000-4000-8000-000000000005','e0000000-0000-4000-8000-000000000001',5,'Schuifraam tuin 01'),
 ('f2000000-0000-4000-8000-000000000001','e0000000-0000-4000-8000-000000000002',1,'Vast raam gevel 01'),
 ('f2000000-0000-4000-8000-000000000002','e0000000-0000-4000-8000-000000000002',2,'Raam vergaderzaal 01'),
 ('f2000000-0000-4000-8000-000000000003','e0000000-0000-4000-8000-000000000002',3,'Inkomdeur 01'),
 ('f3000000-0000-4000-8000-000000000001','e0000000-0000-4000-8000-000000000003',1,'Houten raam etalage 01'),
 ('f3000000-0000-4000-8000-000000000002','e0000000-0000-4000-8000-000000000003',2,'Raam kantoor 01');

insert into public.configurations (id, project_id, name, description, is_primary, source_configuration_id) values
 ('a1000000-0000-4000-8000-000000000001','e0000000-0000-4000-8000-000000000001','Basis – PVC 70','Hoofdvoorstel in PVC.',true,null),
 ('a1000000-0000-4000-8000-000000000002','e0000000-0000-4000-8000-000000000001','Alternatief – Aluminium 75','Zelfde posities in aluminium.',false,'a1000000-0000-4000-8000-000000000001'),
 ('a2000000-0000-4000-8000-000000000001','e0000000-0000-4000-8000-000000000002','Basis – ALU 75','Volgens bestek.',true,null),
 ('a3000000-0000-4000-8000-000000000001','e0000000-0000-4000-8000-000000000003','Basis','Eerste voorstel.',true,null);

insert into public.configuration_items (configuration_id, project_item_id, data, manual_overrides) values
 ('a1000000-0000-4000-8000-000000000001','f1000000-0000-4000-8000-000000000001','{"product_code":"RAAM-2V","family":"raam","material":"pvc","system":"PVC-70","width_mm":1800,"height_mm":1300,"quantity":1,"sections":[{"opening":"draaikiep","hinge":"links"},{"opening":"vast","hinge":null}],"values":{"kleur_binnen":"wit","kleur_buiten":"antraciet","glas":"dubbel_hr","beslag":"standaard","ventilatie":"rooster","vliegenraam":"geen","zonwering":"rolluik_el"},"services":["opmeting","plaatsing"],"remarks":"Rolluikbediening via schakelaar naast het raam.","production_notes":"Rolluikkast opbouw, motor links."}','{}'),
 ('a1000000-0000-4000-8000-000000000001','f1000000-0000-4000-8000-000000000002','{"product_code":"RAAM-2V","family":"raam","material":"pvc","system":"PVC-70","width_mm":1800,"height_mm":1300,"quantity":1,"sections":[{"opening":"vast","hinge":null},{"opening":"draaikiep","hinge":"rechts"}],"values":{"kleur_binnen":"wit","kleur_buiten":"antraciet","glas":"dubbel_hr","beslag":"standaard","ventilatie":"rooster","vliegenraam":"geen","zonwering":"geen"},"services":["opmeting","plaatsing"],"remarks":"Geen rolluik: luifel aanwezig.","production_notes":""}','{zonwering}'),
 ('a1000000-0000-4000-8000-000000000001','f1000000-0000-4000-8000-000000000003','{"product_code":"RAAM-DK1","family":"raam","material":"pvc","system":"PVC-70","width_mm":1000,"height_mm":1200,"quantity":1,"sections":[{"opening":"draaikiep","hinge":"rechts"}],"values":{"kleur_binnen":"wit","kleur_buiten":"antraciet","glas":"dubbel_hr","beslag":"standaard","ventilatie":"geen","vliegenraam":"inzet","zonwering":"geen"},"services":["opmeting","plaatsing"],"remarks":"","production_notes":""}','{}'),
 ('a1000000-0000-4000-8000-000000000001','f1000000-0000-4000-8000-000000000004','{"product_code":"DEUR-VD","family":"deur","material":"pvc","system":"PVC-70","width_mm":1000,"height_mm":2150,"quantity":1,"sections":[{"opening":"deur_binnen","hinge":"links"}],"values":{"kleur_binnen":"wit","kleur_buiten":"antraciet","glas":"gelaagd","beslag":"standaard","vliegenraam":"geen","dorpel":"pvc_dorpel"},"services":["opmeting","plaatsing","afbraak"],"remarks":"","production_notes":""}','{}'),
 ('a1000000-0000-4000-8000-000000000001','f1000000-0000-4000-8000-000000000005','{"product_code":"SCHUIF-2","family":"schuifraam","material":"alu","system":"ALU-SL160","width_mm":3200,"height_mm":2200,"quantity":1,"sections":[{"opening":"schuif","hinge":null},{"opening":"vast","hinge":null}],"values":{"kleur_binnen":"wit","kleur_buiten":"antraciet","glas":"dubbel_hr","beslag":"standaard","ventilatie":"geen","vliegenraam":"plisse","zonwering":"geen"},"services":["opmeting","transport","plaatsing"],"remarks":"PVC-hefschuif nog niet beschikbaar: daarom aluminium.","production_notes":""}','{}'),
 ('a1000000-0000-4000-8000-000000000002','f1000000-0000-4000-8000-000000000001','{"product_code":"RAAM-2V","family":"raam","material":"alu","system":"ALU-75","width_mm":1800,"height_mm":1300,"quantity":1,"sections":[{"opening":"draaikiep","hinge":"links"},{"opening":"vast","hinge":null}],"values":{"kleur_binnen":"wit","kleur_buiten":"antraciet","glas":"dubbel_hr","beslag":"standaard","ventilatie":"rooster","vliegenraam":"geen","zonwering":"rolluik_el"},"services":["opmeting","plaatsing"],"remarks":"","production_notes":""}','{}'),
 ('a1000000-0000-4000-8000-000000000002','f1000000-0000-4000-8000-000000000002','{"product_code":"RAAM-2V","family":"raam","material":"alu","system":"ALU-75","width_mm":1800,"height_mm":1300,"quantity":1,"sections":[{"opening":"vast","hinge":null},{"opening":"draaikiep","hinge":"rechts"}],"values":{"kleur_binnen":"wit","kleur_buiten":"antraciet","glas":"dubbel_hr","beslag":"standaard","ventilatie":"rooster","vliegenraam":"geen","zonwering":"geen"},"services":["opmeting","plaatsing"],"remarks":"","production_notes":""}','{zonwering}'),
 ('a1000000-0000-4000-8000-000000000002','f1000000-0000-4000-8000-000000000003','{"product_code":"RAAM-DK1","family":"raam","material":"alu","system":"ALU-75","width_mm":1000,"height_mm":1200,"quantity":1,"sections":[{"opening":"draaikiep","hinge":"rechts"}],"values":{"kleur_binnen":"wit","kleur_buiten":"antraciet","glas":"dubbel_hr","beslag":"standaard","ventilatie":"geen","vliegenraam":"inzet","zonwering":"geen"},"services":["opmeting","plaatsing"],"remarks":"","production_notes":""}','{}'),
 ('a1000000-0000-4000-8000-000000000002','f1000000-0000-4000-8000-000000000004','{"product_code":"DEUR-VD","family":"deur","material":"alu","system":"ALU-75","width_mm":1000,"height_mm":2150,"quantity":1,"sections":[{"opening":"deur_binnen","hinge":"links"}],"values":{"kleur_binnen":"wit","kleur_buiten":"antraciet","glas":"gelaagd","beslag":"standaard","vliegenraam":"geen","dorpel":"alu_laag"},"services":["opmeting","plaatsing","afbraak"],"remarks":"","production_notes":""}','{}'),
 ('a1000000-0000-4000-8000-000000000002','f1000000-0000-4000-8000-000000000005','{"product_code":"SCHUIF-2","family":"schuifraam","material":"alu","system":"ALU-SL160","width_mm":3200,"height_mm":2200,"quantity":1,"sections":[{"opening":"schuif","hinge":null},{"opening":"vast","hinge":null}],"values":{"kleur_binnen":"wit","kleur_buiten":"antraciet","glas":"dubbel_hr","beslag":"standaard","ventilatie":"geen","vliegenraam":"plisse","zonwering":"geen"},"services":["opmeting","transport","plaatsing"],"remarks":"","production_notes":""}','{}'),
 ('a2000000-0000-4000-8000-000000000001','f2000000-0000-4000-8000-000000000001','{"product_code":"VAST-1","family":"vast","material":"alu","system":"ALU-75","width_mm":1400,"height_mm":2400,"quantity":6,"sections":[{"opening":"vast","hinge":null}],"values":{"kleur_binnen":"antraciet","kleur_buiten":"antraciet","glas":"akoestisch","ventilatie":"rooster_ak","zonwering":"screen"},"services":["transport","plaatsing"],"remarks":"Volgens gevelplan, as A–F.","production_notes":"Screens met windsensor (aansluiting door elektricien)."}','{}'),
 ('a2000000-0000-4000-8000-000000000001','f2000000-0000-4000-8000-000000000002','{"product_code":"RAAM-2V","family":"raam","material":"alu","system":"ALU-75","width_mm":2400,"height_mm":1600,"quantity":4,"sections":[{"opening":"draai","hinge":"links"},{"opening":"vast","hinge":null},{"opening":"draai","hinge":"rechts"}],"values":{"kleur_binnen":"antraciet","kleur_buiten":"antraciet","glas":"triple","beslag":"verborgen","ventilatie":"rooster","vliegenraam":"geen","zonwering":"screen"},"services":["transport","plaatsing"],"remarks":"","production_notes":""}','{}'),
 ('a2000000-0000-4000-8000-000000000001','f2000000-0000-4000-8000-000000000003','{"product_code":"DEUR-VD","family":"deur","material":"alu","system":"ALU-75","width_mm":1100,"height_mm":2400,"quantity":1,"sections":[{"opening":"deur_buiten","hinge":"rechts"}],"values":{"kleur_binnen":"zwart","kleur_buiten":"zwart","glas":"gelaagd","beslag":"inbraak","vliegenraam":"geen","dorpel":"alu_laag"},"services":["transport","plaatsing"],"remarks":"Inbraakwerende uitvoering gevraagd door bouwheer.","production_notes":""}','{}'),
 ('a3000000-0000-4000-8000-000000000001','f3000000-0000-4000-8000-000000000001','{"product_code":"RAAM-DK1","family":"raam","material":"hout","system":"HOUT-68","width_mm":1200,"height_mm":1500,"quantity":1,"sections":[{"opening":"draaikiep","hinge":"links"}],"values":{"kleur_binnen":"hout_naturel","kleur_buiten":"hout_naturel","glas":"dubbel_hr","beslag":"standaard","ventilatie":"geen","vliegenraam":"geen","zonwering":"geen"},"services":["plaatsing"],"remarks":"","production_notes":""}','{}'),
 ('a3000000-0000-4000-8000-000000000001','f3000000-0000-4000-8000-000000000002','{"product_code":"RAAM-DK1","family":"raam","material":"pvc","system":"PVC-82","width_mm":1200,"height_mm":1400,"quantity":2,"sections":[{"opening":"draaikiep","hinge":"rechts"}],"values":{"kleur_binnen":"cremewit","kleur_buiten":"cremewit","glas":"triple","beslag":"standaard","ventilatie":"geen","vliegenraam":"inzet","zonwering":"rolluik_man"},"services":["plaatsing"],"remarks":"","production_notes":""}','{}');

create or replace function public.audit_row() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  changed text[] := '{}';
  rec jsonb;
  old_rec jsonb;
  rid uuid;
  actor uuid;
  summ text := null;
begin
  rec := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  if tg_op = 'UPDATE' then
    old_rec := to_jsonb(old);
    select coalesce(array_agg(n.key order by n.key), '{}') into changed
      from jsonb_each(rec) n
      where n.key not in ('updated_at','version') and (old_rec -> n.key) is distinct from n.value;
    if array_length(changed, 1) is null then return new; end if;
    if (old_rec ->> 'status') is distinct from (rec ->> 'status') then
      summ := 'status: ' || coalesce(old_rec ->> 'status', '—') || ' → ' || coalesce(rec ->> 'status', '—');
    end if;
  end if;
  begin rid := (coalesce(rec ->> 'id', rec ->> 'revision_id'))::uuid; exception when others then rid := null; end;
  begin actor := coalesce(auth.uid(), (rec ->> 'updated_by')::uuid, (rec ->> 'created_by')::uuid); exception when others then actor := auth.uid(); end;
  insert into public.audit_log (table_name, record_id, action, actor_id, changed_fields, summary)
  values (tg_table_name, rid, lower(tg_op), actor, changed, summ);
  return coalesce(new, old);
end $$;

do $$
declare t text;
begin
  foreach t in array array['companies','contacts','projects','project_items','configurations','configuration_items','attachments','quotes','quote_revisions','approvals','configuration_rules','price_books','price_book_entries','discounts','systems','options','option_values','products','product_families','bom_templates','bom_lines','component_costs','quote_templates','integration_jobs'] loop
    execute format('create trigger audit_row after insert or update or delete on public.%I for each row execute function public.audit_row()', t);
  end loop;
end $$;
