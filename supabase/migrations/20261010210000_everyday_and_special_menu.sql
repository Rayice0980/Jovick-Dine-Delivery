-- Separate regular everyday dishes from limited-time specials.
alter table public.menu_items
  add column if not exists menu_type text not null default 'special';

alter table public.menu_items
  drop constraint if exists menu_items_menu_type_check;

alter table public.menu_items
  add constraint menu_items_menu_type_check
  check (menu_type in ('everyday', 'special'));

create index if not exists menu_items_public_menu_order_idx
  on public.menu_items (menu_type, sort_order)
  where is_available = true;
