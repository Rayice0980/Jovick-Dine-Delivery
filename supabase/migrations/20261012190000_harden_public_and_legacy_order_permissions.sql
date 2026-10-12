-- Least-privilege grants for tables protected by RLS.
-- Keep public access read-only for public catalog/menu availability.
REVOKE ALL ON TABLE public.dish_catalog FROM anon, authenticated;
GRANT SELECT ON TABLE public.dish_catalog TO anon, authenticated;

REVOKE ALL ON TABLE public.dish_preorder_requests FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.dish_preorder_requests FROM authenticated;
GRANT SELECT, INSERT ON TABLE public.dish_preorder_requests TO authenticated;

REVOKE ALL ON TABLE public.order_issue_reports FROM anon;
REVOKE UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.order_issue_reports FROM authenticated;
GRANT SELECT, INSERT ON TABLE public.order_issue_reports TO authenticated;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.restaurant_dish_availability FROM anon;
GRANT SELECT ON TABLE public.restaurant_dish_availability TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.restaurant_dish_availability TO authenticated;

-- The active checkout calls place_customer_orders(), which handles private pre-orders
-- and creates restaurant-scoped order items. Disable legacy overloads that do not.
REVOKE EXECUTE ON FUNCTION public.place_customer_order(text, text, text, text, text, text, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.place_customer_order(text, text, text, text, text, text, text, jsonb, timestamptz) FROM PUBLIC, anon, authenticated;
