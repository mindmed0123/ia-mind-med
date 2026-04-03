import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

const MINDPEP_IMPORT_URL = 'https://spowqbiucpevpgncmoiv.supabase.co/functions/v1/mindmed-import';

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
  sendCompleted: (payload: any) => Promise<boolean>;
  sendCancelled: () => void;
}

function decodeBridgeToken(raw: string): BridgeToken | null {
  try {
    const bytes = Uint8Array.from(atob(raw), c => c.charCodeAt(0));
    const json = new TextDecoder().decode(bytes);
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

  // Detect bridge mode: either ?embedded=true or just ?bridge=TOKEN
  const hasBridge = !!searchParams.get('bridge');
  const isEmbedded = searchParams.get('embedded') === 'true' || hasBridge;

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

  // Send completed: call MindPEP import endpoint directly
  const sendCompleted = useCallback(async (payload: any): Promise<boolean> => {
    if (!bridgeToken) return false;

    try {
      const rawBridge = searchParams.get('bridge') || '';
      const response = await fetch(MINDPEP_IMPORT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Bridge-Token': rawBridge,
        },
        body: JSON.stringify({
          patient_id: bridgeToken.patient_id,
          documents: payload.documents,
          source: 'mindmed',
        }),
      });

      if (!response.ok) {
        const err = await response.text();
        console.error('MindPEP import failed:', err);
        return false;
      }

      return true;
    } catch (err) {
      console.error('MindPEP import error:', err);
      return false;
    }
  }, [bridgeToken, searchParams]);

  // Cancel: just close the tab
  const sendCancelled = useCallback(() => {
    window.close();
  }, []);

  return {
    isEmbedded,
    bridgeToken,
    error,
    sendCompleted,
    sendCancelled,
  };
}
