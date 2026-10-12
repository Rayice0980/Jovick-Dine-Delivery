update public.dish_preorder_requests d
set accepted_price = m.price,
    accepted_menu_item_id = null
from public.menu_items m
where d.accepted_menu_item_id = m.id
  and d.status = 'accepted'
  and d.accepted_price is null
  and m.tag = 'Accepted pre-order';

delete from public.menu_items m
where m.tag = 'Accepted pre-order'
  and not exists (
    select 1 from public.dish_preorder_requests d
    where d.accepted_menu_item_id = m.id
  );

create index if not exists dish_preorder_requests_customer_status_idx on public.dish_preorder_requests(customer_id, status);
create index if not exists dish_preorder_requests_accepted_restaurant_id_idx on public.dish_preorder_requests(accepted_restaurant_id);
create index if not exists dish_preorder_requests_dish_id_idx on public.dish_preorder_requests(dish_id);
create index if not exists order_issue_reports_order_id_idx on public.order_issue_reports(order_id);
create index if not exists order_issue_reports_customer_id_idx on public.order_issue_reports(customer_id);

revoke all on function public.accept_dish_preorder_request(uuid, integer) from anon;
revoke all on function public.mark_accepted_preorders_ordered(bigint[]) from anon;
