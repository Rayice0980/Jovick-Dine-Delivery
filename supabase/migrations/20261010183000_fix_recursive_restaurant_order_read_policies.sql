-- Remove cross-table RLS recursion from restaurant order visibility.
-- The SECURITY DEFINER helper reads the underlying order lines without re-entering RLS.
create or replace function public.restaurant_can_read_order(p_order_id bigint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.restaurants r
    join public.menu_items owned_menu on owned_menu.restaurant_id = r.id
    join public.order_items owned_line on owned_line.menu_item_id = owned_menu.id and owned_line.order_id = p_order_id
    where r.owner_id = (select auth.uid())
      and r.status = 'approved'
  )
  and not exists (
    select 1
    from public.order_items line
    left join public.menu_items item_menu on item_menu.id = line.menu_item_id
    where line.order_id = p_order_id
      and not exists (
        select 1
        from public.restaurants owner_restaurant
        where owner_restaurant.owner_id = (select auth.uid())
          and owner_restaurant.status = 'approved'
          and owner_restaurant.id = item_menu.restaurant_id
      )
  );
$$;

revoke all on function public.restaurant_can_read_order(bigint) from public, anon;
grant execute on function public.restaurant_can_read_order(bigint) to authenticated;

drop policy if exists "Restaurant owners read their own orders" on public.orders;
create policy "Restaurant owners read their own orders"
on public.orders for select to authenticated
using (public.restaurant_can_read_order(id));

drop policy if exists "Restaurant owners read their own order items" on public.order_items;
create policy "Restaurant owners read their own order items"
on public.order_items for select to authenticated
using (public.restaurant_can_read_order(order_id));
