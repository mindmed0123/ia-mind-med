import { describe, it, expect } from 'vitest';
import { parseDoseOptions, fillFromCatalog, formatAnvisaRegistro } from '@/lib/medication-fill';

describe('doses do catálogo', () => {
  it('lista as doses de "25, 50 e 100 mg"', () => {
    expect(parseDoseOptions('Comprimido 25, 50 e 100 mg')).toEqual(['25 mg', '50 mg', '100 mg']);
  });
  it('separa "250-400mg" em duas opções', () => {
    expect(parseDoseOptions('250-400mg')).toEqual(['250 mg', '400 mg']);
  });
  it('mantém combinações como "875+125 mg"', () => {
    expect(parseDoseOptions(null, '500+125; 875+125 mg')).toEqual(['500+125 mg', '875+125 mg']);
  });
});

describe('seleção de um remédio do catálogo', () => {
  it('preenche a dose quando só existe uma', () => {
    const f = fillFromCatalog({ nome_comercial: 'Domperix', concentracao: '10mg', posologia_referencia: '10 mg 3x/dia', tipo_receita: 'branca_comum' });
    expect(f.dosagem).toBe('10 mg');
    expect(f.posologia).toBe('10 mg 3x/dia');
    expect(f.tipo_receita).toBe('branca_comum');
  });
  it('deixa a dose em branco quando há várias e oferece as opções', () => {
    const f = fillFromCatalog({ nome_comercial: 'Espironolactona EMS', concentracao: '25-100mg', apresentacao: 'Comprimido 25, 50 e 100 mg' });
    expect(f.dosagem).toBe('');
    expect(f.doseOptions).toEqual(['25 mg', '50 mg', '100 mg']);
  });
});

describe('registro ANVISA', () => {
  it('formata 9 dígitos', () => {
    expect(formatAnvisaRegistro('105831071')).toBe('1.0583.1071');
  });
});
