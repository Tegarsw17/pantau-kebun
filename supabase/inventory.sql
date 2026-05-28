create extension if not exists pgcrypto;

create table if not exists public.items (
  id uuid primary key default gen_random_uuid(),
  name text not null check (btrim(name) <> ''),
  brand text,
  image_url text,
  is_active boolean not null default true,
  category text not null check (
    category in (
      'Pupuk & Nutrisi',
      'ZPT & Hormon',
      'Agrokimia',
      'Alat & Logistik'
    )
  ),
  current_stock numeric(14, 3) not null default 0 check (current_stock >= 0),
  unit text not null check (btrim(unit) <> ''),
  low_stock_threshold numeric(14, 3) not null check (low_stock_threshold >= 0),
  created_at timestamp with time zone not null default timezone('utc'::text, now())
);

alter table public.items
  add column if not exists image_url text;

alter table public.items
  add column if not exists is_active boolean not null default true;

create table if not exists public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.items(id) on delete restrict,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  type text not null check (
    type in ('IN', 'OUT', 'ADJUSTMENT', 'MAINTENANCE', 'DISPOSAL')
  ),
  qty numeric(14, 3) not null check (
    qty <> 0
    and (
      (type = 'IN' and qty > 0)
      or (type <> 'IN' and qty < 0)
    )
  ),
  price_per_unit numeric(14, 2) check (
    (type = 'IN' and price_per_unit is not null and price_per_unit >= 0)
    or (type <> 'IN' and price_per_unit is null)
  ),
  expiry_date date,
  reason text not null check (btrim(reason) <> ''),
  notes text,
  created_at timestamp with time zone not null default timezone('utc'::text, now())
);

alter table public.stock_movements
  add column if not exists created_by uuid references auth.users(id) on delete set null default auth.uid();

create index if not exists items_category_idx on public.items (category);
create index if not exists items_created_at_idx on public.items (created_at desc);
create index if not exists items_is_active_idx on public.items (is_active);
create index if not exists stock_movements_created_by_idx
  on public.stock_movements (created_by)
  where created_by is not null;
create index if not exists stock_movements_item_id_created_at_idx
  on public.stock_movements (item_id, created_at desc);
create index if not exists stock_movements_type_idx on public.stock_movements (type);
create index if not exists stock_movements_expiry_date_idx
  on public.stock_movements (expiry_date)
  where expiry_date is not null;

create or replace function public.apply_stock_movement_to_item()
returns trigger
language plpgsql
as $$
declare
  next_stock numeric(14, 3);
  previous_stock numeric(14, 3);
begin
  select current_stock
  into previous_stock
  from public.items
  where id = new.item_id
  for update;

  if previous_stock is null then
    raise exception 'Inventory item % does not exist.', new.item_id;
  end if;

  next_stock := previous_stock + new.qty;

  if next_stock < 0 then
    raise exception 'Stock movement would make item % negative: %.', new.item_id, next_stock;
  end if;

  update public.items
  set current_stock = next_stock
  where id = new.item_id;

  return new;
end;
$$;

drop trigger if exists stock_movements_apply_to_item on public.stock_movements;

create trigger stock_movements_apply_to_item
before insert on public.stock_movements
for each row
execute function public.apply_stock_movement_to_item();

create or replace function public.prevent_stock_movement_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'stock_movements is append-only. Insert a correcting movement instead.';
end;
$$;

drop trigger if exists stock_movements_prevent_update on public.stock_movements;
drop trigger if exists stock_movements_prevent_delete on public.stock_movements;

create trigger stock_movements_prevent_update
before update on public.stock_movements
for each row
execute function public.prevent_stock_movement_mutation();

create trigger stock_movements_prevent_delete
before delete on public.stock_movements
for each row
execute function public.prevent_stock_movement_mutation();

alter table if exists public.inventory_user_roles
  rename to user_roles;

create table if not exists public.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('admin', 'inventory_admin', 'field_worker')),
  display_name text,
  email text,
  created_at timestamp with time zone not null default timezone('utc'::text, now())
);

alter table public.user_roles
  add column if not exists display_name text;

alter table public.user_roles
  add column if not exists email text;

alter table public.user_roles enable row level security;

drop policy if exists user_roles_read on public.user_roles;
drop policy if exists inventory_user_roles_read on public.user_roles;
drop policy if exists inventory_user_roles_self_read on public.user_roles;

create or replace function public.current_inventory_app_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    nullif(auth.jwt() ->> 'app_role', ''),
    nullif(auth.jwt() -> 'app_metadata' ->> 'role', ''),
    nullif(auth.jwt() -> 'user_metadata' ->> 'role', ''),
    (
      select user_roles.role
      from public.user_roles
      where user_roles.user_id = auth.uid()
      limit 1
    ),
    'field_worker'
  );
$$;

create or replace function public.is_inventory_admin()
returns boolean
language sql
stable
as $$
  select public.current_inventory_app_role() in ('admin', 'inventory_admin');
$$;

create policy user_roles_read
on public.user_roles
for select
to authenticated
using (auth.uid() = user_id or public.is_inventory_admin());

alter table public.items enable row level security;
alter table public.stock_movements enable row level security;

drop policy if exists inventory_items_read on public.items;
drop policy if exists inventory_items_insert_admin on public.items;
drop policy if exists inventory_items_update_admin on public.items;
drop policy if exists inventory_movements_read on public.stock_movements;
drop policy if exists inventory_movements_insert_admin on public.stock_movements;

create policy inventory_items_read
on public.items
for select
to anon, authenticated
using (is_active = true or public.is_inventory_admin());

create policy inventory_items_insert_admin
on public.items
for insert
to authenticated
with check (public.is_inventory_admin());

create policy inventory_items_update_admin
on public.items
for update
to authenticated
using (public.is_inventory_admin())
with check (public.is_inventory_admin());

create policy inventory_movements_read
on public.stock_movements
for select
to anon, authenticated
using (
  public.is_inventory_admin()
  or exists (
    select 1
    from public.items
    where items.id = stock_movements.item_id
      and items.is_active = true
  )
);

create policy inventory_movements_insert_admin
on public.stock_movements
for insert
to authenticated
with check (
  public.is_inventory_admin()
  and exists (
    select 1
    from public.items
    where items.id = stock_movements.item_id
      and items.is_active = true
  )
);

grant usage on schema public to anon, authenticated;
grant select on public.user_roles to authenticated;
grant select on public.items to anon, authenticated;
grant insert, update on public.items to authenticated;

-- Non-authenticated readers only receive non-financial movement columns.
-- Authenticated users still need the admin JWT role claim to write because RLS checks
-- public.is_inventory_admin(). If field workers are also authenticated users, move
-- price_per_unit behind a separate admin-only endpoint/table before granting them access.
revoke all on public.stock_movements from anon, authenticated;
grant select (id, item_id, type, qty, expiry_date, reason, notes, created_at)
  on public.stock_movements to anon;
grant select, insert on public.stock_movements to authenticated;

revoke insert, update on public.items from anon;
revoke insert on public.stock_movements from anon;
