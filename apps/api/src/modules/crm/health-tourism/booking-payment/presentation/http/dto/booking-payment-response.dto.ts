import { Expose, Type } from 'class-transformer';
import { ResponseGroups } from '../../../../../../../../../../packages/shared/common/constants/response-groups.constant';
import {
  BookingPaymentProviderValue,
  BookingPaymentStatusValue,
  BookingPaymentTypeValue,
} from '@modules/crm/health-tourism/booking-payment/domain/contracts/booking-payment';

const { INTERNAL, MANAGEMENT, DATA_OWNER, FINANCIAL, ADMIN } = ResponseGroups;

export class BookingPaymentResponseDto {
  @Expose() id: string;
  @Expose() clinicId: string;
  @Expose() organizationId: string;
  @Expose() patientId: string | null;
  @Expose() leadId: string | null;
  @Expose() conversationId: string | null;

  // --- Ödeme ve Rezervasyon Durumu (Herkese Açık) ---
  @Expose() bookingType: BookingPaymentTypeValue;
  @Expose() status: BookingPaymentStatusValue;
  @Expose() failureReason: string | null;

  // --- Satış Tutarı (Hasta Kendisi, Finans ve Üst Yönetim/Admin Görebilir) ---
  @Expose() saleCurrency: string;

  @Expose({ groups: [DATA_OWNER, FINANCIAL, MANAGEMENT, ADMIN] })
  @Type(() => Number)
  saleAmount: number;

  // --- Linkler (Ödeme yapabilmesi için Hastaya ve Süreci Yöneten İç Ekibe Açık) ---
  @Expose({ groups: [DATA_OWNER, INTERNAL, MANAGEMENT, ADMIN] })
  iyzicoUrl: string | null;

  @Expose({ groups: [DATA_OWNER, INTERNAL, MANAGEMENT, ADMIN] })
  stripeUrl: string | null;

  // --- Arka Plan Entegrasyon Detayları (Sadece Yönetim ve Admin - Hasta Göremez) ---
  @Expose({ groups: [MANAGEMENT, ADMIN] })
  intent: any; // Rezervasyon intent içeriği

  @Expose({ groups: [MANAGEMENT, ADMIN] })
  bookingReference: string | null;

  @Expose({ groups: [MANAGEMENT, ADMIN] })
  bookingId: string | null;

  // --- Finansal ve Altyapısal Sırlar (Sadece Finans, Yönetim ve Admin) ---
  @Expose({ groups: [FINANCIAL, MANAGEMENT, ADMIN] })
  @Type(() => Number)
  tryAmount: number;

  @Expose({ groups: [FINANCIAL, MANAGEMENT, ADMIN] })
  @Type(() => Number)
  netAmount: number;

  // Sağlayıcının FİİLEN ücretlendirdiği maliyet. `netAmount` teklif anındaki
  // fiyat; ikisi birlikte durmazsa sapma (komisyonun beklenenden düşük çıkması)
  // yalnız alarm kaydında görünür, finans ekranından okunamaz.
  @Expose({ groups: [FINANCIAL, MANAGEMENT, ADMIN] })
  @Type(() => Number)
  supplierAmount: number | null;

  @Expose({ groups: [FINANCIAL, MANAGEMENT, ADMIN] })
  supplierCurrency: string | null;

  // İptal ekonomisi: sağlayıcının alıkoyduğu ceza (689'a zarar olarak yazılan
  // tutar) ve iadenin KENDİ tarihi. Ekranda durmazsa sağlayıcı faturası ile
  // mutabakat yapan kişi cezanın ne kadarının kayda geçtiğini göremez.
  @Expose({ groups: [FINANCIAL, MANAGEMENT, ADMIN] })
  @Type(() => Number)
  supplierRetainedAmount: number | null;

  @Expose({ groups: [FINANCIAL, MANAGEMENT, ADMIN] })
  supplierRetainedCurrency: string | null;

  @Expose({ groups: [FINANCIAL, MANAGEMENT, ADMIN] })
  refundedAt: Date | null;

  @Expose({ groups: [FINANCIAL, MANAGEMENT, ADMIN] })
  refundReason: string | null;

  @Expose({ groups: [FINANCIAL, MANAGEMENT, ADMIN] })
  @Type(() => Number)
  fxRate: number | null;

  @Expose({ groups: [FINANCIAL, MANAGEMENT, ADMIN] })
  iyzicoConversationId: string | null;

  // `iyzicoToken` BİLİNÇLİ olarak yok: §73'teki callback bağının **yerel
  // kanıtı** o token'dır (gövdedeki token'la karşılaştırılıyor). Yanıtta
  // taşımak, kanıtı okunabilir kılar ve kontrolün değerini düşürür. Ödeme
  // bağlantıları (`iyzicoUrl`/`stripeUrl`) zaten hastaya gönderiliyor;
  // operasyonun ihtiyacı onlar, token değil.

  @Expose({ groups: [FINANCIAL, MANAGEMENT, ADMIN] })
  stripeSessionId: string | null;

  @Expose({ groups: [FINANCIAL, MANAGEMENT, ADMIN] })
  paidProvider: BookingPaymentProviderValue | null;

  @Expose({ groups: [FINANCIAL, MANAGEMENT, ADMIN] })
  paidProviderRef: string | null;

  // --- Zaman Damgaları ---
  @Expose({ groups: [FINANCIAL, MANAGEMENT, ADMIN] })
  @Type(() => Date)
  paidAt: Date | null;

  @Expose({ groups: [MANAGEMENT, ADMIN] })
  @Type(() => Date)
  createdAt: Date;

  @Expose({ groups: [MANAGEMENT, ADMIN] })
  @Type(() => Date)
  updatedAt: Date;
}
