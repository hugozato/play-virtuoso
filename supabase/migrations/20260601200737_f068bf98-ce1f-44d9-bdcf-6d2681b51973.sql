
DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
REVOKE UPDATE, INSERT ON public.profiles FROM authenticated;
-- still let users SELECT their profile
-- All mutations go through server functions using service role.
