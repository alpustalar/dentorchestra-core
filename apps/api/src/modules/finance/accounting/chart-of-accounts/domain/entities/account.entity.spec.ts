import { HttpException } from '@nestjs/common';
import { Account } from './account.entity';
import { AccountCode } from '@modules/finance/accounting/chart-of-accounts/domain/value-objects/account-code.vo';
import { AccountTemplateNode } from '@modules/finance/accounting/chart-of-accounts/domain/constants/clinic-chart-of-accounts.template';
import {
  AccountTemplateMismatchException,
  AccountTemplateParentMissingException,
  InvalidAccountCodeException,
} from '@modules/finance/accounting/chart-of-accounts/domain/exceptions/chart-of-accounts.exceptions';
import { UUID } from '@src/domain/value-objects/uuid.vo';
import { DomainException } from '@src/domain/exceptions/domain.exception';

const CLINIC_ID = '11111111-1111-4111-8111-111111111111';
const ORG_ID = '22222222-2222-4222-8222-222222222222';
const input = { clinicId: CLINIC_ID, organizationId: ORG_ID };

const node = (
  over: Partial<AccountTemplateNode> = {}
): AccountTemplateNode => ({
  code: '100',
  name: 'Kasa',
  parentCode: null,
  type: 'ASSET',
  normalSide: 'DEBIT',
  isPostable: true,
  ...over,
});

describe('Account.buildChartFromTemplate', () => {
  it('şablondaki üst hesap yoksa SESSİZCE kök hesap üretmez, hata verir', () => {
    // Regresyon: `idByCode.get(parentCode) ?? null` bir yazım hatasını sessizce
    // kök hesaba çeviriyordu — ağaç kopuyor, kimse fark etmiyordu.
    const template = [node({ code: '120.01', parentCode: '999' })];

    expect(() => Account.buildChartFromTemplate(input, template)).toThrow(
      AccountTemplateParentMissingException
    );
  });

  it('alt hesabın tipi üst hesapla uyuşmazsa hata verir', () => {
    const template = [
      node({ code: '100', isPostable: false }),
      node({ code: '100.01', parentCode: '100', type: 'EXPENSE' }),
    ];

    expect(() => Account.buildChartFromTemplate(input, template)).toThrow(
      AccountTemplateMismatchException
    );
  });

  it('mevcut hesapların id’leri korunur, alt hesap ONA bağlanır', () => {
    const parentId = UUID.generate().value;
    const template = [
      node({ code: '100', isPostable: false }),
      node({ code: '100.01', parentCode: '100' }),
    ];

    const chart = Account.buildChartFromTemplate(
      { ...input, existingIdByCode: { '100': parentId } },
      template
    );

    expect(chart[0].id.value).toBe(parentId);
    expect(chart[1].parentId).toBe(parentId);
  });

  it('mevcut eşleme verilmezse tüm hesaplara yeni id üretilir', () => {
    const template = [node({ code: '100' }), node({ code: '101' })];

    const ids = Account.buildChartFromTemplate(input, template).map(
      (a) => a.id.value
    );

    expect(new Set(ids).size).toBe(2);
  });
});

describe('Account — durum değişiklikleri', () => {
  const makeAccount = () =>
    Account.create({
      clinicId: CLINIC_ID,
      organizationId: ORG_ID,
      code: '100',
      name: 'Kasa',
      type: 'ASSET',
      normalSide: 'DEBIT',
    });

  afterEach(() => jest.useRealTimers());

  it('deactivate updatedAt’i günceller', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-01-01T10:00:00Z'));
    const account = makeAccount();
    const before = account.updatedAt.getTime();

    jest.setSystemTime(new Date('2026-01-01T10:05:00Z'));
    account.deactivate();

    expect(account.isActive).toBe(false);
    expect(account.updatedAt.getTime()).toBeGreaterThan(before);
  });

  it('activate updatedAt’i günceller', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-01-01T10:00:00Z'));
    const account = makeAccount();
    account.deactivate();
    const before = account.updatedAt.getTime();

    jest.setSystemTime(new Date('2026-01-01T10:05:00Z'));
    account.activate();

    expect(account.isActive).toBe(true);
    expect(account.updatedAt.getTime()).toBeGreaterThan(before);
  });
});

describe('AccountCode', () => {
  it('geçersiz kodda DOMAIN hatası fırlatır (NestJS HTTP hatası değil)', () => {
    // Bu VO entity constructor'ında da kullanılıyordu; NestJS BadRequestException
    // fırlatmak hem katman ihlaliydi hem de veri hatasını "geçersiz istek" gösteriyordu.
    let caught: unknown;
    try {
      AccountCode.create('12A.x');
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(InvalidAccountCodeException);
    expect(caught).toBeInstanceOf(DomainException);
    expect(caught).not.toBeInstanceOf(HttpException);
  });

  it('boş kod reddedilir', () => {
    expect(() => AccountCode.create('')).toThrow(InvalidAccountCodeException);
  });

  it('fromTrusted doğrulama yapmaz (eski kayıtlar okunabilir kalır)', () => {
    expect(AccountCode.fromTrusted('eski-format').value).toBe('eski-format');
  });

  it('parentCode ve level kod yapısından türer', () => {
    const code = AccountCode.create('120.01.0001');

    expect(code.level).toBe(3);
    expect(code.parentCode).toBe('120.01');
    expect(AccountCode.create('120').parentCode).toBeNull();
  });
});
