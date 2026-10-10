-- Jovick Dine Delivery: secure customer and restaurant account foundation.
-- Review this file before applying it to the dedicated Jovick Dine Delivery project.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  phone text not null default '',
  account_type text not null default 'customer'
    check (account_type in ('customer', 'restaurant')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.restaurants (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references public.profiles (id) on delete cascade,
  name text not null,
  business_type text not null default 'other',
  business_address text not null,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.restaurants enable row level security;

revoke all on table public.profiles from public, anon, authenticated;
revoke all on table public.restaurants from public, anon, authenticated;

grant select on table public.profiles to authenticated;
grant update (full_name, phone) on table public.profiles to authenticated;
grant select on table public.restaurants to authenticated;

drop policy if exists "Users can read their own profile" on public.profiles;
create policy "Users can read their own profile"
  on public.profiles
  for select
  to authenticated
  using ((select auth.uid()) = id);

drop policy if exists "Users can update their own basic profile details" on public.profiles;
create policy "Users can update their own basic profile details"
  on public.profiles
  for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

drop policy if exists "Restaurant owners can read their own business record" on public.restaurants;
create policy "Restaurant owners can read their own business record"
  on public.restaurants
  for select
  to authenticated
  using ((select auth.uid()) = owner_id);

-- This trigger creates the public profile from the trusted Auth user ID.
-- account_type is only a requested signup choice: restaurant requests always
-- start as pending and do not receive approval privileges.
create or replace function private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_type text;
  new_profile_name text;
  new_phone text;
begin
  requested_type := case
    when new.raw_user_meta_data ->> 'account_type' = 'restaurant' then 'restaurant'
    else 'customer'
  end;

  new_profile_name := coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), '');
  new_phone := coalesce(nullif(trim(new.raw_user_meta_data ->> 'phone'), ''), '');

  insert into public.profiles (id, full_name, phone, account_type)
  values (new.id, new_profile_name, new_phone, requested_type);

  if requested_type = 'restaurant' then
    insert into public.restaurants (owner_id, name, business_type, business_address, status)
    values (
      new.id,
      coalesce(nullif(trim(new.raw_user_meta_data ->> 'business_name'), ''), 'Business details pending'),
      coalesce(nullif(trim(new.raw_user_meta_data ->> 'business_type'), ''), 'other'),
      coalesce(nullif(trim(new.raw_user_meta_data ->> 'business_address'), ''), 'Address pending'),
      'pending'
    );
  end if;

  return new;
end;
$$;

revoke all on function private.handle_new_auth_user() from public, anon, authenticated;
drop trigger if exists on_auth_user_created_for_jovick on auth.users;
create trigger on_auth_user_created_for_jovick
  after insert on auth.users
  for each row execute procedure private.handle_new_auth_user();

-- Keep account_type and restaurant approval status out of user-controlled UPDATE grants.
