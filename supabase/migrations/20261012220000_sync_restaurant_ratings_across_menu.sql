create or replace function public.sync_menu_item_restaurant_rating()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_average numeric;
begin
  if new.restaurant_id is null then
    return new;
  end if;

  select round(avg(rr.rating)::numeric, 1)
    into v_average
  from public.restaurant_ratings rr
  where rr.restaurant_id = new.restaurant_id;

  new.rating := coalesce(v_average, 0);
  return new;
end;
$$;

drop trigger if exists sync_menu_item_restaurant_rating on public.menu_items;
create trigger sync_menu_item_restaurant_rating
before insert or update on public.menu_items
for each row execute function public.sync_menu_item_restaurant_rating();

update public.menu_items m
set rating = coalesce((
  select round(avg(rr.rating)::numeric, 1)
  from public.restaurant_ratings rr
  where rr.restaurant_id = m.restaurant_id
), 0)
where m.restaurant_id is not null;

drop function if exists public.get_public_available_menu();
create function public.get_public_available_menu()
returns table(
  id bigint,
  name text,
  category text,
  price integer,
  rating numeric,
  tag text,
  menu_type text,
  description text,
  image_url text,
  sort_order integer,
  restaurant_name text,
  rating_count bigint
)
language sql
stable
security definer
set search_path = public
as $function$
  select
    m.id,
    m.name,
    m.category,
    m.price,
    ratings.rating,
    m.tag,
    m.menu_type,
    m.description,
    m.image_url,
    m.sort_order,
    r.name as restaurant_name,
    ratings.rating_count
  from public.menu_items m
  join public.restaurants r on r.id = m.restaurant_id
  left join lateral (
    select
      round(avg(rr.rating)::numeric, 1) as rating,
      count(rr.id)::bigint as rating_count
    from public.restaurant_ratings rr
    where rr.restaurant_id = r.id
  ) ratings on true
  where m.is_available = true
    and r.status = 'approved'
  order by m.menu_type asc, m.sort_order asc;
$function$;

revoke all on function public.get_public_available_menu() from public;
grant execute on function public.get_public_available_menu() to anon, authenticated;
revoke all on function public.sync_menu_item_restaurant_rating() from public, anon, authenticated;
