/*
 * Jest mock'ları tiplenmemiş (`any`) nesneler taşır: bus/repo taklitleri gerçek
 * sözleşmeyi değil yalnız testin ihtiyaç duyduğu yüzeyi kurar. Aşağıdaki kurallar
 * YALNIZ bu dosyada kapatılır; üretim kodunda açık kalır.
 */
/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument, @typescript-eslint/require-await, @typescript-eslint/unbound-method */
import { Job } from 'bullmq';
import { EDocumentProcessor } from './e-document.processor';
import { EInvoicePort } from '@modules/finance/e-document/domain/ports/e-invoice.port';
import { EDocumentRequest } from '@modules/finance/e-document/domain/contracts/e-document.contracts';
import { GetInvoiceByIdQuery } from '@modules/finance/invoice/application/queries/get-invoice-by-id/get-invoice-by-id.query';
import { GetClinicGovernmentSpecsQuery } from '@modules/organization/clinic-governance/application/queries/get-clinic-government-specs/get-clinic-government-specs.query';
import { GetPartyByIdQuery } from '@modules/finance/party/application/queries/get-party-by-id/get-party-by-id.query';
import { EnsurePartyForPatientCommand } from '@modules/finance/party/application/commands/ensure-party-for-patient/ensure-party-for-patient.command';
import { MarkInvoiceEDocumentResultCommand } from '@modules/finance/invoice/application/commands/mark-invoice-edocument-result/mark-invoice-edocument-result.command';
import { ClaimInvoiceEDocumentDispatchCommand } from '@modules/finance/invoice/application/commands/claim-invoice-edocument-dispatch/claim-invoice-edocument-dispatch.command';
import { MarkInvoiceEDocumentFailedCommand } from '@modules/finance/invoice/application/commands/mark-invoice-edocument-failed/mark-invoice-edocument-failed.command';
import { CriticalFailurePublisher } from '@common/observability/critical-failure.publisher';
import { TSCommandBus } from '@common/cqrs/type-safe-command-bus';
import { TSQueryBus } from '@common/cqrs/type-safe-query-bus';
import { E_DOCUMENT_JOBS } from '@common/constants';
import { EDocumentTypeSchema } from '@input-type-schemas/EDocumentTypeSchema';
import { EDocumentStatusSchema } from '@input-type-schemas/EDocumentStatusSchema';
import { GetClinicEDocumentProfileQuery } from '@modules/organization/clinic/application/queries/get-clinic-edocument-profile/get-clinic-edocument-profile.query';

describe('EDocumentProcessor (doc 07 §5)', () => {
  const invoiceView = {
    id: 'inv-1',
    clinicId: 'clinic-1',
    patientId: 'patient-1',
    netTotal: '1000.00',
    vatTotal: '100.00',
    grandTotal: '1100.00',
    vatRate: 10,
    currency: 'TRY' as const,
    issuedAt: new Date('2026-06-18'),
    status: 'PENDING' as const,
  };

  const buyer = {
    name: 'Hasta Adı',
    taxNumber: null,
    nationalId: '11111111111',
    isEInvoiceUser: false,
    eInvoiceMailbox: null,
  };

  const buildProcessor = (params: {
    legalType: 'KURUM' | 'SERBEST_MESLEK';
    buyerIsEInvoiceUser?: boolean;
    issue: EInvoicePort['issue'];
    /** Gönderim hakkı sahiplenilebiliyor mu (claim sonucu). */
    claimed?: boolean;
  }) => {
    const port: EInvoicePort = {
      issue: params.issue,
      cancel: jest.fn(),
      getStatus: jest.fn(),
      checkMailbox: jest.fn(),
    };

    const queryBus = {
      execute: jest.fn(async (query: unknown) => {
        if (query instanceof GetInvoiceByIdQuery) return { data: invoiceView };
        if (query instanceof GetClinicGovernmentSpecsQuery) {
          return {
            data: {
              legalType: params.legalType,
              companyTaxNumber: '1234567890',
            },
          };
        }
        if (query instanceof GetClinicEDocumentProfileQuery) {
          return {
            data: {
              id: 'clinic-1',
              name: 'Örnek Klinik',
              phone: null,
              email: null,
              address: 'Test Caddesi 1',
              city: 'İstanbul',
              district: 'Kadıköy',
            },
          };
        }
        if (query instanceof GetPartyByIdQuery) {
          return {
            data: {
              ...buyer,
              isEInvoiceUser: params.buyerIsEInvoiceUser ?? false,
            },
          };
        }
        return { data: null };
      }),
    } as unknown as TSQueryBus;

    const commandBus = {
      execute: jest.fn(async (cmd: unknown) => {
        if (cmd instanceof EnsurePartyForPatientCommand) {
          return { partyId: 'party-1', organizationId: 'org-1' };
        }
        if (cmd instanceof ClaimInvoiceEDocumentDispatchCommand) {
          return params.claimed ?? true;
        }
        return undefined;
      }),
    } as unknown as TSCommandBus;

    const criticalFailure = {
      publish: jest.fn(),
    } as unknown as CriticalFailurePublisher;

    const processor = new EDocumentProcessor(
      port,
      commandBus,
      queryBus,
      criticalFailure
    );
    return { processor, port, queryBus, commandBus, criticalFailure };
  };

  const sendJob = (invoiceId = 'inv-1') =>
    ({ name: E_DOCUMENT_JOBS.SEND, data: { invoiceId } }) as Job;

  const cancelJob = () =>
    ({
      name: E_DOCUMENT_JOBS.CANCEL,
      data: {
        invoiceId: 'inv-1',
        documentType: EDocumentTypeSchema.enum.E_ARSIV,
        uuid: 'ettn-1',
        reason: 'Tutar hatalı girildi',
        clinicId: 'clinic-1',
      },
    }) as Job;

  it('KURUM + bireysel → port E_ARSIV isteğiyle çağrılır, sonuç faturaya işlenir', async () => {
    const issue = jest.fn().mockResolvedValue({
      documentType: EDocumentTypeSchema.enum.INTERNAL,
      uuid: null,
      status: EDocumentStatusSchema.enum.INTERNAL,
      invoiceNumber: null,
    });
    const { processor, commandBus } = buildProcessor({
      legalType: 'KURUM',
      buyerIsEInvoiceUser: false,
      issue,
    });

    await processor.process(sendJob());

    const request = issue.mock.calls[0][0] as EDocumentRequest;
    expect(request.type).toBe(EDocumentTypeSchema.enum.E_ARSIV);
    expect(request.invoiceId).toBe('inv-1');
    expect(request.seller.taxId).toBe('1234567890');
    expect(request.seller.name).toBe('Örnek Klinik');
    expect(request.buyer.taxId).toBe('11111111111');
    expect(request.lines[0].unitPrice).toBe('1000.00');
    expect(request.totals.payable).toBe('1100.00');
    expect(request.currency).toBe('TRY');

    const markCall = (commandBus.execute as jest.Mock).mock.calls.find(
      ([c]) => c instanceof MarkInvoiceEDocumentResultCommand
    );
    expect(markCall).toBeDefined();
    const markCmd = markCall![0] as MarkInvoiceEDocumentResultCommand;
    expect(markCmd.input.invoiceId).toBe('inv-1');
    expect(markCmd.input.status).toBe(EDocumentStatusSchema.enum.INTERNAL);
    expect(markCmd.input.documentType).toBe(EDocumentTypeSchema.enum.INTERNAL);
  });

  it('SERBEST_MESLEK → port E_SMM isteğiyle çağrılır', async () => {
    const issue = jest.fn().mockResolvedValue({
      documentType: EDocumentTypeSchema.enum.INTERNAL,
      uuid: null,
      status: EDocumentStatusSchema.enum.INTERNAL,
      invoiceNumber: null,
    });
    const { processor } = buildProcessor({
      legalType: 'SERBEST_MESLEK',
      issue,
    });

    await processor.process(sendJob());

    const request = issue.mock.calls[0][0] as EDocumentRequest;
    expect(request.type).toBe(EDocumentTypeSchema.enum.E_SMM);
  });

  it('fatura bulunamazsa port çağrılmaz, sessizce çıkar', async () => {
    const issue = jest.fn();
    const port: EInvoicePort = {
      issue,
      cancel: jest.fn(),
      getStatus: jest.fn(),
      checkMailbox: jest.fn(),
    };
    const queryBus = {
      execute: jest.fn(async () => ({ data: null })),
    } as unknown as TSQueryBus;
    const commandBus = {
      execute: jest.fn(),
    } as unknown as TSCommandBus;

    const criticalFailure = {
      publish: jest.fn(),
    } as unknown as CriticalFailurePublisher;

    const processor = new EDocumentProcessor(
      port,
      commandBus,
      queryBus,
      criticalFailure
    );
    await processor.process(sendJob('yok'));

    expect(issue).not.toHaveBeenCalled();
  });

  // --- Mükerrer yasal belge koruması (§12 P0-3) ---

  it('gönderim hakkı sahiplenilemezse port HİÇ çağrılmaz (job retry mükerrer belge üretmez)', async () => {
    const issue = jest.fn();
    const { processor, commandBus } = buildProcessor({
      legalType: 'KURUM',
      issue,
      claimed: false,
    });

    await processor.process(sendJob());

    expect(issue).not.toHaveBeenCalled();
    const markCall = (commandBus.execute as jest.Mock).mock.calls.find(
      ([c]) => c instanceof MarkInvoiceEDocumentResultCommand
    );
    expect(markCall).toBeUndefined();
  });

  it('gönderim hakkı port çağrısından ÖNCE sahiplenilir', async () => {
    const callOrder: string[] = [];
    const issue = jest.fn(async () => {
      callOrder.push('issue');
      return {
        documentType: EDocumentTypeSchema.enum.INTERNAL,
        uuid: null,
        status: EDocumentStatusSchema.enum.INTERNAL,
        invoiceNumber: null,
      };
    });
    const { processor, commandBus } = buildProcessor({
      legalType: 'KURUM',
      issue,
    });
    (commandBus.execute as jest.Mock).mockImplementation(async (cmd) => {
      if (cmd instanceof EnsurePartyForPatientCommand) {
        return { partyId: 'party-1', organizationId: 'org-1' };
      }
      if (cmd instanceof ClaimInvoiceEDocumentDispatchCommand) {
        callOrder.push('claim');
        return true;
      }
      return undefined;
    });

    await processor.process(sendJob());

    expect(callOrder).toEqual(['claim', 'issue']);
  });

  it('idempotency anahtarı porta geçer (sağlayıcı tarafında tekilleştirme)', async () => {
    const issue = jest.fn().mockResolvedValue({
      documentType: EDocumentTypeSchema.enum.INTERNAL,
      uuid: null,
      status: EDocumentStatusSchema.enum.INTERNAL,
      invoiceNumber: null,
    });
    const { processor } = buildProcessor({ legalType: 'KURUM', issue });

    await processor.process(sendJob());

    const request = issue.mock.calls[0][0] as EDocumentRequest;
    expect(request.idempotencyKey).toBe('inv-1');
  });

  it('port patlarsa fatura FAILED işaretlenir, alarm yayınlanır ve hata yükseltilir', async () => {
    const issue = jest.fn().mockRejectedValue(new Error('entegratör 503'));
    const { processor, commandBus, criticalFailure } = buildProcessor({
      legalType: 'KURUM',
      issue,
    });

    await expect(processor.process(sendJob())).rejects.toThrow(
      'entegratör 503'
    );

    const failCall = (commandBus.execute as jest.Mock).mock.calls.find(
      ([c]) => c instanceof MarkInvoiceEDocumentFailedCommand
    );
    expect(failCall).toBeDefined();
    expect(
      (failCall![0] as MarkInvoiceEDocumentFailedCommand).payload.invoiceId
    ).toBe('inv-1');
    expect(criticalFailure.publish).toHaveBeenCalledWith(
      expect.objectContaining({ operation: 'finance.e-document.send' })
    );
  });

  it("iptal job'u: portun cancel'ı ETTN + gerekçeyle çağrılır", async () => {
    const { processor, port } = buildProcessor({
      legalType: 'KURUM',
      issue: jest.fn(),
    });

    await processor.process(cancelJob());

    expect(port.cancel).toHaveBeenCalledWith({
      clinicId: 'clinic-1',
      documentType: EDocumentTypeSchema.enum.E_ARSIV,
      uuid: 'ettn-1',
      reason: 'Tutar hatalı girildi',
    });
  });

  it('iptal bildirimi hatası YUTULMAZ: alarm düşer ve job yeniden denenir', async () => {
    const { processor, port, criticalFailure } = buildProcessor({
      legalType: 'KURUM',
      issue: jest.fn(),
    });
    (port.cancel as jest.Mock).mockRejectedValue(new Error('entegratör 503'));

    await expect(processor.process(cancelJob())).rejects.toThrow(
      'entegratör 503'
    );

    // Yutulsaydı "yerelde iptal, vergi idaresinde geçerli" belge kalıcı ve
    // görünmez olurdu (CLAUDE.md finans kuralı 4).
    expect(criticalFailure.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: 'finance.e-document.cancel',
        severity: 'CRITICAL',
        clinicId: 'clinic-1',
      })
    );
  });
});
