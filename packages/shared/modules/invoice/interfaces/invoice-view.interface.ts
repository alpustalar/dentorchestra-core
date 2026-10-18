/**
 * `apps/api` → `InvoiceQueryController` cevap sözleşmeleri.
 *
 * Fatura no / durum / kesim tarihi operasyon tier'ında (resepsiyon takip eder);
 * tutar ve KDV kırılımı finans tier'ında. Yetkisi olmayan aktörün cevabından o
 * alanlar **silinerek** geldiği için `?:` yazılıdır — `null` "boş", `undefined`
 * "görme yetkin yok" demek.
 */

/** Fatura liste satırı (`InvoiceListItemResponseDto`). */
export interface InvoiceListItemView {
  id?: string;
  clinicId?: string;
  patientId?: string;
  status?: string;
  invoiceNumber?: string | null;
  issuedAt?: string | null;

  // --- Finans tier'ı ---
  grandTotal?: string;
  currency?: string;

  // --- Yönetim tier'ı ---
  organizationId?: string;
  createdAt?: string;
}

/** Fatura detayı (`InvoiceViewResponseDto`). */
export interface InvoiceDetailView {
  id?: string;
  clinicId?: string;
  patientId?: string;
  status?: string;
  issuedAt?: string | null;

  /**
   * İptal izi. `status === 'CANCELLED'` belgenin hükümsüz olduğunu söyler;
   * kullanıcıya gösterilecek "ne zaman / neden" bu iki alandan gelir. İptal
   * edilmemiş faturada `null`.
   */
  cancelledAt?: string | null;
  cancelReason?: string | null;

  // --- Finans tier'ı ---
  netTotal?: string;
  vatTotal?: string;
  grandTotal?: string;
  vatRate?: string;
  currency?: string;

  // --- Yönetim tier'ı ---
  organizationId?: string;
}
