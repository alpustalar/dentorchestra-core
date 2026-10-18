import { Logger } from '@nestjs/common';
import { CriticalFailurePublisher } from './critical-failure.publisher';
import { CriticalFailureEvent } from '@common/observability/critical-failure.event';

/**
 * Bu yayıncının tek sözleşmesi var: **asla fırlatmaz**. Çağrıldığı yerler
 * `catch` blokları — fırlatırsa, zaten başarısız olmuş bir akışı ikinci kez
 * düşürür ve asıl hatayı maskeler.
 */
describe('CriticalFailurePublisher', () => {
  const payload = {
    operation: 'finance.ledger.enqueue',
    severity: 'CRITICAL' as const,
    summary: 'Cari kayıt kuyruğa alınamadı.',
    errorMessage: 'connection refused',
    context: { installmentId: 'inst-1' },
    clinicId: 'clinic-1',
    dedupeKey: 'ledger-enqueue-failed:inst-1',
  };

  it('event adıyla ve payload alanlarını taşıyarak yayınlar', () => {
    const emitAsync = jest.fn().mockResolvedValue([]);
    const publisher = new CriticalFailurePublisher({
      emitAsync,
      listenerCount: () => 1,
    } as never);

    publisher.publish(payload);

    expect(emitAsync).toHaveBeenCalledTimes(1);
    const [name, event] = emitAsync.mock.calls[0] as [
      string,
      CriticalFailureEvent,
    ];
    expect(name).toBe(CriticalFailureEvent.NAME);
    expect(event).toBeInstanceOf(CriticalFailureEvent);
    expect(event.operation).toBe('finance.ledger.enqueue');
    expect(event.dedupeKey).toBe('ledger-enqueue-failed:inst-1');
  });

  it('event bus patlasa bile fırlatmaz', () => {
    const emitAsync = jest.fn(() => {
      throw new Error('event bus down');
    });
    const publisher = new CriticalFailurePublisher({
      emitAsync,
      listenerCount: () => 1,
    } as never);

    expect(() => publisher.publish(payload)).not.toThrow();
  });

  /**
   * Dinleyici artık hatayı yukarı fırlatıyor (`@OnDomainEvent`). Bu yayıncı
   * sonucu beklemediği için reddedilen promise **yakalanmak zorunda**: aksi hâlde
   * unhandled rejection süreci düşürür — hem de bir uyarı gönderirken.
   */
  it('dinleyici hata verirse unhandled rejection bırakmaz', async () => {
    const emitAsync = jest
      .fn()
      .mockRejectedValue(new Error('alarm kanalı yok'));
    const publisher = new CriticalFailurePublisher({
      emitAsync,
      listenerCount: () => 1,
    } as never);
    const unhandled = jest.fn();
    process.once('unhandledRejection', unhandled);

    publisher.publish(payload);
    await new Promise((resolve) => setImmediate(resolve));

    expect(unhandled).not.toHaveBeenCalled();
    process.off('unhandledRejection', unhandled);
  });

  it('uyarı girdisi occurredAt taşır (kanalda zaman damgası görünsün)', () => {
    const event = new CriticalFailureEvent(payload);
    const input = event.toAlertInput();

    expect(input.occurredAt).toBeInstanceOf(Date);
    expect(input.summary).toBe('Cari kayıt kuyruğa alınamadı.');
    expect(input.context).toEqual({ installmentId: 'inst-1' });
  });

  /**
   * Alarmın son durağı: dinleyici DI grafiğinden düşmüşse `emitAsync` sıfır
   * dinleyiciye yayın yapar ve **hiçbir şey olmaz**. O durumda uyarı içeriği
   * log'a basılır — sistemde "CRITICAL uyarı çıkar" diye kapatılmış onlarca
   * güvencenin son savunması budur.
   */
  it("dinleyici yoksa yayın yapmaz, uyarı içeriğini log'a basar", () => {
    const emitAsync = jest.fn().mockResolvedValue([]);
    const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();

    const publisher = new CriticalFailurePublisher({
      emitAsync,
      listenerCount: () => 0,
    } as never);

    publisher.publish(payload);

    expect(emitAsync).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Cari kayıt kuyruğa alınamadı.')
    );
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('inst-1'));

    errorSpy.mockRestore();
  });
});
