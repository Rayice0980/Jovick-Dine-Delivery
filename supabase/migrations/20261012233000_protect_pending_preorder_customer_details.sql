DROP POLICY IF EXISTS "Approved restaurants see pending pre-order requests"
ON public.dish_preorder_requests;

CREATE OR REPLACE FUNCTION public.get_open_preorder_requests()
RETURNS TABLE (id uuid, dish_name text, quantity integer, requested_for timestamptz, created_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.restaurants r
    WHERE r.owner_id = (SELECT auth.uid()) AND r.status = 'approved'
  ) THEN
    RAISE EXCEPTION 'An approved restaurant account is required.';
  END IF;
  RETURN QUERY
  SELECT d.id, d.dish_name, d.quantity, d.requested_for, d.created_at
  FROM public.dish_preorder_requests d
  WHERE d.status = 'pending'
  ORDER BY d.created_at ASC
  LIMIT 100;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_open_preorder_requests() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_open_preorder_requests() TO authenticated;
