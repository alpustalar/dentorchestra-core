import { LockAppointmentSlotHandler } from './lock-appointment-slot.handler';
import { LockAppointmentSlotCommand } from './lock-appointment-slot.command';
import { SlotTemporarilyHeldException } from '@modules/clinical/appointment/domain/exceptions/appointment.exceptions';
import { ClinicNotAssignedException } from '@src/domain/exceptions/clinic-not-assigned.exception';
import { DateTimeManager } from '@shared/common/utils/date-time/date-time.manager';

// DateTimeManager spy'ları için mock hazırlığı
jest.mock('@shared/common/utils/date-time/date-time.manager');

describe('LockAppointmentSlotHandler', () => {
  const mockNow = new Date('2026-03-01T10:00:00.000Z');
  const mockLockedUntil = new Date('2026-03-01T10:05:00.000Z');
  const sampleStartTime = new Date('2026-03-01T12:00:00.000Z');

  const build = (options?: { acquired?: boolean; ttlSeconds?: number }) => {
    const acquired = options?.acquired ?? true;
    const ttlSeconds = options?.ttlSeconds ?? 300;

    const mockSlotLock = {
      acquire: jest.fn().mockResolvedValue(acquired),
    };

    const mockCacheService = {
      slotLock: mockSlotLock,
      slotLockTtlSeconds: ttlSeconds,
    };

    return {
      mockCacheService,
      mockSlotLock,
      ttlSeconds,
    };
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (DateTimeManager.create as jest.Mock).mockReturnValue(mockNow);
    (DateTimeManager.addSeconds as jest.Mock).mockReturnValue(mockLockedUntil);
  });

  const createCommand = (payloadOverrides?: Partial<any>) => {
    return new LockAppointmentSlotCommand({
      data: {
        providerId: 'provider-123',
        startTime: sampleStartTime,
      },
      ctx: {
        actor: { userId: 'user-actor-id' },
      },
      ...payloadOverrides,
    } as any);
  };

  it('açıkça holderId verildiğinde kilidi o id ile alır ve kilit zamanını döner', async () => {
    const { mockCacheService, mockSlotLock, ttlSeconds } = build({});
    const handler = new LockAppointmentSlotHandler(mockCacheService as any);

    const command = createCommand({ holderId: 'custom-holder-id' });
    const result = await handler.execute(command);

    // Redis parametre doğrulama
    expect(mockSlotLock.acquire).toHaveBeenCalledWith({
      providerId: 'provider-123',
      startTimeIso: sampleStartTime.toISOString(),
      holderId: 'custom-holder-id',
    });

    // Zaman yönetimi ve dönen response doğrulama
    expect(DateTimeManager.create).toHaveBeenCalledTimes(1);
    expect(DateTimeManager.addSeconds).toHaveBeenCalledWith(
      mockNow,
      ttlSeconds
    );
    expect(result).toEqual({
      ttlSeconds,
      lockedUntil: mockLockedUntil,
    });
  });

  it('holderId verilmediğinde fallback olarak actor.userId kullanır', async () => {
    const { mockCacheService, mockSlotLock } = build({});
    const handler = new LockAppointmentSlotHandler(mockCacheService as any);

    const command = createCommand({ holderId: undefined });
    await handler.execute(command);

    expect(mockSlotLock.acquire).toHaveBeenCalledWith(
      expect.objectContaining({
        holderId: 'user-actor-id',
      })
    );
  });

  it('hem holderId hem de actor.userId yoksa ClinicNotAssignedException fırlatır', async () => {
    const { mockCacheService, mockSlotLock } = build({});
    const handler = new LockAppointmentSlotHandler(mockCacheService as any);

    const command = new LockAppointmentSlotCommand({
      data: { providerId: 'provider-123', startTime: sampleStartTime },
      ctx: { actor: { userId: undefined } },
      holderId: undefined,
    } as any);

    await expect(handler.execute(command)).rejects.toBeInstanceOf(
      ClinicNotAssignedException
    );

    // Kilit almaya çalışmadan hemen kesilmeli
    expect(mockSlotLock.acquire).not.toHaveBeenCalled();
  });

  it('slot zaten başkası tarafından kilitliyse SlotTemporarilyHeldException fırlatır', async () => {
    const { mockCacheService } = build({ acquired: false });
    const handler = new LockAppointmentSlotHandler(mockCacheService as any);

    const command = createCommand();

    await expect(handler.execute(command)).rejects.toBeInstanceOf(
      SlotTemporarilyHeldException
    );
  });
});
