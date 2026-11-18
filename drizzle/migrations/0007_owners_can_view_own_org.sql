ALTER POLICY "Members can view their organizations" ON public.organizations
  USING (
    owner_id = auth.uid()
    OR public.is_org_member(id, auth.uid())
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );