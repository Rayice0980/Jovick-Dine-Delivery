drop policy if exists "Customers can view restaurants accepting their pre-orders" on public.restaurants;
create policy "Customers can view restaurants accepting their pre-orders"
  on public.restaurants for select to authenticated
  using (
    exists (
      select 1 from public.dish_preorder_requests d
      where d.customer_id = (select auth.uid())
        and d.accepted_restaurant_id = restaurants.id
        and d.status in ('accepted','ordered')
    )
  );