alter table public.dish_preorder_requests
  add column if not exists accepted_price integer;
alter table public.dish_preorder_requests
  drop constraint if exists dish_preorder_requests_accepted_price_check;
alter table public.dish_preorder_requests
  add constraint dish_preorder_requests_accepted_price_check
  check (accepted_price is null or accepted_price > 0);

alter table public.order_items
  add column if not exists restaurant_id uuid references public.restaurants(id) on delete set null;
alter table public.order_items
  add column if not exists preorder_request_id uuid references public.dish_preorder_requests(id) on delete set null;
update public.order_items oi
set restaurant_id = m.restaurant_id
from public.menu_items m
where oi.menu_item_id = m.id and oi.restaurant_id is null;
create index if not exists order_items_restaurant_id_idx on public.order_items(restaurant_id);
create index if not exists order_items_preorder_request_id_idx on public.order_items(preorder_request_id);

create table if not exists public.order_issue_reports (
  id uuid primary key default gen_random_uuid(),
  order_id bigint not null references public.orders(id) on delete cascade,
  customer_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null check (reason in ('delivery_delayed','marked_delivered_not_received','missing_items','wrong_order','food_quality','other')),
  details text not null default '',
  status text not null default 'open' check (status in ('open','investigating','resolved','rejected')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
alter table public.order_issue_reports enable row level security;
grant select, insert on public.order_issue_reports to authenticated;
drop policy if exists "Customers can view their own order reports" on public.order_issue_reports;
create policy "Customers can view their own order reports"
  on public.order_issue_reports for select to authenticated
  using (customer_id = (select auth.uid()));
drop policy if exists "Customers can report their own orders" on public.order_issue_reports;
create policy "Customers can report their own orders"
  on public.order_issue_reports for insert to authenticated
  with check (
    customer_id = (select auth.uid())
    and exists (
      select 1 from public.orders o
      where o.id = order_id and o.customer_id = (select auth.uid())
    )
  );
drop policy if exists "Restaurants can view reports for their orders" on public.order_issue_reports;
create policy "Restaurants can view reports for their orders"
  on public.order_issue_reports for select to authenticated
  using (
    exists (
      select 1
      from public.order_items oi
      join public.restaurants r on r.id = oi.restaurant_id
      where oi.order_id = order_issue_reports.order_id
        and r.owner_id = (select auth.uid())
    )
  );

create or replace function public.accept_dish_preorder_request(p_request_id uuid, p_price integer)
returns table(request_id uuid, accepted boolean, accepted_restaurant_id uuid, accepted_menu_item_id bigint)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_restaurant_id uuid;
  v_request public.dish_preorder_requests%rowtype;
begin
  if p_price is null or p_price < 1 or p_price > 10000000 then
    raise exception 'Enter a valid price greater than zero.';
  end if;
  select r.id into v_restaurant_id
  from public.restaurants r
  where r.owner_id = (select auth.uid()) and r.status = 'approved'
  limit 1;
  if v_restaurant_id is null then
    raise exception 'An approved restaurant account is required.';
  end if;
  select d.* into v_request
  from public.dish_preorder_requests d
  where d.id = p_request_id and d.status = 'pending'
  for update;
  if not found then
    return query select p_request_id, false, null::uuid, null::bigint;
    return;
  end if;
  update public.dish_preorder_requests d
  set status = 'accepted',
      accepted_restaurant_id = v_restaurant_id,
      accepted_price = p_price,
      accepted_menu_item_id = null,
      accepted_at = now()
  where d.id = p_request_id and d.status = 'pending';
  if found then
    return query select p_request_id, true, v_restaurant_id, null::bigint;
  else
    return query select p_request_id, false, null::uuid, null::bigint;
  end if;
end;
$function$;

create or replace function public.place_customer_orders(
  p_customer_name text, p_customer_phone text, p_customer_email text,
  p_delivery_address text, p_delivery_area text, p_payment_method text,
  p_delivery_notes text, p_items jsonb, p_requested_for timestamptz default null
)
returns table(order_id bigint, order_number text, subtotal integer, delivery_fee integer, total integer, status text, restaurant_id uuid, restaurant_name text)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_customer_id uuid := (select auth.uid());
  v_item jsonb;
  v_menu_id bigint;
  v_request_id uuid;
  v_quantity integer;
  v_item_restaurant_id uuid;
  v_restaurant record;
  v_order_id bigint;
  v_order_number text;
  v_subtotal integer;
  v_name text;
  v_price integer;
  v_line_total integer;
begin
  if v_customer_id is null then raise exception 'Please sign in before placing an order.'; end if;
  if coalesce(length(trim(p_customer_name)), 0) < 2
    or coalesce(length(trim(p_customer_phone)), 0) < 7
    or coalesce(length(trim(p_customer_email)), 0) < 5
    or coalesce(length(trim(p_delivery_address)), 0) < 5
    or coalesce(length(trim(p_delivery_area)), 0) < 2 then
    raise exception 'Please complete your name, phone, email and delivery address.';
  end if;
  if p_payment_method is null or p_payment_method not in ('Cash on delivery (if available)', 'Bank transfer (confirm with business)') then
    raise exception 'Choose one of the available payment preferences.';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 40 then
    raise exception 'Your cart is empty or contains too many different items.';
  end if;
  if p_requested_for is not null and (p_requested_for < now() + interval '15 minutes' or p_requested_for > now() + interval '30 days') then
    raise exception 'Choose a requested time at least 15 minutes from now and within the next 30 days.';
  end if;

  for v_item in select value from jsonb_array_elements(p_items) as e(value)
  loop
    begin
      v_quantity := (v_item->>'qty')::integer;
      if v_item ? 'preorder_request_id' then
        v_request_id := (v_item->>'preorder_request_id')::uuid;
        select d.accepted_restaurant_id, d.quantity, d.accepted_price
          into v_item_restaurant_id, v_menu_id, v_price
        from public.dish_preorder_requests d
        join public.restaurants r on r.id = d.accepted_restaurant_id and r.status = 'approved'
        where d.id = v_request_id and d.customer_id = v_customer_id and d.status = 'accepted'
          and d.accepted_price is not null
        for update of d;
        if not found then raise exception 'An accepted pre-order in your bag is no longer available. Refresh your bag and try again.'; end if;
        if v_quantity <> v_menu_id then raise exception 'The quantity for an accepted pre-order must match the quantity agreed with the business.'; end if;
      else
        v_menu_id := (v_item->>'id')::bigint;
        select m.restaurant_id, m.price into v_item_restaurant_id, v_price
        from public.menu_items m
        join public.restaurants r on r.id = m.restaurant_id and r.status = 'approved'
        where m.id = v_menu_id and m.is_available = true;
        if not found or v_item_restaurant_id is null then
          raise exception 'One of the meals is no longer available from an approved business. Refresh the menu and try again.';
        end if;
      end if;
    exception when invalid_text_representation or numeric_value_out_of_range then
      raise exception 'Your cart contains an invalid item.';
    end;
    if v_quantity < 1 or v_quantity > 50 then raise exception 'Item quantities must be between 1 and 50.'; end if;
  end loop;

  for v_restaurant in
    select distinct src.restaurant_id, r.name
    from jsonb_array_elements(p_items) as e(value)
    cross join lateral (
      select m.restaurant_id from public.menu_items m
      where not (e.value ? 'preorder_request_id') and m.id = (e.value->>'id')::bigint and m.is_available = true
      union all
      select d.accepted_restaurant_id from public.dish_preorder_requests d
      where e.value ? 'preorder_request_id' and d.id = (e.value->>'preorder_request_id')::uuid
        and d.customer_id = v_customer_id and d.status = 'accepted'
    ) src
    join public.restaurants r on r.id = src.restaurant_id and r.status = 'approved'
    order by r.name
  loop
    select coalesce(sum(
      (case when e.value ? 'preorder_request_id' then d.accepted_price else m.price end)
      * (e.value->>'qty')::integer
    ), 0)::integer into v_subtotal
    from jsonb_array_elements(p_items) as e(value)
    left join public.menu_items m on not (e.value ? 'preorder_request_id') and m.id = (e.value->>'id')::bigint
    left join public.dish_preorder_requests d on e.value ? 'preorder_request_id'
      and d.id = (e.value->>'preorder_request_id')::uuid and d.customer_id = v_customer_id
    where coalesce(d.accepted_restaurant_id, m.restaurant_id) = v_restaurant.id;
    if v_subtotal <= 0 then raise exception 'An order total is invalid.'; end if;

    insert into public.orders (
      customer_id, customer_name, customer_phone, customer_email, delivery_address,
      delivery_area, payment_method, delivery_notes, subtotal, delivery_fee, total, status, requested_for
    ) values (
      v_customer_id, trim(p_customer_name), trim(p_customer_phone), trim(p_customer_email),
      trim(p_delivery_address), trim(p_delivery_area), p_payment_method, coalesce(trim(p_delivery_notes), ''),
      v_subtotal, 0, v_subtotal, 'received', p_requested_for
    ) returning id, public.orders.order_number into v_order_id, v_order_number;

    for v_item in select value from jsonb_array_elements(p_items) as e(value)
    loop
      if v_item ? 'preorder_request_id' then
        v_request_id := (v_item->>'preorder_request_id')::uuid;
        select d.accepted_restaurant_id, d.dish_name, d.accepted_price, d.quantity
          into v_item_restaurant_id, v_name, v_price, v_quantity
        from public.dish_preorder_requests d
        where d.id = v_request_id and d.customer_id = v_customer_id
          and d.status = 'accepted' and d.accepted_restaurant_id = v_restaurant.id
        for update;
        if not found then raise exception 'An accepted pre-order changed while checking out. Please refresh and try again.'; end if;
        v_line_total := v_price * v_quantity;
        insert into public.order_items (order_id, menu_item_id, item_name, unit_price, quantity, line_total, restaurant_id, preorder_request_id)
        values (v_order_id, null, v_name, v_price, v_quantity, v_line_total, v_item_restaurant_id, v_request_id);
        update public.dish_preorder_requests set status = 'ordered'
        where id = v_request_id and customer_id = v_customer_id and status = 'accepted';
      else
        v_menu_id := (v_item->>'id')::bigint;
        v_quantity := (v_item->>'qty')::integer;
        select m.restaurant_id, m.name, m.price into v_item_restaurant_id, v_name, v_price
        from public.menu_items m
        where m.id = v_menu_id and m.restaurant_id = v_restaurant.id and m.is_available = true;
        if not found then raise exception 'A meal became unavailable during checkout. Please refresh and try again.'; end if;
        v_line_total := v_price * v_quantity;
        insert into public.order_items (order_id, menu_item_id, item_name, unit_price, quantity, line_total, restaurant_id, preorder_request_id)
        values (v_order_id, v_menu_id, v_name, v_price, v_quantity, v_line_total, v_item_restaurant_id, null);
      end if;
    end loop;
    return query select v_order_id, v_order_number, v_subtotal, 0, v_subtotal, 'received'::text, v_restaurant.id, v_restaurant.name;
  end loop;
end;
$function$;

create or replace function public.restaurant_can_read_order(p_order_id bigint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1 from public.restaurants r
    join public.order_items owned_line on owned_line.restaurant_id = r.id and owned_line.order_id = p_order_id
    where r.owner_id = (select auth.uid()) and r.status = 'approved'
  )
  and not exists (
    select 1 from public.order_items line
    where line.order_id = p_order_id
      and not exists (
        select 1 from public.restaurants owner_restaurant
        where owner_restaurant.owner_id = (select auth.uid())
          and owner_restaurant.status = 'approved'
          and owner_restaurant.id = line.restaurant_id
      )
  );
$function$;

create or replace function public.restaurant_update_order_status(p_order_id bigint, p_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_restaurant_id uuid;
begin
  if p_status not in ('confirmed','preparing','out_for_delivery','delivered','cancelled') then raise exception 'Invalid order status'; end if;
  select r.id into v_restaurant_id from public.restaurants r
  where r.owner_id = (select auth.uid()) and r.status = 'approved' limit 1;
  if v_restaurant_id is null then raise exception 'An approved restaurant account is required'; end if;
  if not exists (
    select 1 from public.orders o
    where o.id = p_order_id
      and exists (select 1 from public.order_items oi where oi.order_id = o.id and oi.restaurant_id = v_restaurant_id)
      and not exists (select 1 from public.order_items oi where oi.order_id = o.id and oi.restaurant_id is distinct from v_restaurant_id)
  ) then raise exception 'Order not found or not assigned exclusively to your restaurant'; end if;
  update public.orders set status = p_status, updated_at = now() where id = p_order_id;
end;
$function$;

revoke all on function public.accept_dish_preorder_request(uuid, integer) from public;
grant execute on function public.accept_dish_preorder_request(uuid, integer) to authenticated;
revoke all on function public.place_customer_orders(text, text, text, text, text, text, text, jsonb, timestamptz) from public;
grant execute on function public.place_customer_orders(text, text, text, text, text, text, text, jsonb, timestamptz) to authenticated;
revoke all on function public.restaurant_can_read_order(bigint) from public;
grant execute on function public.restaurant_can_read_order(bigint) to authenticated;
revoke all on function public.restaurant_update_order_status(bigint, text) from public;
grant execute on function public.restaurant_update_order_status(bigint, text) to authenticated;
