create or replace function public.prevent_profile_account_type_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.account_type is distinct from old.account_type then
    raise exception 'Account type cannot be changed from profile settings.';
  end if;
  return new;
end;
$$;

revoke all on function public.prevent_profile_account_type_change() from public, anon, authenticated;

drop trigger if exists prevent_profile_account_type_change on public.profiles;
create trigger prevent_profile_account_type_change
before update of account_type on public.profiles
for each row
execute function public.prevent_profile_account_type_change();

drop policy if exists "Anyone can read available menu items" on public.menu_items;
create policy "Anyone can read available menu items from approved restaurants"
on public.menu_items
for select
to anon, authenticated
using (
  is_available = true
  and exists (
    select 1
    from public.restaurants r
    where r.id = menu_items.restaurant_id
      and r.status = 'approved'
  )
);
