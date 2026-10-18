import { Logger } from '@nestjs/common';
import { CriticalFailurePublisher } from '@common/observability/critical-failure.publisher';

export interface ProcessFailureAlarmOptions {
  publisher: CriticalFailurePublisher;
  /** Süreç olaylarının kaynağı — testte sahte bir emitter geçilir. */
  source?: Pick<NodeJS.Process, 'on'>;
  /** Çıkış işlemi — testte gözlemlenir. */
  exit?: (code: number) => void;
  /** Uyarının ağa çıkması için beklenen süre; sonra süreç kapanır. */
  flushMs?: number;
}

/**
 * Sürecin **ölümünü** operasyonel kanala taşır.
 *
 * Yakalanmayan bir promise reddi ya da exception Node'u düşürür (bu projede
 * ölçüldü: §77'de `emitDetached` tam bu yüzden var). Düştüğü anda uçuşta olan
 * istekler yarıda kalır — finans tarafında bu, "para alındı, defter yazılmadı"
 * ya da "sağlayıcıda rezervasyon açık, kaydı yok" demektir. Platform süreci
 * yeniden başlatır ve **hiç kimseye haber verilmez**: tek iz, kimsenin izlemediği
 * bir stdout satırıdır.
 *
 * Bu yüzden ölüm de bir uyarıdır. Süreç **yine kapanır** — ayakta tutmak daha
 * kötüsüdür: durumu bozulmuş bir süreç para hareketine devam eder. Yalnız
 * kapanmadan önce uyarının ağa çıkması için kısa bir pencere bırakılır.
 */
export function installProcessFailureAlarms(
  options: ProcessFailureAlarmOptions
): void {
  const logger = new Logger('ProcessFailureAlarms');
  const source = options.source ?? process;
  const exit = options.exit ?? ((code: number) => process.exit(code));
  const flushMs = options.flushMs ?? 500;

  // Çifte tetikleme koruması: ilk ölüm uyarısı yeterli, ikincisi kanalı meşgul
  // eder ve çıkışı geciktirir.
  let dying = false;

  const die = (operation: string, summary: string, reason: unknown): void => {
    if (dying) return;
    dying = true;

    const error = reason instanceof Error ? reason : undefined;

    logger.error(summary, error?.stack ?? String(reason));

    options.publisher.publish({
      operation,
      severity: 'CRITICAL',
      summary,
      errorMessage: error ? error.message : String(reason),
      context: {
        // Yığın izi uyarı kanalına taşınmaz (kanal dışına sızmasın — bkz.
        // `OpsAlertInput.errorMessage`); kanala adres, log'a ayrıntı.
        errorName: error?.name ?? typeof reason,
        pid: process.pid,
      },
      clinicId: null,
      dedupeKey: `${operation}:${error?.name ?? 'unknown'}`,
    });

    setTimeout(() => exit(1), flushMs);
  };

  source.on('unhandledRejection', (reason: unknown) => {
    die(
      'process.unhandled-rejection',
      'Yakalanmayan promise reddi: süreç kapanıyor, uçuşta olan istekler yarıda kaldı.',
      reason
    );
  });

  source.on('uncaughtException', (error: Error) => {
    die(
      'process.uncaught-exception',
      'Yakalanmayan exception: süreç kapanıyor, uçuşta olan istekler yarıda kaldı.',
      error
    );
  });
}
