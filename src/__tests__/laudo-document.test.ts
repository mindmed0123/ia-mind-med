import { describe, it, expect } from 'vitest';
import { buildLaudoDocument } from '../../supabase/functions/_shared/laudo-document';

const base = {
  id: '67e69fe5-7346-41b1-8386-da8c2748ff18',
  created_at: '2026-11-23T23:49:25Z',
  patient_data: { iniciais: 'CEM', nome_completo: '', idade: '52 anos', sexo: 'Masculino', alergias: ['penicilina'], sinais_vitais: { IMC: '29,1', PA: '152/94 mmHg', FC: '82 bpm' } },
  sections: { queixa: 'Cefaleia há 3 semanas.', hda: 'Dor frontal.', exame_fisico: 'Bom estado geral.' },
  hypotheses: { mais_provavel: { descricao: 'Cefaleia do tipo tensional', racional: 'Sem sinais de alarme.' }, menos_provavel: { descricao: 'HAS descompensada' } },
  cid10_codes: ['G44.2', 'I10'],
  complementary_exams: ['Hemograma completo'],
  conducts: ['MRPA por 7 dias.', 'Retorno em 2 semanas com exames.'],
};

describe('laudo em PDF', () => {
  it('usa o nome completo do cadastro do paciente antes das iniciais', () => {
    expect(buildLaudoDocument(base, { patientName: 'Carlos Eduardo Martins' })!.paciente.nome).toBe('Carlos Eduardo Martins');
    expect(buildLaudoDocument(base)!.paciente.nome).toBe('CEM');
  });

  it('traz hipóteses e CID salvos fora das seções (laudos novos)', () => {
    const h = buildLaudoDocument(base)!.blocks.find((b) => b.kind === 'hypotheses');
    expect(h && h.kind === 'hypotheses' && h.principal?.titulo).toBe('Cefaleia do tipo tensional');
    expect(h && h.kind === 'hypotheses' && h.cid10.map((c) => c.codigo)).toEqual(['G44.2', 'I10']);
  });

  it('não repete o retorno quando ele já é um item igual da conduta', () => {
    const doc = buildLaudoDocument({ ...base, sections: { ...base.sections, retorno: 'Em 2 semanas com exames.' } })!;
    const steps = doc.blocks.find((b) => b.kind === 'steps');
    expect(steps && steps.kind === 'steps' && steps.items).toEqual(['MRPA por 7 dias.']);
    expect(doc.blocks.some((b) => b.kind === 'callout' && b.title === 'Retorno')).toBe(true);
  });

  it('ordena os sinais vitais com a pressão arterial primeiro', () => {
    expect(buildLaudoDocument(base)!.sinaisVitais.map((v) => v.label)).toEqual(['Pressão arterial', 'Freq. cardíaca', 'IMC']);
  });

  it('monta o registro de sessão (CRP) com os cinco componentes e sem dados médicos', () => {
    const doc = buildLaudoDocument({
      ...base,
      sections: { conselho: 'CRP', registro_sessao: { identificacao: 'Adulta, 34 anos.', evolucao: 'Relata melhora do sono.' } },
    })!;
    expect(doc.conselho).toBe('CRP');
    expect(doc.titulo).toBe('Registro de sessão');
    expect(doc.sinaisVitais).toEqual([]);
    expect(doc.alergias).toEqual([]);
    expect(doc.blocks.some((b) => b.kind === 'hypotheses' || b.kind === 'steps' || b.kind === 'checklist')).toBe(false);
    const numerais = doc.blocks.flatMap((b) => (b.kind === 'text' && b.numeral ? [b.numeral] : []));
    expect(numerais).toEqual(['I', 'II', 'III', 'IV', 'V']);
    const ii = doc.blocks.find((b) => b.kind === 'text' && b.numeral === 'II');
    expect(ii && ii.kind === 'text' && ii.empty).toBe(true);
  });
});

describe('dados do cadastro do paciente', () => {
  it('completa idade, sexo e alergias pelo cadastro quando o laudo não tem', () => {
    const doc = buildLaudoDocument(
      { ...base, patient_data: {} },
      { patientName: 'Ana Souza', patientRecord: { sex: 'F', birth_date: '1980-05-10', allergies: ['dipirona'] } },
    )!;
    expect(doc.paciente.sexo).toBe('Feminino');
    expect(doc.paciente.idade).toMatch(/^4\d anos$/);
    expect(doc.alergias).toEqual(['Dipirona']);
  });
});
