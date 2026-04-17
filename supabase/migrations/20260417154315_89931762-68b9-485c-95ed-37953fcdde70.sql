-- 1. Adicionar campos de recorrência em doctor_unavailability
ALTER TABLE public.doctor_unavailability
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS recurrence_pattern text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS recurrence_end_date date,
  ADD COLUMN IF NOT EXISTS recurrence_weekdays integer[];

-- Constraint de valores válidos
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'doctor_unavailability_recurrence_pattern_check'
  ) THEN
    ALTER TABLE public.doctor_unavailability
      ADD CONSTRAINT doctor_unavailability_recurrence_pattern_check
      CHECK (recurrence_pattern IN ('none', 'weekly'));
  END IF;
END$$;

-- 2. Função de métricas da agenda
CREATE OR REPLACE FUNCTION public.get_agenda_metrics(
  p_organization_id uuid,
  p_start timestamptz,
  p_end timestamptz,
  p_doctor_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_member boolean;
  v_total int;
  v_completed int;
  v_cancelled int;
  v_no_show int;
  v_scheduled int;
  v_confirmed int;
  v_in_progress int;
  v_total_minutes int;
  v_available_minutes int;
  v_by_doctor jsonb;
  v_by_type jsonb;
  v_by_status jsonb;
  v_by_day jsonb;
BEGIN
  -- Segurança: precisa ser membro da org
  SELECT public.is_org_member(p_organization_id, auth.uid()) INTO v_is_member;
  IF NOT v_is_member THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  -- Totais
  SELECT
    count(*) FILTER (WHERE true),
    count(*) FILTER (WHERE status = 'completed'),
    count(*) FILTER (WHERE status = 'cancelled'),
    count(*) FILTER (WHERE status = 'no_show'),
    count(*) FILTER (WHERE status = 'scheduled'),
    count(*) FILTER (WHERE status = 'confirmed'),
    count(*) FILTER (WHERE status = 'in_progress'),
    COALESCE(SUM(EXTRACT(EPOCH FROM (end_at - start_at)) / 60)::int, 0)
  INTO v_total, v_completed, v_cancelled, v_no_show, v_scheduled, v_confirmed, v_in_progress, v_total_minutes
  FROM public.appointments
  WHERE organization_id = p_organization_id
    AND start_at >= p_start
    AND start_at < p_end
    AND (p_doctor_id IS NULL OR doctor_id = p_doctor_id);

  -- Minutos disponíveis (soma de doctor_availability dentro do range)
  SELECT COALESCE(SUM(EXTRACT(EPOCH FROM (end_time - start_time)) / 60)::int * GREATEST(1, EXTRACT(DAY FROM (p_end - p_start))::int / 7), 0)
  INTO v_available_minutes
  FROM public.doctor_availability
  WHERE organization_id = p_organization_id
    AND is_active = true
    AND (p_doctor_id IS NULL OR doctor_id = p_doctor_id);

  -- Por médico
  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb)
  INTO v_by_doctor
  FROM (
    SELECT
      a.doctor_id,
      COALESCE(om.display_name, p.full_name, 'Médico') AS doctor_name,
      COALESCE(om.display_color, '#3b82f6') AS color,
      count(*) AS total,
      count(*) FILTER (WHERE a.status = 'completed') AS completed,
      count(*) FILTER (WHERE a.status = 'no_show') AS no_show,
      count(*) FILTER (WHERE a.status = 'cancelled') AS cancelled
    FROM public.appointments a
    LEFT JOIN public.organization_members om
      ON om.user_id = a.doctor_id AND om.organization_id = a.organization_id
    LEFT JOIN public.profiles p ON p.id = a.doctor_id
    WHERE a.organization_id = p_organization_id
      AND a.start_at >= p_start
      AND a.start_at < p_end
      AND (p_doctor_id IS NULL OR a.doctor_id = p_doctor_id)
    GROUP BY a.doctor_id, om.display_name, p.full_name, om.display_color
    ORDER BY total DESC
  ) t;

  -- Por tipo
  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb)
  INTO v_by_type
  FROM (
    SELECT
      COALESCE(at.name, 'Sem tipo') AS type_name,
      COALESCE(at.color, '#94a3b8') AS color,
      count(*) AS total,
      count(*) FILTER (WHERE a.status = 'no_show') AS no_show,
      count(*) FILTER (WHERE a.status = 'completed') AS completed
    FROM public.appointments a
    LEFT JOIN public.appointment_types at ON at.id = a.appointment_type_id
    WHERE a.organization_id = p_organization_id
      AND a.start_at >= p_start
      AND a.start_at < p_end
      AND (p_doctor_id IS NULL OR a.doctor_id = p_doctor_id)
    GROUP BY at.name, at.color
    ORDER BY total DESC
  ) t;

  -- Por status (para gráfico)
  v_by_status := jsonb_build_object(
    'scheduled', v_scheduled,
    'confirmed', v_confirmed,
    'in_progress', v_in_progress,
    'completed', v_completed,
    'cancelled', v_cancelled,
    'no_show', v_no_show
  );

  -- Por dia (série temporal)
  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY (row_to_json(t)->>'day')), '[]'::jsonb)
  INTO v_by_day
  FROM (
    SELECT
      to_char(date_trunc('day', start_at), 'YYYY-MM-DD') AS day,
      count(*) AS total,
      count(*) FILTER (WHERE status = 'completed') AS completed,
      count(*) FILTER (WHERE status = 'no_show') AS no_show
    FROM public.appointments
    WHERE organization_id = p_organization_id
      AND start_at >= p_start
      AND start_at < p_end
      AND (p_doctor_id IS NULL OR doctor_id = p_doctor_id)
    GROUP BY date_trunc('day', start_at)
  ) t;

  RETURN jsonb_build_object(
    'total', v_total,
    'completed', v_completed,
    'cancelled', v_cancelled,
    'no_show', v_no_show,
    'scheduled', v_scheduled,
    'confirmed', v_confirmed,
    'in_progress', v_in_progress,
    'total_minutes', v_total_minutes,
    'available_minutes', v_available_minutes,
    'occupancy_rate', CASE WHEN v_available_minutes > 0 THEN round((v_total_minutes::numeric / v_available_minutes::numeric) * 100, 1) ELSE 0 END,
    'no_show_rate', CASE WHEN v_total > 0 THEN round((v_no_show::numeric / v_total::numeric) * 100, 1) ELSE 0 END,
    'completion_rate', CASE WHEN v_total > 0 THEN round((v_completed::numeric / v_total::numeric) * 100, 1) ELSE 0 END,
    'by_doctor', v_by_doctor,
    'by_type', v_by_type,
    'by_status', v_by_status,
    'by_day', v_by_day
  );
END;
$$;