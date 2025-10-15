import { describe, it, expect } from 'vitest';
import {
  sanitizeHtml,
  sanitizeText,
  validateCRM,
  validateCRMUF,
  validateEmail,
  validatePhone,
  validateFile,
  validatePatientName,
  sanitizeUrl,
  checkRateLimit
} from '../lib/validation';

describe('Security Validations', () => {
  describe('sanitizeHtml', () => {
    it('should remove script tags', () => {
      const dirty = '<script>alert("xss")</script><p>Safe content</p>';
      const clean = sanitizeHtml(dirty);
      expect(clean).not.toContain('<script>');
      expect(clean).toContain('<p>Safe content</p>');
    });

    it('should allow safe tags', () => {
      const html = '<p>Test <strong>bold</strong> and <em>italic</em></p>';
      const clean = sanitizeHtml(html);
      expect(clean).toBe(html);
    });

    it('should remove event handlers', () => {
      const dirty = '<p onclick="alert(1)">Click me</p>';
      const clean = sanitizeHtml(dirty);
      expect(clean).not.toContain('onclick');
    });
  });

  describe('sanitizeText', () => {
    it('should remove < and >', () => {
      const text = 'Test <script>alert(1)</script> text';
      const clean = sanitizeText(text);
      expect(clean).not.toContain('<');
      expect(clean).not.toContain('>');
    });

    it('should trim whitespace', () => {
      const text = '  test  ';
      const clean = sanitizeText(text);
      expect(clean).toBe('test');
    });

    it('should limit length', () => {
      const longText = 'a'.repeat(20000);
      const clean = sanitizeText(longText);
      expect(clean.length).toBeLessThanOrEqual(10000);
    });
  });

  describe('validateCRM', () => {
    it('should accept valid CRM', () => {
      expect(validateCRM('123456')).toBe(true);
      expect(validateCRM('12345678')).toBe(true);
    });

    it('should reject invalid CRM', () => {
      expect(validateCRM('123')).toBe(false);
      expect(validateCRM('123456789')).toBe(false);
      expect(validateCRM('abc')).toBe(false);
    });
  });

  describe('validateCRMUF', () => {
    it('should accept valid UF', () => {
      expect(validateCRMUF('SP')).toBe(true);
      expect(validateCRMUF('RJ')).toBe(true);
      expect(validateCRMUF('sp')).toBe(true); // case insensitive
    });

    it('should reject invalid UF', () => {
      expect(validateCRMUF('XX')).toBe(false);
      expect(validateCRMUF('S')).toBe(false);
      expect(validateCRMUF('SPP')).toBe(false);
    });
  });

  describe('validateEmail', () => {
    it('should accept valid emails', () => {
      expect(validateEmail('test@example.com')).toBe(true);
      expect(validateEmail('user+tag@domain.co.uk')).toBe(true);
    });

    it('should reject invalid emails', () => {
      expect(validateEmail('invalid')).toBe(false);
      expect(validateEmail('@example.com')).toBe(false);
      expect(validateEmail('test@')).toBe(false);
    });

    it('should reject too long emails', () => {
      const longEmail = 'a'.repeat(250) + '@test.com';
      expect(validateEmail(longEmail)).toBe(false);
    });
  });

  describe('validatePhone', () => {
    it('should accept valid phones', () => {
      expect(validatePhone('11987654321')).toBe(true);
      expect(validatePhone('(11) 98765-4321')).toBe(true);
      expect(validatePhone('1133334444')).toBe(true);
    });

    it('should reject invalid phones', () => {
      expect(validatePhone('123')).toBe(false);
      expect(validatePhone('123456789012')).toBe(false);
    });
  });

  describe('validateFile', () => {
    it('should accept valid files', () => {
      const file = new File(['content'], 'test.pdf', { type: 'application/pdf' });
      const result = validateFile(file, {
        maxSize: 10 * 1024 * 1024,
        allowedTypes: ['application/pdf']
      });
      expect(result.valid).toBe(true);
    });

    it('should reject oversized files', () => {
      const largeContent = new Blob(['x'.repeat(6 * 1024 * 1024)]);
      const file = new File([largeContent], 'large.pdf', { type: 'application/pdf' });
      const result = validateFile(file, {
        maxSize: 5 * 1024 * 1024
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('muito grande');
    });

    it('should reject invalid file types', () => {
      const file = new File(['content'], 'test.exe', { type: 'application/x-executable' });
      const result = validateFile(file, {
        allowedTypes: ['application/pdf']
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('não permitido');
    });
  });

  describe('validatePatientName', () => {
    it('should accept valid names', () => {
      expect(validatePatientName('João Silva')).toBe(true);
      expect(validatePatientName('Maria')).toBe(true);
    });

    it('should reject too short names', () => {
      expect(validatePatientName('Ab')).toBe(false);
      expect(validatePatientName('  ')).toBe(false);
    });

    it('should reject too long names', () => {
      const longName = 'a'.repeat(201);
      expect(validatePatientName(longName)).toBe(false);
    });
  });

  describe('sanitizeUrl', () => {
    it('should accept valid URLs', () => {
      expect(sanitizeUrl('https://example.com')).toBe('https://example.com');
      expect(sanitizeUrl('http://example.com')).toBe('http://example.com');
    });

    it('should reject javascript URLs', () => {
      expect(sanitizeUrl('javascript:alert(1)')).toBe('#');
    });

    it('should reject data URLs', () => {
      expect(sanitizeUrl('data:text/html,<script>alert(1)</script>')).toBe('#');
    });

    it('should reject invalid URLs', () => {
      expect(sanitizeUrl('not a url')).toBe('#');
    });
  });

  describe('checkRateLimit', () => {
    it('should allow requests within limit', () => {
      const key = 'test-user-1';
      expect(checkRateLimit(key, 5, 60000)).toBe(true);
      expect(checkRateLimit(key, 5, 60000)).toBe(true);
      expect(checkRateLimit(key, 5, 60000)).toBe(true);
    });

    it('should block requests over limit', () => {
      const key = 'test-user-2';
      for (let i = 0; i < 5; i++) {
        checkRateLimit(key, 5, 60000);
      }
      expect(checkRateLimit(key, 5, 60000)).toBe(false);
    });

    it('should reset after window', async () => {
      const key = 'test-user-3';
      for (let i = 0; i < 5; i++) {
        checkRateLimit(key, 5, 100);
      }
      
      // Wait for window to reset
      await new Promise(resolve => setTimeout(resolve, 150));
      
      expect(checkRateLimit(key, 5, 100)).toBe(true);
    });
  });
});
