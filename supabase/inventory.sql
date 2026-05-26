create extension if not exists pgcrypto;

create table if not exists public.items (
  id uuid primary key default gen_random_uuid(),
  name text not null check (btrim(name) <> ''),
  brand text,
  image_url text,
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

create table if not exists public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.items(id) on delete restrict,
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

create index if not exists items_category_idx on public.items (category);
create index if not exists items_created_at_idx on public.items (created_at desc);
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
