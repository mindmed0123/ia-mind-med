import { describe, it, expect } from 'vitest';
import { storagePathFromUrl } from '../../supabase/functions/_shared/storage-url';
import { safeAppOrigin } from '../../supabase/functions/_shared/allowed-origin';

const SUPA = 'https://zwebwrbbrcmajkuptpwq.supabase.co';
const req = (origin?: string) => new Request('https://x.test', { headers: origin ? { origin } : {} });

describe('links de arquivos aceitos pelo servidor', () => {
  it('aceita arquivo do próprio armazenamento no bucket esperado', () => {
    expect(storagePathFromUrl(`${SUPA}/storage/v1/object/public/audio-files/u1/a.webm`, SUPA, 'audio-files')).toBe('u1/a.webm');
  });
  it('recusa outro domínio', () => {
    expect(storagePathFromUrl('https://evil.example/storage/v1/object/public/audio-files/a.webm', SUPA, 'audio-files')).toBeNull();
  });
  it('recusa endereço interno', () => {
    expect(storagePathFromUrl('http://169.254.169.254/latest/meta-data', SUPA, 'audio-files')).toBeNull();
  });
  it('recusa outro bucket', () => {
    expect(storagePathFromUrl(`${SUPA}/storage/v1/object/public/profile-images/a.png`, SUPA, 'audio-files')).toBeNull();
  });
  it('recusa caminho com ..', () => {
    expect(storagePathFromUrl(`${SUPA}/storage/v1/object/public/audio-files/a%2F..%2Fsecret`, SUPA, 'audio-files')).toBeNull();
  });
});

describe('endereço de retorno de pagamento e convites', () => {
  it('mantém o domínio oficial', () => {
    expect(safeAppOrigin(req('https://acesso.mindmed.online'))).toBe('https://acesso.mindmed.online');
  });
  it('troca origem desconhecida pelo domínio oficial', () => {
    expect(safeAppOrigin(req('https://phishing.example'))).toBe('https://acesso.mindmed.online');
  });
  it('não aceita imitação do domínio do projeto', () => {
    expect(safeAppOrigin(req('https://f2575919-a7a9-4fdf-8165-df309be38f26.evil.com'))).toBe('https://acesso.mindmed.online');
  });
  it('usa o domínio oficial quando não há origem', () => {
    expect(safeAppOrigin(req())).toBe('https://acesso.mindmed.online');
  });
});
