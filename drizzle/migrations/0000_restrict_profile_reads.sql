DROP POLICY IF EXISTS "Signed-in players can see profiles" ON public.profiles;
CREATE POLICY "Players see own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);