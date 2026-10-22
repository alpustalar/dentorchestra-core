import { BankStatementImportModal } from '@/features/finance/bank/components';

export default async function ImportCsvModalPage({
  searchParams,
}: {
  searchParams: Promise<{ bankAccountId?: string }>;
}) {
  const { bankAccountId = '' } = await searchParams;
  return <BankStatementImportModal bankAccountId={bankAccountId} />;
}
