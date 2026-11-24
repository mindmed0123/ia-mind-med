import { describe, it, expect } from 'vitest';
import { TERMO_ITENS, nomeCompletoValido, termoTextoCanonico, TERMO_VERSAO } from '@/lib/termo-adesao';

describe('termo de adesão', () => {
  it('exige nome e sobrenome para assinar', () => {
    expect(nomeCompletoValido('Maria')).toBe(false);
    expect(nomeCompletoValido('Maria Silva')).toBe(true);
    expect(nomeCompletoValido('Dr. M')).toBe(false);
  });
  it('inclui o aceite do registro de cópias e downloads', () => {
    expect(TERMO_ITENS.map((i) => i.id)).toContain('registro_atividades');
  });
  it('o texto assinado carrega a versão', () => {
    expect(termoTextoCanonico()).toContain(TERMO_VERSAO);
  });
});
