-- Grant authenticated sessions the table-level privileges needed to manage menu items.
-- Row-level security remains responsible for restricting writes to the approved owner's restaurant.
grant insert, update, delete on table public.menu_items to authenticated;
