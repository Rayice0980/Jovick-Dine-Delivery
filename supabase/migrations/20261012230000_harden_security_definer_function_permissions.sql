-- Restrict SECURITY DEFINER entry points to the roles that actually need them.
-- These functions already perform their own user/ownership/admin checks.
REVOKE EXECUTE ON FUNCTION public.accept_dish_preorder_request(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_dish_preorder_request(uuid, integer) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.admin_delete_restaurant(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_delete_restaurant(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.admin_list_restaurants() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_restaurants() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.admin_review_restaurant(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_review_restaurant(uuid, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_my_preorder_bag() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_preorder_bag() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_public_available_menu() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_available_menu() TO anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.mark_accepted_preorders_ordered(bigint[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_accepted_preorders_ordered(bigint[]) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.place_customer_orders(text, text, text, text, text, text, text, jsonb, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.place_customer_orders(text, text, text, text, text, text, text, jsonb, timestamptz) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.restaurant_can_read_order(bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.restaurant_can_read_order(bigint) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.restaurant_update_order_status(bigint, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.restaurant_update_order_status(bigint, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.submit_restaurant_rating(bigint, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_restaurant_rating(bigint, integer) TO authenticated;

-- Retire old single-order overloads; checkout now uses the validated multi-restaurant function.
REVOKE ALL ON FUNCTION public.place_customer_order(text, text, text, text, text, text, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.place_customer_order(text, text, text, text, text, text, text, jsonb, timestamptz) FROM PUBLIC, anon, authenticated;

-- Trigger-only helper; direct execution is not part of the API.
ALTER FUNCTION public.sync_menu_item_restaurant_rating() SET search_path = '';
ALTER FUNCTION public.get_public_available_menu() SET search_path = '';
ALTER FUNCTION public.submit_restaurant_rating(bigint, integer) SET search_path = '';
