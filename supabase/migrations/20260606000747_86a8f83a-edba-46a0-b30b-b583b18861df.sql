-- Explicit deny: authenticated users cannot UPDATE/DELETE profiles or coin_transactions.
-- Server-side code uses service_role which bypasses RLS.
REVOKE UPDATE, DELETE ON public.profiles FROM authenticated;
REVOKE UPDATE, DELETE ON public.coin_transactions FROM authenticated;

CREATE POLICY "Deny client updates to profiles"
  ON public.profiles FOR UPDATE TO authenticated
  USING (false) WITH CHECK (false);

CREATE POLICY "Deny client deletes to profiles"
  ON public.profiles FOR DELETE TO authenticated
  USING (false);

CREATE POLICY "Deny client updates to coin_transactions"
  ON public.coin_transactions FOR UPDATE TO authenticated
  USING (false) WITH CHECK (false);

CREATE POLICY "Deny client deletes to coin_transactions"
  ON public.coin_transactions FOR DELETE TO authenticated
  USING (false);