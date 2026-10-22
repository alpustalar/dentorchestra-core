import type { SavedBankStatementMapping } from '@/features/finance/bank/schemas/bank-statement-import.schema';

function storageKey(bankAccountId: string): string {
  return `bank-import-mapping:${bankAccountId}`;
}

export function loadSavedStatementMapping(
  bankAccountId: string,
  headers: string[]
): SavedBankStatementMapping | null {
  try {
    const raw = window.localStorage.getItem(storageKey(bankAccountId));
    if (!raw) return null;
    const saved = JSON.parse(raw) as SavedBankStatementMapping;
    if (JSON.stringify(saved.headerNames) !== JSON.stringify(headers)) return null;
    return saved;
  } catch {
    return null;
  }
}

export function saveStatementMapping(
  bankAccountId: string,
  mapping: SavedBankStatementMapping
): void {
  try {
    window.localStorage.setItem(storageKey(bankAccountId), JSON.stringify(mapping));
  } catch {
    // localStorage erişilemiyorsa (gizli sekme vb.) sessizce yok sayılır — kritik veri değil
  }
}
