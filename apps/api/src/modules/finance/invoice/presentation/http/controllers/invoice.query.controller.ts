import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard, CapabilityGuard } from '@modules/identity/auth/auth/guards';
import { GetContext, HasCapability, IGetContext } from '@common/decorators';
import { PaginationDto } from '@shared';
import { TSQueryBus } from '@common/cqrs/type-safe-query-bus';
import { FindInvoicesQuery } from '@modules/finance/invoice/application/queries/find-invoices/find-invoices.query';
import { GetInvoiceByPaymentIdQuery } from '@modules/finance/invoice/application/queries/get-invoice-by-payment-id/get-invoice-by-payment-id.query';
import { GetInvoiceByIdQuery } from '@modules/finance/invoice/application/queries/get-invoice-by-id/get-invoice-by-id.query';
import { Serialize } from '@common/decorators/serialize.decorator';
import {
  InvoiceListItemResponseDto,
  InvoiceViewResponseDto,
} from '@modules/finance/invoice/presentation/http/dto/invoice-response.dto';
import type {
  InvoiceListItem,
  InvoiceView,
} from '@modules/finance/invoice/domain/contracts/invoice';
import { CAPABILITIES } from '@src/infrastructure/persistence/prisma/data/modules';
import { FindUninvoicedPaymentsQuery } from '@modules/finance/invoice/application/queries/find-uninvoiced-payments/find-uninvoiced-payments.query';
import { GetUninvoicedPaymentsFilterDto } from '@shared/modules/invoice/dto/queries';

/**
 * Fatura okuma yüzeyi. Faturalar event-driven üretildiği için manuel kesim endpoint'i
 * yoktur; yalnız listeleme/detay. Kapsam aktörün organizasyonu + kliniğidir (policy).
 */
const { INVOICE } = CAPABILITIES;
@UseGuards(AuthGuard, CapabilityGuard)
@HasCapability(INVOICE.read)
@Controller()
export class InvoiceQueryController {
  constructor(private readonly queryBus: TSQueryBus) {}

  @Get()
  @Serialize<InvoiceListItem, InvoiceListItemResponseDto>(
    InvoiceListItemResponseDto
  )
  list(
    @Query() pagination: PaginationDto,
    @GetContext() ctx: IGetContext,
    @Query('organizationId', ParseUUIDPipe) organizationId: string,
    @Query('clinicId') clinicId?: string
  ) {
    return this.queryBus.execute(
      new FindInvoicesQuery({ pagination, ctx, clinicId, organizationId })
    );
  }

  /**
   * Tahsilatı alınmış ama faturası kesilmemiş ödemeler (mutabakat).
   *
   * Fatura kesimi olay güdümlü ve tetikleyici dinleyiciler hatayı yutuyor; fatura
   * HİÇ oluşmamışsa ekonomik olay da yazılmadığı için fişleme mutabakatı
   * (`sweep-unposted-financial-events`) bunu göremez. Bu uç o boşluğun raporu,
   * `POST /invoices/backfill` ise telafisidir.
   */
  @Get('uninvoiced-payments')
  uninvoicedPayments(
    @Query() filter: GetUninvoicedPaymentsFilterDto,
    @GetContext() ctx: IGetContext
  ) {
    return this.queryBus.execute(
      new FindUninvoicedPaymentsQuery({ filter, ctx })
    );
  }

  // ':id'den ÖNCE tanımlı olmalı; aksi halde 'by-payment' bir id gibi eşleşir.
  @Get('by-payment/:paymentId')
  @Serialize<InvoiceView, InvoiceViewResponseDto>(InvoiceViewResponseDto)
  getByPaymentId(
    @Param('paymentId') paymentId: string,
    @GetContext() ctx: IGetContext
  ) {
    return this.queryBus.execute(
      new GetInvoiceByPaymentIdQuery(paymentId, ctx)
    );
  }

  @Get(':id')
  @Serialize<InvoiceView, InvoiceViewResponseDto>(InvoiceViewResponseDto)
  getById(@Param('id') id: string, @GetContext() ctx: IGetContext) {
    return this.queryBus.execute(new GetInvoiceByIdQuery(id, ctx));
  }
}
