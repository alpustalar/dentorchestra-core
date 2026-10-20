import { EventEmitter2 } from '@nestjs/event-emitter';
import { CreateClinicHandler } from './create-clinic.handler';
import { CreateClinicCommand } from './create-clinic.command';
import { AttachClinicToOrganizationOwnersCommand } from '@modules/identity/user/application/commands/attach-clinic-to-organization-owners/attach-clinic-to-organization-owners.command';
import { PolicyFactory } from '@modules/platform/policy/staff/application/policy-factory';
import { ExecutionSources } from '../../../../../../../../../packages/shared/common/constants/execution-source.constant';
import { LogSource } from '@src/domain/constants/log-action.constant';
import { ActorContext } from '@common/interfaces';
import type { IGetContext } from '@common/decorators/get-context.decorator';

/**
 * Sahiplik organizasyon seviyesinde durur, `managedClinics` açık bir atamadır:
 * kayıt akışı ilk kliniği bağlıyordu ama sonradan açılan klinikler bağlanmıyordu.
 * Bağ aynı transaction'da kurulur — klinik yaratılıp bağ kurulmadan kalırsa
 * boşluk sessizce geri döner.
 */
describe('CreateClinicHandler — sahibin yönettiği klinikler', () => {
  const ORG = '55555555-5555-4555-8555-555555555555';
  const CLINIC = '11111111-1111-4111-8111-111111111111';

  const owner: ActorContext = {
    userId: 'user-1',
    email: 'owner@clinic.com',
    source: LogSource.WEB,
    capabilities: [],
    rolePriority: 95,
    managedClinics: [],
    ownedOrganizations: [{ id: ORG }],
    organizationId: ORG,
  };

  const build = () => {
    const commandBus = { execute: jest.fn().mockResolvedValue(undefined) };
    const clinicCommandRepo = {
      create: jest.fn().mockResolvedValue({ id: { value: CLINIC } }),
    };
    const order: string[] = [];

    const handler = new CreateClinicHandler(
      {
        create: jest.fn(async (...args) => {
          order.push('clinic-created');
          return clinicCommandRepo.create(...args);
        }),
      } as never,
      new PolicyFactory(new EventEmitter2()),
      {
        execute: jest.fn(async (c: unknown) => {
          order.push('owners-attached');
          return commandBus.execute(c);
        }),
      } as never,
      { run: jest.fn((cb: () => unknown) => cb()) } as never
    );

    const ctx: IGetContext = {
      actor: owner,
      source: ExecutionSources.USER_ACTION,
    };

    return { handler, commandBus, order, ctx };
  };

  it('klinik oluşturulunca organizasyon sahipleri yönetici olarak bağlanır', async () => {
    const { handler, commandBus, ctx } = build();

    const id = await handler.execute(
      new CreateClinicCommand({
        data: {
          name: 'Şube 2',
          organizationId: ORG,
          sectorId: '22222222-2222-4222-8222-222222222222',
          consultationSlotDuration: 15,
        } as never,
        ctx,
      })
    );

    expect(id).toBe(CLINIC);
    expect(commandBus.execute).toHaveBeenCalledWith(
      new AttachClinicToOrganizationOwnersCommand(ORG, CLINIC)
    );
  });

  it('bağ, klinik yazıldıktan sonra ve aynı transaction içinde kurulur', async () => {
    const { handler, order, ctx } = build();

    await handler.execute(
      new CreateClinicCommand({
        data: {
          name: 'Şube 2',
          organizationId: ORG,
          sectorId: '22222222-2222-4222-8222-222222222222',
          consultationSlotDuration: 15,
        } as never,
        ctx,
      })
    );

    expect(order).toEqual(['clinic-created', 'owners-attached']);
  });
});
