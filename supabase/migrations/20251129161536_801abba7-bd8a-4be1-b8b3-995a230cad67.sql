-- Create patients table
CREATE TABLE public.patients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  birth_date DATE,
  sex TEXT CHECK (sex IN ('M', 'F', 'O')),
  external_id TEXT,
  phone TEXT,
  email TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own patients"
  ON public.patients FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own patients"
  ON public.patients FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own patients"
  ON public.patients FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own patients"
  ON public.patients FOR DELETE
  USING (auth.uid() = user_id);

-- Admins can view all patients
CREATE POLICY "Admins can view all patients"
  ON public.patients FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- Create index for faster searches
CREATE INDEX idx_patients_user_id ON public.patients(user_id);
CREATE INDEX idx_patients_name ON public.patients(name);
CREATE INDEX idx_patients_external_id ON public.patients(external_id);

-- Add patient_id to laudos table for linking
ALTER TABLE public.laudos ADD COLUMN IF NOT EXISTS patient_id UUID REFERENCES public.patients(id) ON DELETE SET NULL;

-- Create index for patient_id in laudos
CREATE INDEX IF NOT EXISTS idx_laudos_patient_id ON public.laudos(patient_id);

-- Trigger for updated_at
CREATE TRIGGER update_patients_updated_at
  BEFORE UPDATE ON public.patients
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();