
CREATE INDEX IF NOT EXISTS idx_appointments_laudo_id ON public.appointments(laudo_id) WHERE laudo_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_appointments_type_id ON public.appointments(appointment_type_id) WHERE appointment_type_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_doctor_availability_org ON public.doctor_availability(organization_id);
CREATE INDEX IF NOT EXISTS idx_doctor_unavailability_org ON public.doctor_unavailability(organization_id);
CREATE INDEX IF NOT EXISTS idx_booking_links_org ON public.booking_links(organization_id);

ANALYZE public.laudos;
ANALYZE public.profiles;
ANALYZE public.subscriptions;
ANALYZE public.patients;
ANALYZE public.onboarding_progress;
