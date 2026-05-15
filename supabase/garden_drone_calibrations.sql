create table if not exists public.garden_drone_calibrations (
  id bigint generated always as identity primary key,
  garden_id bigint not null unique references public.gardens(id) on delete cascade,
  calibration jsonb not null,
  created_at timestamp with time zone not null default timezone('utc'::text, now()),
  updated_at timestamp with time zone not null default timezone('utc'::text, now())
);
