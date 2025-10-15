/**
 * Security headers para prevenir ataques comuns
 * Use em Meta tags ou configure no servidor
 */

export const securityHeaders = {
  // Content Security Policy
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"], // unsafe-inline necessário para Vite em dev
      styleSrc: ["'self'", "'unsafe-inline'"], // unsafe-inline necessário para Tailwind
      imgSrc: ["'self'", 'data:', 'https:', 'blob:'],
      fontSrc: ["'self'", 'data:'],
      connectSrc: ["'self'", 'https://*.supabase.co', 'https://api.ipify.org'],
      mediaSrc: ["'self'", 'blob:'],
      objectSrc: ["'none'"],
      frameSrc: ["'self'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
      upgradeInsecureRequests: []
    }
  },

  // X-Content-Type-Options
  xContentTypeOptions: 'nosniff',

  // X-Frame-Options
  xFrameOptions: 'DENY',

  // X-XSS-Protection
  xXSSProtection: '1; mode=block',

  // Referrer-Policy
  referrerPolicy: 'strict-origin-when-cross-origin',

  // Permissions-Policy
  permissionsPolicy: {
    camera: ['self'],
    microphone: ['self'],
    geolocation: ['self'],
    payment: ['none']
  }
};

/**
 * Gera string CSP para usar em meta tag
 */
export const getCSPString = (): string => {
  const { directives } = securityHeaders.contentSecurityPolicy;
  
  return Object.entries(directives)
    .map(([key, values]) => {
      const directive = key
        .replace(/([A-Z])/g, '-$1')
        .toLowerCase();
      
      if (values.length === 0) {
        return directive;
      }
      
      return `${directive} ${values.join(' ')}`;
    })
    .join('; ');
};
