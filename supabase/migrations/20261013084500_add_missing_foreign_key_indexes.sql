create index if not exists dish_preorder_requests_accepted_menu_item_id_idx
  on public.dish_preorder_requests (accepted_menu_item_id);

create index if not exists restaurant_dish_availability_dish_id_idx
  on public.restaurant_dish_availability (dish_id);

create index if not exists restaurant_ratings_customer_id_idx
  on public.restaurant_ratings (customer_id);

create index if not exists restaurant_ratings_restaurant_id_idx
  on public.restaurant_ratings (restaurant_id);
