import { CreateModuleHandler } from './create-module.handler';
import { CreateModuleCommand } from './create-module.command';
import { Module } from '@modules/platform/subscription/domain/entities/module.entity';
import { SubscriptionModuleAlreadyExistsException } from '@modules/platform/subscription/domain/exceptions/subscription.exceptions';
import { IModuleCommandRepository } from '@modules/platform/subscription/domain/repositories/module/module.command.repository';

describe('CreateModuleHandler', () => {
  const build = (existing: Module | null) => {
    const moduleCommandRepo = {
      findByKey: jest.fn().mockResolvedValue(existing),
      create: jest.fn(async (m: Module) => m),
    } as unknown as IModuleCommandRepository;
    return {
      handler: new CreateModuleHandler(moduleCommandRepo),
      moduleCommandRepo,
    };
  };

  const cmd = () =>
    new CreateModuleCommand({
      key: 'e_invoice',
      name: 'E-Fatura',
      monthlyPrice: 50,
      currency: 'TRY',
      ctx: { actor: { userId: 'admin' } } as never,
    });

  it('yeni modül: key UPPER normalize edilir, oluşturulur, id döner', async () => {
    const t = build(null);
    const id = await t.handler.execute(cmd());
    expect(t.moduleCommandRepo.findByKey).toHaveBeenCalledWith('E_INVOICE');
    expect(t.moduleCommandRepo.create).toHaveBeenCalledTimes(1);
    expect(typeof id).toBe('string');
  });

  it('aynı key mevcut → SubscriptionModuleAlreadyExistsException', async () => {
    const existing = Module.create({
      key: 'e_invoice',
      name: 'E-Fatura',
      monthlyPrice: 50,
      currency: 'TRY',
    });
    const t = build(existing);
    await expect(t.handler.execute(cmd())).rejects.toBeInstanceOf(
      SubscriptionModuleAlreadyExistsException
    );
    expect(t.moduleCommandRepo.create).not.toHaveBeenCalled();
  });
});
