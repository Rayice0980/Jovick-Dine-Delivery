drop policy if exists "Customers can view restaurants accepting their pre-orders" on public.restaurants;

create or replace function public.get_my_preorder_bag()
returns table(
  request_id uuid,
  dish_name text,
  quantity integer,
  accepted_price integer,
  accepted_restaurant_id uuid,
  restaurant_name text,
  status text
)
language sql
stable
security definer
set search_path = ''
as $function$
  select d.id, d.dish_name, d.quantity, d.accepted_price,
         d.accepted_restaurant_id, r.name, d.status
  from public.dish_preorder_requests d
  left join public.restaurants r on r.id = d.accepted_restaurant_id
  where d.customer_id = (select auth.uid())
    and d.status in ('accepted','ordered')
  order by d.accepted_at desc nulls last, d.created_at desc;
$function$;

revoke all on function public.get_my_preorder_bag() from public;
revoke all on function public.get_my_preorder_bag() from anon;
grant execute on function public.get_my_preorder_bag() to authenticated;