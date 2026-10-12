create or replace function public.mark_accepted_preorders_ordered(p_menu_item_ids bigint[])
returns integer
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_updated integer := 0;
begin
  if (select auth.uid()) is null then
    raise exception 'You must be signed in to update accepted pre-orders.';
  end if;

  if p_menu_item_ids is null or cardinality(p_menu_item_ids) = 0 then
    return 0;
  end if;

  update public.dish_preorder_requests d
  set status = 'ordered'
  where d.customer_id = (select auth.uid())
    and d.status = 'accepted'
    and d.accepted_menu_item_id = any(p_menu_item_ids);

  get diagnostics v_updated = row_count;
  return v_updated;
end;
$function$;

revoke all on function public.mark_accepted_preorders_ordered(bigint[]) from public;
grant execute on function public.mark_accepted_preorders_ordered(bigint[]) to authenticated;
