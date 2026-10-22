import { BankStatementImportPage } from '@/features/finance/bank/components';

export default async function ImportCsvPage({
  searchParams,
}: {
  searchParams: Promise<{ bankAccountId?: string }>;
}) {
  const { bankAccountId = '' } = await searchParams;
  return <BankStatementImportPage bankAccountId={bankAccountId} />;
}
