-- Migration: profiles_rls_policies
--
-- The profiles table had RLS enabled but zero policies, meaning all reads and
-- writes via the anon/authenticated roles were silently blocked. Dashboard
-- clients using the anon key could not read profile data at all.
--
-- The webhook uses SUPABASE_SERVICE_ROLE_KEY (bypasses RLS), so it was
-- unaffected — but dashboard components reading profiles.* were returning
-- empty results, causing silent failures in the UI.

-- Authenticated users can read their own profile (matched by auth_user_id or id)
CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT USING (auth.uid() = auth_user_id OR auth.uid() = id);

-- Authenticated users can update their own profile
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (auth.uid() = auth_user_id OR auth.uid() = id);

-- Service role can insert new profiles (used by the WhatsApp webhook)
CREATE POLICY "profiles_insert_service" ON public.profiles
  FOR INSERT TO service_role WITH CHECK (true);

-- Service role has full access (covers webhook mutations beyond SELECT/UPDATE)
CREATE POLICY "profiles_service_all" ON public.profiles
  FOR ALL TO service_role USING (true);
