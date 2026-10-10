-- Admin-only restaurant review workflow for Jovick Dine Delivery.
-- Provision the first administrator separately through a trusted database session.
create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admin_users enable row level security;
revoke all on table public.admin_users from anon, authenticated;

create or replace function public.admin_list_restaurants()
returns jsonb language plpgsql security definer set search_path = ''
as $function$
declare result jsonb;
begin
  if auth.uid() is null or not exists (select 1 from public.admin_users au where au.user_id = auth.uid()) then
    raise exception 'Administrator access required';
  end if;
  select coalesce(jsonb_agg(to_jsonb(items) order by items.created_at desc), '[]'::jsonb) into result
  from (
    select r.id, r.owner_id, r.name as business_name, r.business_type, r.business_address,
      r.status, r.created_at, p.full_name as owner_name, p.phone as owner_phone, u.email as owner_email
    from public.restaurants r
    join public.profiles p on p.id = r.owner_id
    join auth.users u on u.id = r.owner_id
  ) items;
  return result;
end;
$function$;

create or replace function public.admin_review_restaurant(p_restaurant_id uuid, p_decision text)
returns jsonb language plpgsql security definer set search_path = ''
as $function$
declare updated_restaurant public.restaurants%rowtype;
begin
  if auth.uid() is null or not exists (select 1 from public.admin_users au where au.user_id = auth.uid()) then
    raise exception 'Administrator access required';
  end if;
  if p_decision not in ('approved', 'rejected') then
    raise exception 'Decision must be approved or rejected';
  end if;
  update public.restaurants set status = p_decision, updated_at = now()
  where id = p_restaurant_id and status = 'pending'
  returning * into updated_restaurant;
  if not found then raise exception 'Pending restaurant application not found. Refresh the list and try again.'; end if;
  return jsonb_build_object('id', updated_restaurant.id, 'status', updated_restaurant.status, 'name', updated_restaurant.name);
end;
$function$;
revoke all on function public.admin_list_restaurants() from public, anon;
revoke all on function public.admin_review_restaurant(uuid, text) from public, anon;
grant execute on function public.admin_list_restaurants() to authenticated;
grant execute on function public.admin_review_restaurant(uuid, text) to authenticated;
