import { describe, it, expect } from 'vitest';
import { buildReceitaDocument } from '../../supabase/functions/_shared/receita-document';

const rx = {
  id: 'a1b2c3d4-0000-0000-0000-000000000000',
  created_at: '2026-11-24T02:00:00Z',
  patient_name: 'Maria Souza',
  patient_dob: '1980-05-10',
  patient_sex: 'F',
};

describe('receita em PDF', () => {
  it('emite receita controlada em 2 vias (farmácia e paciente) e a comum em 1', () => {
    const doc = buildReceitaDocument(rx, [
      { tipo: 'branca_comum', items: [{ medicamento: 'Dipirona 500 mg', posologia: '1 cp de 6/6h' }] },
      { tipo: 'controle_especial', items: [{ medicamento: 'Sertralina', dosagem: '50 mg', posologia: '1 cp pela manhã' }] },
    ]);
    expect(doc.paginas.map((p) => [p.tipo, p.via ?? null])).toEqual([
      ['branca_comum', null],
      ['controle_especial', '1ª via · Farmácia'],
      ['controle_especial', '2ª via · Paciente'],
    ]);
  });

  it('não repete o laboratório nem a dose que já estão no nome do remédio', () => {
    const doc = buildReceitaDocument(rx, [
      { tipo: 'branca_comum', items: [
        { medicamento: 'Dipirona EMS', parceiro: 'EMS', dosagem: '500 mg' },
        { medicamento: 'Losartana 50 mg', dosagem: '50 mg', parceiro: 'Medley' },
      ] },
    ]);
    const [a, b] = doc.paginas[0].itens;
    expect(a.laboratorio).toBeUndefined();
    expect(a.dosagem).toBe('500 mg');
    expect(b.dosagem).toBeUndefined();
    expect(b.laboratorio).toBe('Medley');
  });

  it('calcula a idade pela data de nascimento e mostra o sexo por extenso', () => {
    const doc = buildReceitaDocument(rx, [], { today: new Date('2026-11-24T12:00:00Z') });
    expect(doc.paciente.idade).toBe('46 anos');
    expect(doc.paciente.sexo).toBe('Feminino');
  });
});
