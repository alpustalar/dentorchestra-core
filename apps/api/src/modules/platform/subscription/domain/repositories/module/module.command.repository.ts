import { Module } from '@modules/platform/subscription/domain/entities/module.entity';
import { IBaseCommandRepository } from '@common/domain/repositories/base-command-repository.interface';

export const MODULE_COMMAND_REPOSITORY = Symbol('IModuleCommandRepository');

export interface IModuleCommandRepository extends IBaseCommandRepository<Module> {
  findByKey(key: string): Promise<Module | null>;
}
