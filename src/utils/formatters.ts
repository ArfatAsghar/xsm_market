/**
 * Formats a transaction ID with dynamic zero-padding.
 * Minimum 4 digits padding:
 * - 1     => TXN0001
 * - 10    => TXN0010
 * - 100   => TXN0100
 * - 1000  => TXN1000
 * - 10000 => TXN10000
 */
export const formatTransactionId = (numOrStr: number | string | null | undefined): string => {
  if (numOrStr === null || numOrStr === undefined || numOrStr === '') return 'TXN0001';
  const str = String(numOrStr).trim();
  const digits = str.replace(/[^0-9]/g, '');
  if (!digits) return str.startsWith('TXN') ? str : `TXN${str}`;
  const num = parseInt(digits, 10);
  const padded = String(num).padStart(4, '0');
  return `TXN${padded}`;
};
