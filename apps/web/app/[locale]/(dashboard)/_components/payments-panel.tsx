'use client';

import { useState } from 'react';
import {
  CreditCard,
  Banknote,
  Building2,
  ReceiptText,
  Send,
  Loader2,
  CheckCircle2,
  Clock,
  XCircle,
} from 'lucide-react';
import { paymentMethods, posTerminals, recentPayments } from '@/lib/data';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

const money = (n: number) => n.toLocaleString('tr-TR') + ' TL';

const methodMeta: Record<
  string,
  { label: string; icon: typeof CreditCard; className: string }
> = {
  pos: {
    label: 'POS / Kart',
    icon: CreditCard,
    className: 'bg-chart-1/15 text-chart-1',
  },
  cash: {
    label: 'Elden / Nakit',
    icon: Banknote,
    className: 'bg-chart-5/15 text-chart-5',
  },
  transfer: {
    label: 'Havale / EFT',
    icon: Building2,
    className: 'bg-chart-2/15 text-chart-2',
  },
  installment: {
    label: 'Taksit / Senet',
    icon: ReceiptText,
    className: 'bg-chart-4/15 text-chart-4',
  },
};

const terminalStatus: Record<string, { label: string; dot: string }> = {
  online: { label: 'Çevrimiçi', dot: 'bg-chart-5' },
  busy: { label: 'İşlemde', dot: 'bg-amber-500' },
  offline: { label: 'Çevrimdışı', dot: 'bg-muted-foreground' },
};

const payStatus: Record<
  string,
  { label: string; icon: typeof CheckCircle2; className: string }
> = {
  success: {
    label: 'Tamamlandı',
    icon: CheckCircle2,
    className: 'text-chart-5',
  },
  pending: { label: 'Beklemede', icon: Clock, className: 'text-amber-500' },
  failed: { label: 'Başarısız', icon: XCircle, className: 'text-destructive' },
};

const methods = [
  { key: 'pos', label: 'POS / Kart', icon: CreditCard },
  { key: 'cash', label: 'Elden', icon: Banknote },
  { key: 'transfer', label: 'Havale', icon: Building2 },
  { key: 'installment', label: 'Taksit', icon: ReceiptText },
];

export function PaymentsPanel() {
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('pos');
  const [terminal, setTerminal] = useState('pos-1');
  const [phase, setPhase] = useState<'idle' | 'sending' | 'done'>('idle');

  const onlineTerminals = posTerminals.filter((t) => t.status !== 'offline');

  function handleCollect() {
    if (!amount) return;
    if (method === 'pos') {
      setPhase('sending');
      setTimeout(() => setPhase('done'), 1800);
    } else {
      setPhase('done');
    }
    setTimeout(() => {
      setPhase('idle');
      setAmount('');
    }, 3600);
  }

  return (
    <Card className="p-5 lg:col-span-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-foreground">
            Ödeme &amp; Tahsilat
          </h2>
          <p className="text-xs text-muted-foreground">
            POS yönlendirme, elden tahsilat ve işlem geçmişi
          </p>
        </div>
        <span className="rounded-full bg-chart-1/15 px-2.5 py-0.5 text-xs font-semibold text-chart-1">
          Bugün {money(482300)}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
        {/* Tahsilat formu */}
        <div className="rounded-xl border border-border bg-muted/30 p-4">
          <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Ödeme Al
          </p>

          <label className="mb-1.5 block text-xs text-muted-foreground">
            Tutar (TL)
          </label>
          <input
            type="number"
            inputMode="numeric"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0"
            className="mb-3 w-full rounded-lg border border-input bg-card px-3 py-2 text-lg font-semibold text-foreground outline-none focus:ring-2 focus:ring-ring"
          />

          <label className="mb-1.5 block text-xs text-muted-foreground">
            Ödeme Yöntemi
          </label>
          <div className="mb-3 grid grid-cols-2 gap-1.5">
            {methods.map((m) => (
              <button
                key={m.key}
                onClick={() => setMethod(m.key)}
                className={cn(
                  'flex items-center gap-1.5 rounded-lg border px-2.5 py-2 text-xs font-medium transition-colors',
                  method === m.key
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border bg-card text-muted-foreground hover:bg-muted'
                )}
              >
                <m.icon className="h-3.5 w-3.5 shrink-0" />
                {m.label}
              </button>
            ))}
          </div>

          {method === 'pos' && (
            <div className="mb-3">
              <label className="mb-1.5 block text-xs text-muted-foreground">
                POS Cihazı
              </label>
              <select
                value={terminal}
                onChange={(e) => setTerminal(e.target.value)}
                className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
              >
                {onlineTerminals.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} — {t.bank}
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            onClick={handleCollect}
            disabled={!amount || phase !== 'idle'}
            className={cn(
              'flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors',
              phase === 'done'
                ? 'bg-chart-5 text-primary-foreground'
                : 'bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50'
            )}
          >
            {phase === 'sending' && (
              <Loader2 className="h-4 w-4 animate-spin" />
            )}
            {phase === 'done' && <CheckCircle2 className="h-4 w-4" />}
            {phase === 'idle' && <Send className="h-4 w-4" />}
            {phase === 'sending'
              ? 'POS cihazına gönderiliyor…'
              : phase === 'done'
                ? method === 'pos'
                  ? 'Kart okutuldu, onaylandı'
                  : 'Tahsilat kaydedildi'
                : method === 'pos'
                  ? 'POS Cihazına Gönder'
                  : 'Tahsilatı Kaydet'}
          </button>

          {method === 'pos' && phase === 'idle' && (
            <p className="mt-2 text-center text-[0.7rem] text-muted-foreground">
              Tutar seçili cihaza yönlendirilir, hasta kart okutur.
            </p>
          )}
        </div>

        {/* POS terminalleri + yöntem dağılımı */}
        <div className="rounded-xl border border-border p-4">
          <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            POS Cihazları
          </p>
          <div className="mb-4 flex flex-col gap-2.5">
            {posTerminals.map((t) => {
              const st = terminalStatus[t.status];
              return (
                <div key={t.id} className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-chart-1/12 text-chart-1">
                    <CreditCard className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1 leading-tight">
                    <p className="truncate text-sm font-medium text-foreground">
                      {t.name}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {t.bank} · {t.model}
                    </p>
                  </div>
                  <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
                    <span className={cn('h-2 w-2 rounded-full', st.dot)} />
                    {st.label}
                  </span>
                </div>
              );
            })}
          </div>

          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Yöntem Dağılımı
          </p>
          <div className="flex flex-col gap-2">
            {paymentMethods.map((m) => (
              <div key={m.key}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">
                    {methodMeta[m.key].label}
                  </span>
                  <span className="font-semibold text-foreground">
                    %{m.share}
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${m.share}%`, background: m.color }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Son işlemler */}
        <div className="rounded-xl border border-border p-4">
          <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Son İşlemler
          </p>
          <div className="flex flex-col gap-2.5">
            {recentPayments.map((p, i) => {
              const mm = methodMeta[p.method];
              const st = payStatus[p.status];
              return (
                <div key={i} className="flex items-center gap-2.5">
                  <div
                    className={cn(
                      'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                      mm.className
                    )}
                  >
                    <mm.icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1 leading-tight">
                    <p className="truncate text-sm font-medium text-foreground">
                      {p.patient}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {p.desc}
                    </p>
                  </div>
                  <div className="shrink-0 text-right leading-tight">
                    <p className="text-sm font-semibold text-foreground">
                      {money(p.amount)}
                    </p>
                    <span
                      className={cn(
                        'flex items-center justify-end gap-1 text-[0.7rem]',
                        st.className
                      )}
                    >
                      <st.icon className="h-3 w-3" />
                      {p.time}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Card>
  );
}
