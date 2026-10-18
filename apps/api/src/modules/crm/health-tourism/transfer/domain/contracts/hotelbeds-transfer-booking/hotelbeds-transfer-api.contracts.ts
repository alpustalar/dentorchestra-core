// ==========================================
// HOTELBEDS TRANSFER API ENTEGRASYONU — istek/yanıt sözleşmeleri
// (IHotelbedsTransferApi portu — infrastructure/adapters/hotelbeds ile paylaşılır)
// ==========================================

// --- 1. API İSTEK PARAMETRELERİ (AVAILABILITY SEARCH) ---

export interface TransferAvailabilityFilter {
  language: string; // Örn: "tr" veya "en-US"
  fromType: string;
  fromCode: string;
  toType: string;
  toCode: string;
  outboundDate: string; // YYYY-MM-DD formatı
  outboundTime: string; // HH:mm formatı
  adults: number;
  children: number;
  infants: number;
  ages?: string; // Örn: "5,12" (çocuk yaşları virgülle ayrılmış)
  returnDate?: string;
  returnTime?: string;
}

export interface TransferAvailabilityItem {
  id: number;
  direction: 'DEPARTURE' | 'ARRIVAL';
  transferType: string;

  vehicle: {
    code: string;
    name: string;
  };

  category: {
    code: string;
    name: string;
  };

  adults: number;
  children: number;
  infants: number;

  price: {
    totalAmount: number;
    netAmount: number;
    currencyId: string;
  };

  rateKey: string;

  pickupInformation: {
    from: { code: string; type: string };
    to: { code: string; type: string };
    date: string;
    time: string | null;
    pickup?: {
      checkPickup?: {
        mustCheckPickupTime: boolean;
        url?: string;
        hoursBeforeConsulting?: number;
      };
    };
  };

  cancellationPolicies: Array<{
    amount: number;
    from: string; // İptal politikasının geçerlilik tarihi başlangıcı
  }>;

  content?: {
    images?: unknown[];
    transferRemarks?: Array<{ type: string; text: string }>;
  };

  extras?: Array<{
    code: string;
    name: string;
    type: string;
    price: number;
    minUnits: number;
    maxUnits: number;
    required: boolean;
  }>;
}

// --- 2. REZERVASYON GİRDİ SÖZLEŞMELERİ (INPUTS & DETAILS) ---

export interface TransferDetail {
  type: 'FLIGHT' | 'CRUISE' | 'TRAIN';
  direction: 'ARRIVAL' | 'DEPARTURE';
  code: string;
  companyName?: string | null; // Örn: "THY"
}

export interface TransferBookingExtra {
  units: string; // Tedarikçi formatına uygun olarak string (Örn: "1")
  code: string; // Ekstra hizmet kodu (Örn: "BABY_SEAT")
}

export interface TransferPickupInformation {
  name?: string;
  address?: string;
  town?: string;
  country?: string;
  zip?: string;
}

export interface TransferBookingInput {
  rateKey: string;
  transferDetails: TransferDetail[];
  extras?: TransferBookingExtra[];
  pickupInformation?: TransferPickupInformation;
}

export interface CreateTransferBookingData {
  language: string;
  holder: {
    name: string;
    surname: string;
    email: string;
    phone: string;
  };
  transfers: TransferBookingInput[];
  clientReference?: string;
  welcomeMessage?: string;
  remark?: string;
}

// --- 3. API GERİ DÖNÜŞ SÖZLEŞMELERİ (RESULTS) ---

export interface TransferBookingResult {
  reference: string; // Tedarikçiden dönen pnr / rezervasyon numarası
  creationDate: string;
  status: string; // CONFIRMED, PENDING vb.
  holder: {
    name: string;
    surname: string;
    email?: string;
    phone?: string;
  };
  transfers: unknown[]; // Ham transfer sonuç objeleri için dizi zırhı
  totalAmount: number;
  currency: string;
  supplier?: {
    name: string;
  };
}

export interface CancelTransferBookingResult {
  reference: string;
  status: string; // CANCELLED
  /**
   * Sağlayıcının alıkoyduğu iptal ceza tutarı. **`null` = bildirilmedi**, `0` =
   * ücretsiz iptal: iki hâl aynı şey değildir. `?? 0` yazmak bilinmeyen cezayı
   * sessizce "ceza yok"a çevirir ve platform defteri tedarikçi borcunu olduğundan
   * fazla düşürür (zarar hiç tanınmaz) — bkz. CLAUDE.md finans kuralı 9/11.
   */
  cancellationAmount: number | null;
  /** Ceza tutarının para birimi; tutar yoksa null. */
  currency: string | null;
}
