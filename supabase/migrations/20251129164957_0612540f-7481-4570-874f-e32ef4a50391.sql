-- Create patient_documents table for storing document metadata
CREATE TABLE public.patient_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL, -- 'image' or 'pdf'
  file_size INTEGER,
  category TEXT DEFAULT 'other', -- 'xray', 'tomography', 'prescription', 'clinical_report', 'lesion_photo', 'lab_result', 'other'
  ai_description TEXT, -- AI-generated description
  ai_analysis JSONB, -- Detailed AI analysis
  notes TEXT, -- Doctor's notes
  uploaded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  analyzed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.patient_documents ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own patient documents"
ON public.patient_documents FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own patient documents"
ON public.patient_documents FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own patient documents"
ON public.patient_documents FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own patient documents"
ON public.patient_documents FOR DELETE
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all patient documents"
ON public.patient_documents FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create indexes for performance
CREATE INDEX idx_patient_documents_patient_id ON public.patient_documents(patient_id);
CREATE INDEX idx_patient_documents_user_id ON public.patient_documents(user_id);
CREATE INDEX idx_patient_documents_category ON public.patient_documents(category);
CREATE INDEX idx_patient_documents_uploaded_at ON public.patient_documents(uploaded_at DESC);

-- Trigger for updated_at
CREATE TRIGGER update_patient_documents_updated_at
  BEFORE UPDATE ON public.patient_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Create storage bucket for patient documents
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'patient-documents',
  'patient-documents',
  false,
  52428800, -- 50MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
);

-- Storage policies for patient documents
CREATE POLICY "Users can upload patient documents"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'patient-documents' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view their patient documents"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'patient-documents' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their patient documents"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'patient-documents' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Create evolution_reports table
CREATE TABLE public.evolution_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  report_markdown TEXT,
  timeline_data JSONB, -- Structured timeline data
  findings JSONB, -- Key findings from each image/laudo
  evolution_summary TEXT,
  recommendations TEXT,
  theoretical_basis TEXT,
  pdf_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.evolution_reports ENABLE ROW LEVEL SECURITY;

-- RLS Policies for evolution_reports
CREATE POLICY "Users can view their own evolution reports"
ON public.evolution_reports FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own evolution reports"
ON public.evolution_reports FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own evolution reports"
ON public.evolution_reports FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own evolution reports"
ON public.evolution_reports FOR DELETE
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all evolution reports"
ON public.evolution_reports FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Indexes
CREATE INDEX idx_evolution_reports_patient_id ON public.evolution_reports(patient_id);
CREATE INDEX idx_evolution_reports_user_id ON public.evolution_reports(user_id);