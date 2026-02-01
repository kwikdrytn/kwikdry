// RingCentral types and utilities for call synchronization

export interface RCSyncProgress {
  stage: 'idle' | 'syncing' | 'complete' | 'error';
  message: string;
  details?: string;
}

export interface RCSyncResult {
  success: boolean;
  synced?: {
    calls: number;
    matched: number;
    linked: number;
  };
  fetched?: number;
  error?: string;
}

// Normalize phone numbers: remove all non-digit characters
export function normalizePhone(phone: string | undefined | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  // Handle international format (remove leading 1 for US numbers if 11 digits)
  if (digits.length === 11 && digits.startsWith('1')) {
    return digits.substring(1);
  }
  return digits.length >= 10 ? digits : null;
}

// Format phone number for display
export function formatPhoneNumber(phone: string | null | undefined): string {
  if (!phone) return '';
  const normalized = normalizePhone(phone);
  if (!normalized || normalized.length !== 10) return phone;
  
  return `(${normalized.slice(0, 3)}) ${normalized.slice(3, 6)}-${normalized.slice(6)}`;
}
