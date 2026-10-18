/*
 * Handler bağımlılıkları (repo/sağlayıcı/politika) taklit edildiği için mock
 * nesneleri `any` taşır; kural yalnız bu dosyada kapatılır.
 */
/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment */
import { randomUUID } from 'crypto';
import { RegisterClinicPaymentGatewayHandler } from './register-clinic-payment-gateway.handler';
import { RegisterClinicPaymentGatewayCommand } from './register-clinic-payment-gateway.command';
import { ClinicPaymentGateway } from '@modules/finance/payment-gateway/domain/entities/clinic-payment-gateway.entity';
import { ClinicPaymentGatewayRegisteredEvent } from '@modules/finance/payment-gateway/domain/events';
import {
  LogAction,
  LogSource,
} from '@src/domain/constants/log-action.constant';
import type { RegisterClinicSubMerchantDto } from '@shared/modules/clinic/dto/index';

describe('RegisterClinicPaymentGatewayHandler', () => {
  const clinicId = randomUUID();

  const ctx = {
    actor: { userId: 'user-9', source: LogSource.WEB },
    source: 'API',
  } as never;

  const dto = {
    subMerchantType: 'LIMITED_OR_JOINT_STOCK_COMPANY',
    legalCompanyTitle: 'Klinik A.Ş.',
    name: 'Klinik',
    email: 'klinik@example.com',
    gsmNumber: '5551112233',
    iban: 'TR330006100519786457841326',
    identityNumber: '1234567890',
    address: 'Adres 1',
  } as RegisterClinicSubMerchantDto;

  const make = (overrides?: {
    existing?: ClinicPaymentGateway | null;
    retrieved?: { subMerchantKey: string } | null;
  }) => {
    const repo = {
      findByClinicId: jest.fn().mockResolvedValue(overrides?.existing ?? null),
      upsertByClinicId: jest.fn().mockImplementation((e: unknown) => e),
    };
    const iyzicoProvider = {
      createSubMerchant: jest
        .fn()
        .mockResolvedValue({ subMerchantKey: 'key-new' }),
      updateSubMerchant: jest.fn().mockResolvedValue(undefined),
      retrieveSubMerchant: jest
        .fn()
        .mockResolvedValue(overrides?.retrieved ?? null),
    };
    const policyFactory = {
      clinic: () => ({
        evaluator: { check: () => ({ orThrow: jest.fn() }) },
      }),
    };
    const txManager = {
      run: jest.fn().mockImplementation((cb: () => Promise<unknown>) => cb()),
    };

    const handler = new RegisterClinicPaymentGatewayHandler(
      repo as never,
      iyzicoProvider as never,
      policyFactory as never,
      txManager as never
    );

    return { handler, repo, iyzicoProvider };
  };

  const run = (handler: RegisterClinicPaymentGatewayHandler) =>
    handler.execute(
      new RegisterClinicPaymentGatewayCommand(clinicId, dto, ctx)
    );

  const savedEntity = (repo: { upsertByClinicId: jest.Mock }) =>
    repo.upsertByClinicId.mock.calls[0][0] as ClinicPaymentGateway;

  it('yerelde ve iyzico’da kayıt yoksa alt üye işyeri oluşturur', async () => {
    const { handler, repo, iyzicoProvider } = make();

    await run(handler);

    expect(iyzicoProvider.retrieveSubMerchant).toHaveBeenCalledWith({
      conversationId: expect.any(String),
      subMerchantExternalId: clinicId,
    });
    expect(iyzicoProvider.createSubMerchant).toHaveBeenCalledTimes(1);
    expect(savedEntity(repo).iyzicoSubMerchantKey).toBe('key-new');
  });

  it('iyzico’da kayıt varken create ÇAĞRILMAZ (yerel yazma kaybı kurtarılır)', async () => {
    // Regresyon: dış kayıt açıldıktan sonra yerel yazma başarısız olursa anahtar
    // kaybolur; ikinci deneme `create` ile "bu dış kimlik zaten kayıtlı"
    // hatası alır ve klinik elle müdahale olmadan bir daha kurulamaz.
    const { handler, repo, iyzicoProvider } = make({
      retrieved: { subMerchantKey: 'key-remote' },
    });

    await run(handler);

    expect(iyzicoProvider.createSubMerchant).not.toHaveBeenCalled();
    expect(iyzicoProvider.updateSubMerchant).toHaveBeenCalledWith(
      expect.objectContaining({ subMerchantKey: 'key-remote' })
    );
    expect(savedEntity(repo).iyzicoSubMerchantKey).toBe('key-remote');
  });

  it('yerel kayıt varsa iyzico’ya sorulmadan güncellenir', async () => {
    const existing = ClinicPaymentGateway.create({
      clinicId,
      iyzicoSubMerchantKey: 'key-local',
      maskedIban: '**** 0000',
      actorId: 'user-1',
      source: LogSource.SYSTEM,
    });
    existing.flushEvents();

    const { handler, iyzicoProvider } = make({ existing });

    await run(handler);

    expect(iyzicoProvider.retrieveSubMerchant).not.toHaveBeenCalled();
    expect(iyzicoProvider.createSubMerchant).not.toHaveBeenCalled();
    expect(iyzicoProvider.updateSubMerchant).toHaveBeenCalledWith(
      expect.objectContaining({ subMerchantKey: 'key-local' })
    );
  });

  it('denetim event’i maskeli IBAN + aktör taşır, tam IBAN/kimlik no TAŞIMAZ', async () => {
    // Paranın yatacağı hesap değişiyor; kayıtta IBAN tutulmadığı için tek
    // kalıcı iz audit log'dur. KVKK gereği yalnız son 4 hane yazılır.
    const { handler, repo } = make();

    await run(handler);

    const events = savedEntity(repo).getDomainEvents();
    const event = events.find(
      (e) => e instanceof ClinicPaymentGatewayRegisteredEvent
    ) as ClinicPaymentGatewayRegisteredEvent;

    expect(event).toBeDefined();
    expect(event.maskedIban).toBe('**** 1326');
    expect(event.isNew).toBe(true);
    expect(event.log?.actorId).toBe('user-9');
    expect(event.log?.action).toBe(LogAction.PAYMENT_GATEWAY_REGISTERED);

    const serialized = JSON.stringify(event);
    expect(serialized).not.toContain(dto.iban);
    expect(serialized).not.toContain(dto.identityNumber);
  });
});
