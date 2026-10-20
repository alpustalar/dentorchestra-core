import { AccountingPeriodSchedulerProducer } from './accounting-period-scheduler.producer';

describe('AccountingPeriodSchedulerProducer', () => {
  it('aylık tekrarlı iş + açılışta bir kerelik iş kuyruğa eklenir', async () => {
    const add = jest.fn().mockResolvedValue(undefined);
    const producer = new AccountingPeriodSchedulerProducer({ add } as never);

    await producer.onModuleInit();

    expect(add).toHaveBeenCalledTimes(2);
    const [repeatCall, onceCall] = add.mock.calls;
    expect(repeatCall[2].repeat).toMatchObject({ pattern: '0 3 1 * *' });
    expect(onceCall[2].repeat).toBeUndefined();
    expect(onceCall[2].jobId).toBe('open-next-year-periods-on-boot');
    // Handler kaydından önce işlenmesin + başarısız iş sabit jobId'yi kilitlemesin.
    expect(onceCall[2].delay).toBeGreaterThan(0);
    expect(onceCall[2].attempts).toBeGreaterThan(1);
    expect(onceCall[2].removeOnFail).toBe(true);
  });
});
