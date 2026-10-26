// Compatibility-only types for unmounted legacy screens. No chat request code.
export interface Citation { pmid: string; title: string; authors: string[]; journal: string; year: string; url: string }
export interface ChatMessage { id: string; role: 'user' | 'assistant'; content: string; created_at: string; citations?: Citation[]; searching?: { query: string } | null }