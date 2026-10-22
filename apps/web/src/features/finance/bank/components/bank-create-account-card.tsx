import { SelectInput } from '@/components/ui/select-input';
import type { useTranslations } from 'next-intl';
import { Plus } from 'lucide-react';

import type { CreateBankAccountDtoCurrency } from '@/api/generated/model';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';

import { Field } from './bank-ui-primitives';

const currencies = ['TRY', 'USD', 'EUR', 'GBP'] as const;

type Props = {
  t: ReturnType<typeof useTranslations>;
  accountName: string;
  onAccountNameChange: (value: string) => void;
  accountBankName: string;
  onAccountBankNameChange: (value: string) => void;
  accountCurrency: CreateBankAccountDtoCurrency;
  onAccountCurrencyChange: (value: CreateBankAccountDtoCurrency) => void;
  accountOpeningBalance: string;
  onAccountOpeningBalanceChange: (value: string) => void;
  accountIban: string;
  onAccountIbanChange: (value: string) => void;
  accountNo: string;
  onAccountNoChange: (value: string) => void;
  isPending: boolean;
  onSubmit: () => void;
};

export function BankCreateAccountCard({
  t,
  accountName,
  onAccountNameChange,
  accountBankName,
  onAccountBankNameChange,
  accountCurrency,
  onAccountCurrencyChange,
  accountOpeningBalance,
  onAccountOpeningBalanceChange,
  accountIban,
  onAccountIbanChange,
  accountNo,
  onAccountNoChange,
  isPending,
  onSubmit,
}: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('createAccountTitle')}</CardTitle>
        <CardDescription>{t('createAccountDescription')}</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit();
          }}
        >
          <Field label={t('accountName')}>
            <Input
              value={accountName}
              onChange={(event) => onAccountNameChange(event.target.value)}
              placeholder={t('accountNamePlaceholder')}
              disabled={isPending}
            />
          </Field>
          <Field label={t('bankName')}>
            <Input
              value={accountBankName}
              onChange={(event) => onAccountBankNameChange(event.target.value)}
              placeholder={t('bankNamePlaceholder')}
              disabled={isPending}
            />
          </Field>
          <Field label={t('currency')}>
            <SelectInput
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={accountCurrency}
              onChange={(event) =>
                onAccountCurrencyChange(
                  event.target.value as CreateBankAccountDtoCurrency
                )
              }
              disabled={isPending}
            >
              {currencies.map((currency) => (
                <option key={currency} value={currency}>
                  {currency}
                </option>
              ))}
            </SelectInput>
          </Field>
          <Field label={t('openingBalance')}>
            <Input
              type="number"
              inputMode="decimal"
              step="0.01"
              value={accountOpeningBalance}
              onChange={(event) =>
                onAccountOpeningBalanceChange(event.target.value)
              }
              disabled={isPending}
            />
          </Field>
          <Field label={t('iban')}>
            <Input
              value={accountIban}
              onChange={(event) => onAccountIbanChange(event.target.value)}
              placeholder={t('ibanPlaceholder')}
              disabled={isPending}
            />
          </Field>
          <Field label={t('accountNo')}>
            <Input
              value={accountNo}
              onChange={(event) => onAccountNoChange(event.target.value)}
              placeholder={t('accountNoPlaceholder')}
              disabled={isPending}
            />
          </Field>
          <Button
            type="submit"
            disabled={
              isPending || !accountName.trim() || !accountBankName.trim()
            }
          >
            <Plus className="size-4" aria-hidden="true" />
            {isPending ? t('creatingAccount') : t('createAccount')}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
