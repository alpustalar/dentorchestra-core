import { IQuery } from '@nestjs/cqrs';
import { GetHotelRateOptionResponse } from './get-hotel-rate-option.response';
import { QuoteOptionClaim } from '@modules/crm/health-tourism/shared/domain/quote-option/quote-option.contracts';

/**
 * Kısa optionId → HotelBeds rate bağlamını cache'ten çözer (`book_hotel` için).
 * Süresi dolmuşsa data=null döner. Cross-module: AI executor bus üzerinden erişir.
 */
export class GetHotelRateOptionQuery implements IQuery {
  readonly __responseType!: GetHotelRateOptionResponse;

  /**
   * `claim`: teklifi kullanmak isteyen tarafın kapsamı (görüşme ya da yalnız
   * klinik). Teklif **bu kapsamla birlikte** okunur; kayıt başka bir
   * kiracıya/görüşmeye aitse sorgu `QuoteOptionRejectedException` fırlatır —
   * anahtarı bilmek yetki değildir.
   */
  constructor(
    public readonly optionId: string,
    public readonly claim: QuoteOptionClaim
  ) {}
}
