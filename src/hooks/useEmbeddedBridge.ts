import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';

const MINDPEP_ORIGIN = 'https://mindpep-clinical-os.lovable.app';

export interface BridgeToken {
  origin: string;
  patient_id: string;
  organization_id: string;
  doctor_id: string;
  doctor_name: string;
  patient_name: string;
  patient_age: number;
  patient_gender: string;
  patient_allergies?: string;
  patient_comorbidities?: string;
  patient_medications?: string;
  exp: number;
}

interface EmbeddedBridgeReturn {
  isEmbedded: boolean;
  bridgeToken: BridgeToken | null;
  error: string | null;
  sendReady: () => void;
  sendCompleted: (payload: any) => void;
  sendCancelled: () => void;
}

function decodeBridgeToken(raw: string): BridgeToken | null {
  try {
    const json = atob(raw);
    return JSON.parse(json) as BridgeToken;
  } catch {
    return null;
  }
}

function isTokenExpired(token: BridgeToken): boolean {
  return Date.now() / 1000 > token.exp;
}

export function useEmbeddedBridge(): EmbeddedBridgeReturn {
  const [searchParams] = useSearchParams();
  const [bridgeToken, setBridgeToken] = useState<BridgeToken | null>(null);
  const [error, setError] = useState<string | null>(null);
  const readySent = useRef(false);

  const isEmbedded = searchParams.get('embedded') === 'true';

  // Decode token from URL on mount
  useEffect(() => {
    if (!isEmbedded) return;

    const raw = searchParams.get('bridge');
    if (raw) {
      const token = decodeBridgeToken(raw);
      if (!token) {
        setError('Token de integração inválido');
        return;
      }
      if (isTokenExpired(token)) {
        setError('Token de integração expirado');
        return;
      }
      setBridgeToken(token);
    }
  }, [isEmbedded, searchParams]);

  // Listen for postMessage from parent (MindPEP)
  useEffect(() => {
    if (!isEmbedded) return;

    const handler = (event: MessageEvent) => {
      if (event.origin !== MINDPEP_ORIGIN) return;
      if (event.data?.type === 'mindpep:context') {
        try {
          const raw = event.data.payload?.bridge_token;
          if (!raw) return;
          const token = decodeBridgeToken(raw);
          if (!token) return;
          if (isTokenExpired(token)) {
            setError('Token de integração expirado');
            return;
          }
          setBridgeToken(token);
          setError(null);
        } catch {
          // Ignore malformed messages
        }
      }
    };

    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [isEmbedded]);

  // Send ready message once token is loaded
  useEffect(() => {
    if (isEmbedded && bridgeToken && !readySent.current) {
      readySent.current = true;
      try {
        window.parent.postMessage({ type: 'mindmed:ready' }, MINDPEP_ORIGIN);
      } catch {
        // Not in iframe or cross-origin blocked
      }
    }
  }, [isEmbedded, bridgeToken]);

  const sendReady = useCallback(() => {
    if (!isEmbedded) return;
    try {
      window.parent.postMessage({ type: 'mindmed:ready' }, MINDPEP_ORIGIN);
    } catch { /* ignore */ }
  }, [isEmbedded]);

  const sendCompleted = useCallback((payload: any) => {
    if (!isEmbedded) return;
    try {
      window.parent.postMessage({ type: 'mindmed:completed', payload }, MINDPEP_ORIGIN);
    } catch { /* ignore */ }
  }, [isEmbedded]);

  const sendCancelled = useCallback(() => {
    if (!isEmbedded) return;
    try {
      window.parent.postMessage({ type: 'mindmed:cancelled' }, MINDPEP_ORIGIN);
    } catch { /* ignore */ }
  }, [isEmbedded]);

  return {
    isEmbedded,
    bridgeToken,
    error,
    sendReady,
    sendCompleted,
    sendCancelled,
  };
}
