
-- =========================================================
-- MEDICATIONS CATALOG
-- =========================================================
CREATE TABLE public.medications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_comercial text NOT NULL,
  principio_ativo text NOT NULL,
  laboratorio text,
  apresentacao text,
  concentracao text,
  forma_farmaceutica text,
  via_administracao text,
  classe_terapeutica text,
  registro_anvisa text,
  ean text,
  tarja text CHECK (tarja IN ('livre','vermelha','vermelha_retencao','preta','none')),
  tipo_receita text,
  posologia_referencia text,
  indicacoes text,
  contraindicacoes text,
  cid10_relacionados text[],
  is_parceiro boolean NOT NULL DEFAULT false,
  parceiro_nome text,
  destaque_ordem int NOT NULL DEFAULT 0,
  preco_pmc numeric,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.medications TO authenticated;
GRANT ALL ON public.medications TO service_role;

ALTER TABLE public.medications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "medications_read_authenticated"
  ON public.medications
  FOR SELECT
  TO authenticated
  USING (ativo = true);

-- Indexes
CREATE INDEX idx_medications_search ON public.medications
  USING gin (to_tsvector('portuguese',
    coalesce(nome_comercial,'') || ' ' ||
    coalesce(principio_ativo,'') || ' ' ||
    coalesce(classe_terapeutica,'')));
CREATE INDEX idx_medications_cid ON public.medications USING gin (cid10_relacionados);
CREATE INDEX idx_medications_parceiro ON public.medications (is_parceiro, destaque_ordem);
CREATE INDEX idx_medications_nome_trgm ON public.medications USING gin (nome_comercial gin_trgm_ops);

-- Ensure pg_trgm
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_medications_updated_at ON public.medications;
CREATE TRIGGER update_medications_updated_at
  BEFORE UPDATE ON public.medications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- SEARCH RPC (parceiros primeiro, sem preço na assinatura pública)
-- =========================================================
CREATE OR REPLACE FUNCTION public.search_medications(q text DEFAULT NULL, cid text DEFAULT NULL)
RETURNS TABLE (
  id uuid,
  nome_comercial text,
  principio_ativo text,
  laboratorio text,
  apresentacao text,
  concentracao text,
  forma_farmaceutica text,
  via_administracao text,
  classe_terapeutica text,
  registro_anvisa text,
  tarja text,
  tipo_receita text,
  posologia_referencia text,
  indicacoes text,
  contraindicacoes text,
  cid10_relacionados text[],
  is_parceiro boolean,
  parceiro_nome text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    m.id, m.nome_comercial, m.principio_ativo, m.laboratorio, m.apresentacao,
    m.concentracao, m.forma_farmaceutica, m.via_administracao, m.classe_terapeutica,
    m.registro_anvisa, m.tarja, m.tipo_receita, m.posologia_referencia,
    m.indicacoes, m.contraindicacoes, m.cid10_relacionados,
    m.is_parceiro, m.parceiro_nome
  FROM public.medications m
  WHERE m.ativo = true
    AND (
      q IS NULL OR q = '' OR
      to_tsvector('portuguese',
        coalesce(m.nome_comercial,'') || ' ' ||
        coalesce(m.principio_ativo,'') || ' ' ||
        coalesce(m.classe_terapeutica,'')
      ) @@ plainto_tsquery('portuguese', q)
      OR m.nome_comercial ILIKE '%'||q||'%'
      OR m.principio_ativo ILIKE '%'||q||'%'
    )
    AND (cid IS NULL OR cid = ANY(m.cid10_relacionados))
  ORDER BY m.is_parceiro DESC, m.destaque_ordem ASC, m.nome_comercial ASC
  LIMIT 30;
$$;

GRANT EXECUTE ON FUNCTION public.search_medications(text, text) TO authenticated;

-- =========================================================
-- SEED — ~50 medicamentos comuns (EMS e Eurofarma como parceiros)
-- =========================================================
INSERT INTO public.medications
(nome_comercial, principio_ativo, laboratorio, apresentacao, concentracao, forma_farmaceutica, via_administracao, classe_terapeutica, tarja, tipo_receita, posologia_referencia, indicacoes, cid10_relacionados, is_parceiro, parceiro_nome, destaque_ordem)
VALUES
-- ===== EMS (parceiro) =====
('Amoxicilina EMS','Amoxicilina','EMS','Cápsula 500mg, caixa 21','500mg','Cápsula','Oral','Antibiótico - Penicilina','vermelha','antimicrobiano','1 cápsula de 8/8h por 7 dias','Infecções bacterianas de vias aéreas, urinárias e pele','{J02.9,J03.9,J20.9,N39.0,L08.9}',true,'EMS',1),
('Azitromicina EMS','Azitromicina','EMS','Comprimido 500mg, caixa 3','500mg','Comprimido','Oral','Antibiótico - Macrolídeo','vermelha','antimicrobiano','1 comprimido 1x ao dia por 3 dias','Infecções respiratórias e ISTs','{J20.9,J18.9,A56.0}',true,'EMS',2),
('Cefalexina EMS','Cefalexina','EMS','Cápsula 500mg, caixa 8','500mg','Cápsula','Oral','Antibiótico - Cefalosporina','vermelha','antimicrobiano','1 cápsula de 6/6h por 7 dias','Infecções de pele e vias urinárias','{L03.9,N39.0}',true,'EMS',3),
('Losartana EMS','Losartana Potássica','EMS','Comprimido 50mg, caixa 30','50mg','Comprimido','Oral','Anti-hipertensivo - BRA','vermelha','branca_comum','1 comprimido 1x ao dia','Hipertensão arterial','{I10}',true,'EMS',4),
('Enalapril EMS','Maleato de Enalapril','EMS','Comprimido 20mg, caixa 30','20mg','Comprimido','Oral','Anti-hipertensivo - IECA','vermelha','branca_comum','1 comprimido 1x ao dia','Hipertensão e insuficiência cardíaca','{I10,I50.9}',true,'EMS',5),
('Metformina EMS','Cloridrato de Metformina','EMS','Comprimido 850mg, caixa 30','850mg','Comprimido','Oral','Antidiabético - Biguanida','vermelha','branca_comum','1 comprimido após principais refeições','Diabetes mellitus tipo 2','{E11.9}',true,'EMS',6),
('Omeprazol EMS','Omeprazol','EMS','Cápsula 20mg, caixa 28','20mg','Cápsula','Oral','Inibidor de bomba de prótons','livre','branca_comum','1 cápsula em jejum, 1x ao dia','Refluxo, gastrite e úlcera péptica','{K21.9,K29.7,K25.9}',true,'EMS',7),
('Dipirona EMS','Dipirona Sódica','EMS','Comprimido 500mg, caixa 20','500mg','Comprimido','Oral','Analgésico/Antipirético','livre','branca_comum','1 a 2 comprimidos de 6/6h, se dor ou febre','Dor leve a moderada e febre','{R52.9,R50.9}',true,'EMS',8),
('Ibuprofeno EMS','Ibuprofeno','EMS','Comprimido 600mg, caixa 20','600mg','Comprimido','Oral','AINE','livre','branca_comum','1 comprimido de 8/8h após refeições','Dor e inflamação','{M79.1,M25.5}',true,'EMS',9),
('Atenolol EMS','Atenolol','EMS','Comprimido 50mg, caixa 30','50mg','Comprimido','Oral','Beta-bloqueador','vermelha','branca_comum','1 comprimido 1x ao dia','Hipertensão e arritmias','{I10,I49.9}',true,'EMS',10),
('Sinvastatina EMS','Sinvastatina','EMS','Comprimido 20mg, caixa 30','20mg','Comprimido','Oral','Hipolipemiante - Estatina','vermelha','branca_comum','1 comprimido à noite','Dislipidemia','{E78.5}',true,'EMS',11),
('Hidroclorotiazida EMS','Hidroclorotiazida','EMS','Comprimido 25mg, caixa 30','25mg','Comprimido','Oral','Diurético tiazídico','vermelha','branca_comum','1 comprimido pela manhã','Hipertensão arterial','{I10}',true,'EMS',12),
-- ===== EUROFARMA (parceiro) =====
('Amoxil','Amoxicilina','Eurofarma','Cápsula 500mg, caixa 21','500mg','Cápsula','Oral','Antibiótico - Penicilina','vermelha','antimicrobiano','1 cápsula de 8/8h por 7 dias','Infecções bacterianas','{J02.9,J03.9,J20.9,N39.0}',true,'Eurofarma',1),
('Cefaclor Eurofarma','Cefaclor','Eurofarma','Cápsula 500mg, caixa 9','500mg','Cápsula','Oral','Antibiótico - Cefalosporina','vermelha','antimicrobiano','1 cápsula de 8/8h por 7 dias','Infecções respiratórias','{J20.9}',true,'Eurofarma',2),
('Predsim','Prednisolona','Eurofarma','Solução oral 3mg/ml, frasco 60ml','3mg/ml','Solução','Oral','Corticosteroide','vermelha','branca_comum','Conforme prescrição médica','Processos alérgicos e inflamatórios','{J45.9,L20.9}',true,'Eurofarma',3),
('Hixizine','Hidroxizina','Eurofarma','Comprimido 25mg, caixa 30','25mg','Comprimido','Oral','Anti-histamínico','vermelha','branca_comum','1 comprimido 3x ao dia','Prurido e urticária','{L29.9,L50.9}',true,'Eurofarma',4),
('Naprosyn','Naproxeno','Eurofarma','Comprimido 500mg, caixa 20','500mg','Comprimido','Oral','AINE','vermelha','branca_comum','1 comprimido de 12/12h','Dor e processos inflamatórios','{M79.1}',true,'Eurofarma',5),
('Pantozol','Pantoprazol','Eurofarma','Comprimido 40mg, caixa 28','40mg','Comprimido','Oral','Inibidor de bomba de prótons','vermelha','branca_comum','1 comprimido em jejum, 1x ao dia','Refluxo e úlceras','{K21.9,K25.9}',true,'Eurofarma',6),
('Tamisa 20','Etinilestradiol + Gestodeno','Eurofarma','Drágea, cartela 21','20mcg+75mcg','Drágea','Oral','Contraceptivo oral','vermelha','branca_comum','1 drágea ao dia por 21 dias','Contracepção hormonal','{Z30.0}',true,'Eurofarma',7),
('Allegra','Fexofenadina','Eurofarma','Comprimido 180mg, caixa 10','180mg','Comprimido','Oral','Anti-histamínico não sedativo','livre','branca_comum','1 comprimido 1x ao dia','Rinite alérgica e urticária','{J30.4,L50.9}',true,'Eurofarma',8),
('Anlodipino Eurofarma','Besilato de Anlodipino','Eurofarma','Comprimido 5mg, caixa 30','5mg','Comprimido','Oral','Anti-hipertensivo - BCC','vermelha','branca_comum','1 comprimido 1x ao dia','Hipertensão arterial','{I10}',true,'Eurofarma',9),
('Atorvastatina Eurofarma','Atorvastatina Cálcica','Eurofarma','Comprimido 20mg, caixa 30','20mg','Comprimido','Oral','Hipolipemiante - Estatina','vermelha','branca_comum','1 comprimido à noite','Dislipidemia','{E78.5}',true,'Eurofarma',10),
('Glifage XR','Cloridrato de Metformina','Eurofarma','Comprimido 500mg, caixa 30','500mg','Comprimido','Oral','Antidiabético - Biguanida','vermelha','branca_comum','1 comprimido após o jantar','Diabetes tipo 2','{E11.9}',true,'Eurofarma',11),
-- ===== Não-parceiros (genéricos/referência) =====
('Tylenol','Paracetamol','Janssen','Comprimido 750mg, caixa 20','750mg','Comprimido','Oral','Analgésico/Antipirético','livre','branca_comum','1 comprimido de 6/6h, se dor ou febre','Dor e febre','{R52.9,R50.9}',false,NULL,0),
('Voltaren','Diclofenaco Sódico','Novartis','Comprimido 50mg, caixa 20','50mg','Comprimido','Oral','AINE','vermelha','branca_comum','1 comprimido de 8/8h após refeições','Dor e inflamação','{M79.1}',false,NULL,0),
('Buscopan','Butilbrometo de Escopolamina','Sanofi','Comprimido 10mg, caixa 20','10mg','Comprimido','Oral','Antiespasmódico','livre','branca_comum','1 a 2 comprimidos de 6/6h','Cólicas e espasmos','{R10.4}',false,NULL,0),
('Plasil','Metoclopramida','Sanofi','Comprimido 10mg, caixa 20','10mg','Comprimido','Oral','Antiemético','vermelha','branca_comum','1 comprimido antes das refeições','Náuseas e vômitos','{R11}',false,NULL,0),
('Bromoprida','Bromoprida','Genérico','Cápsula 10mg, caixa 20','10mg','Cápsula','Oral','Antiemético','vermelha','branca_comum','1 cápsula de 8/8h','Náuseas, vômitos e dispepsia','{R11,K30}',false,NULL,0),
('Dramin','Dimenidrinato','Takeda','Comprimido 100mg, caixa 12','100mg','Comprimido','Oral','Antiemético/Anti-vertiginoso','livre','branca_comum','1 comprimido de 6/6h','Cinetose e vertigem','{T75.3,H81.9}',false,NULL,0),
('Loratadina','Loratadina','Genérico','Comprimido 10mg, caixa 12','10mg','Comprimido','Oral','Anti-histamínico','livre','branca_comum','1 comprimido 1x ao dia','Rinite alérgica e urticária','{J30.4,L50.9}',false,NULL,0),
('Polaramine','Dexclorfeniramina','Mantecorp','Comprimido 2mg, caixa 20','2mg','Comprimido','Oral','Anti-histamínico','livre','branca_comum','1 comprimido de 8/8h','Alergias','{L50.9}',false,NULL,0),
('Levotiroxina','Levotiroxina Sódica','Genérico','Comprimido 50mcg, caixa 30','50mcg','Comprimido','Oral','Hormônio tireoidiano','vermelha','branca_comum','1 comprimido em jejum, 1x ao dia','Hipotireoidismo','{E03.9}',false,NULL,0),
('Puran T4','Levotiroxina Sódica','Sanofi','Comprimido 50mcg, caixa 30','50mcg','Comprimido','Oral','Hormônio tireoidiano','vermelha','branca_comum','1 comprimido em jejum, 1x ao dia','Hipotireoidismo','{E03.9}',false,NULL,0),
('Captopril','Captopril','Genérico','Comprimido 25mg, caixa 30','25mg','Comprimido','Oral','Anti-hipertensivo - IECA','vermelha','branca_comum','1 comprimido de 12/12h','Hipertensão','{I10}',false,NULL,0),
('Propranolol','Cloridrato de Propranolol','Genérico','Comprimido 40mg, caixa 30','40mg','Comprimido','Oral','Beta-bloqueador','vermelha','branca_comum','1 comprimido de 12/12h','Hipertensão, enxaqueca, tremor','{I10,G43.9}',false,NULL,0),
('Furosemida','Furosemida','Genérico','Comprimido 40mg, caixa 20','40mg','Comprimido','Oral','Diurético de alça','vermelha','branca_comum','1 comprimido pela manhã','Edemas e ICC','{I50.9}',false,NULL,0),
('AAS','Ácido Acetilsalicílico','Bayer','Comprimido 100mg, caixa 30','100mg','Comprimido','Oral','Antiagregante plaquetário','livre','branca_comum','1 comprimido 1x ao dia','Profilaxia cardiovascular','{I25.9}',false,NULL,0),
('Clopidogrel','Clopidogrel','Genérico','Comprimido 75mg, caixa 28','75mg','Comprimido','Oral','Antiagregante plaquetário','vermelha','branca_comum','1 comprimido 1x ao dia','Síndrome coronariana','{I25.9}',false,NULL,0),
('Rivotril','Clonazepam','Roche','Comprimido 2mg, caixa 30','2mg','Comprimido','Oral','Benzodiazepínico','preta','azul_b','Conforme prescrição médica','Ansiedade e convulsões','{F41.9,G40.9}',false,NULL,0),
('Frontal','Alprazolam','Pfizer','Comprimido 1mg, caixa 30','1mg','Comprimido','Oral','Benzodiazepínico','preta','azul_b','Conforme prescrição médica','Transtornos de ansiedade','{F41.1}',false,NULL,0),
('Tramal','Tramadol','Grünenthal','Cápsula 50mg, caixa 10','50mg','Cápsula','Oral','Analgésico opioide','vermelha_retencao','controle_especial','1 cápsula de 6/6h, se dor','Dor moderada a intensa','{R52.1}',false,NULL,0),
('Codein','Codeína + Paracetamol','Cristália','Comprimido 30mg+500mg, caixa 12','30mg+500mg','Comprimido','Oral','Analgésico opioide','vermelha_retencao','controle_especial','1 comprimido de 6/6h, se dor','Dor moderada a intensa','{R52.1}',false,NULL,0),
('Fluoxetina','Cloridrato de Fluoxetina','Genérico','Cápsula 20mg, caixa 30','20mg','Cápsula','Oral','Antidepressivo - ISRS','vermelha','controle_especial','1 cápsula pela manhã','Depressão e TOC','{F32.9,F42}',false,NULL,0),
('Sertralina','Cloridrato de Sertralina','Genérico','Comprimido 50mg, caixa 30','50mg','Comprimido','Oral','Antidepressivo - ISRS','vermelha','controle_especial','1 comprimido pela manhã','Depressão e ansiedade','{F32.9,F41.9}',false,NULL,0),
('Escitalopram','Oxalato de Escitalopram','Genérico','Comprimido 10mg, caixa 30','10mg','Comprimido','Oral','Antidepressivo - ISRS','vermelha','controle_especial','1 comprimido 1x ao dia','Depressão e ansiedade','{F32.9}',false,NULL,0),
('Ciprofloxacino','Ciprofloxacino','Genérico','Comprimido 500mg, caixa 14','500mg','Comprimido','Oral','Antibiótico - Quinolona','vermelha','antimicrobiano','1 comprimido de 12/12h por 7 dias','ITU e infecções gastrointestinais','{N39.0,A09.9}',false,NULL,0),
('Metronidazol','Metronidazol','Genérico','Comprimido 400mg, caixa 20','400mg','Comprimido','Oral','Antibacteriano/Antiprotozoário','vermelha','antimicrobiano','1 comprimido de 8/8h por 7 dias','Infecções anaeróbias e protozooses','{A07.1,N76.0}',false,NULL,0),
('Nimesulida','Nimesulida','Genérico','Comprimido 100mg, caixa 12','100mg','Comprimido','Oral','AINE','vermelha','branca_comum','1 comprimido de 12/12h após refeições','Dor e inflamação','{M79.1}',false,NULL,0),
('Prednisona','Prednisona','Genérico','Comprimido 20mg, caixa 20','20mg','Comprimido','Oral','Corticosteroide','vermelha','branca_comum','Conforme prescrição médica','Doenças inflamatórias e autoimunes','{J45.9,M06.9}',false,NULL,0),
('Salbutamol','Sulfato de Salbutamol','Genérico','Aerossol 100mcg, frasco 200 doses','100mcg/dose','Aerossol','Inalatória','Broncodilatador beta-2','vermelha','branca_comum','1 a 2 jatos de 6/6h, se broncoespasmo','Asma e DPOC','{J45.9,J44.9}',false,NULL,0),
('Budesonida','Budesonida','Genérico','Cápsula inalante 200mcg, caixa 60','200mcg','Cápsula inalante','Inalatória','Corticosteroide inalatório','vermelha','branca_comum','1 cápsula de 12/12h','Asma','{J45.9}',false,NULL,0),
('Hidroxizina','Cloridrato de Hidroxizina','Genérico','Comprimido 25mg, caixa 30','25mg','Comprimido','Oral','Anti-histamínico','vermelha','branca_comum','1 comprimido 3x ao dia','Prurido e ansiedade leve','{L29.9}',false,NULL,0);
