import DOMPurify from 'dompurify';

/**
 * Sanitização de inputs para prevenir XSS
 */
export const sanitizeHtml = (dirty: string): string => {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'u', 'p', 'br', 'ul', 'ol', 'li'],
    ALLOWED_ATTR: []
  });
};

export const sanitizeText = (text: string): string => {
  return text
    .trim()
    .replace(/[<>]/g, '') // Remove < e >
    .substring(0, 10000); // Limite de caracteres
};

/**
 * Validações de dados médicos
 */
export const validateCRM = (crm: string): boolean => {
  const cleaned = crm.replace(/\D/g, '');
  return /^\d{4,8}$/.test(cleaned);
};

export const validateCRMUF = (uf: string): boolean => {
  const ufs = [
    'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
    'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
    'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
  ];
  return ufs.includes(uf.toUpperCase());
};

export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 255;
};

export const validatePhone = (phone: string): boolean => {
  const cleaned = phone.replace(/\D/g, '');
  return cleaned.length >= 10 && cleaned.length <= 11;
};

/**
 * Validação de arquivos
 */
export interface FileValidationOptions {
  maxSize?: number; // bytes
  allowedTypes?: string[];
}

export const validateFile = (
  file: File,
  options: FileValidationOptions = {}
): { valid: boolean; error?: string } => {
  const { maxSize = 5 * 1024 * 1024, allowedTypes = [] } = options;

  if (file.size > maxSize) {
    return {
      valid: false,
      error: `Arquivo muito grande. Máximo ${Math.round(maxSize / 1024 / 1024)}MB`
    };
  }

  if (allowedTypes.length > 0 && !allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: `Tipo de arquivo não permitido. Permitidos: ${allowedTypes.join(', ')}`
    };
  }

  return { valid: true };
};

/**
 * Validação de dados de paciente
 */
export const validatePatientName = (name: string): boolean => {
  return name.trim().length >= 3 && name.trim().length <= 200;
};

export const validatePatientAge = (age: string): boolean => {
  const numAge = parseInt(age, 10);
  return !isNaN(numAge) && numAge >= 0 && numAge <= 150;
};

/**
 * Validação de medicamentos (receituários)
 */
export const validateMedicationName = (name: string): boolean => {
  return name.trim().length >= 2 && name.trim().length <= 200;
};

export const validateDosage = (dosage: string): boolean => {
  return dosage.trim().length >= 1 && dosage.trim().length <= 100;
};

/**
 * Sanitização de URLs
 */
export const sanitizeUrl = (url: string): string => {
  try {
    const parsed = new URL(url);
    // Apenas http e https
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return '#';
    }
    return url;
  } catch {
    return '#';
  }
};

/**
 * Rate limiting client-side (complementar ao backend)
 */
interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

export const checkRateLimit = (
  key: string,
  maxRequests: number,
  windowMs: number
): boolean => {
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  if (!entry || entry.resetAt < now) {
    rateLimitStore.set(key, {
      count: 1,
      resetAt: now + windowMs
    });
    return true;
  }

  if (entry.count >= maxRequests) {
    return false;
  }

  entry.count++;
  return true;
};

/**
 * Validação de JWT token
 */
export const isTokenExpired = (token: string): boolean => {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp * 1000 < Date.now();
  } catch {
    return true;
  }
};
