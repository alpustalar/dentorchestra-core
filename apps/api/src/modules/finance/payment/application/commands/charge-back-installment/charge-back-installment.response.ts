/**
 * Ters ibrazın ödeme planına yansıma sonucu. Bir saga adımının çıktısıdır: çağıran
 * (kart itirazı çözümü) sonucu kendi kaydına yazar ve `NO_MATCHING_INSTALLMENT`
 * için operasyonu uyarır — plan tarafı hata vermeden "yansıtılamadı" diyebilir,
 * çünkü sağlayıcı parayı çoktan geri almıştır ve defter geri sarılamaz.
 */
export type ChargeBackInstallmentResponse =
  | {
      outcome: 'CHARGED_BACK';
      /** Geri alınan taksit. */
      installmentId: string;
      /** Aynı tutarda açılan telafi taksidi (hastadan yeniden tahsil edilecek). */
      recoveryInstallmentId: string;
    }
  /** Ödeme planı yok (kayıt silinmiş / bağ kurulmamış): yansıtılacak taksit yok. */
  | { outcome: 'NOT_LINKED' }
  /**
   * Plan var ama itiraz tutarına birebir eşit tamamlanmış taksit yok (kısmi
   * itiraz ya da taksit zaten başka bir durumda). Yanlış taksiti kapatmaktansa
   * plana dokunulmaz; elle eşleştirme gerekir.
   */
  | { outcome: 'NO_MATCHING_INSTALLMENT' };
