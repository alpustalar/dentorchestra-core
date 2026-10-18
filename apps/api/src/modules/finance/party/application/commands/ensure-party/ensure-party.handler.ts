import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { TransactionManager } from '@src/infrastructure/persistence/prisma/transaction/transaction.manager';
import { Party } from '@modules/finance/party/domain/entities/party.entity';
import { EnsurePartyCommand } from './ensure-party.command';
import { normalizeArray } from '@common/utils/normalize-array';
import { PartyAlreadyExistsException } from '@modules/finance/party/domain/exceptions/party.exceptions';
import {
  IPartyCommandRepository,
  PARTY_COMMAND_REPOSITORY,
} from '@modules/finance/party/domain/repositories/party/party.command.repository';

@CommandHandler(EnsurePartyCommand)
export class EnsurePartyHandler implements ICommandHandler<
  EnsurePartyCommand,
  string
> {
  constructor(
    @Inject(PARTY_COMMAND_REPOSITORY)
    private readonly partyRepo: IPartyCommandRepository,
    private readonly txManager: TransactionManager
  ) {}

  async execute(command: EnsurePartyCommand): Promise<string> {
    const { input } = command;

    const ExistingParty = await this.partyRepo.findByOrigin(
      input.clinicId,
      input.originType,
      input.originId
    );

    if (ExistingParty) {
      ExistingParty.ensure(input);
      await this.txManager.run(() => this.partyRepo.update(ExistingParty));
      return ExistingParty.id.value;
    }

    const party = Party.create({ ...input, roles: normalizeArray(input.role) });

    try {
      await this.txManager.run(() => this.partyRepo.create(party));
      return party.id.value;
    } catch (error) {
      // Eşzamanlı ensure çağrısı aynı origin için cari oluşturmuş olabilir
      // (clinicId+originType+originId unique). Bu durumda mevcut olanı döndür.
      if (error instanceof PartyAlreadyExistsException) {
        const raced = await this.partyRepo.findByOrigin(
          input.clinicId,
          input.originType,
          input.originId
        );
        if (raced) return raced.id.value;
      }
      throw error;
    }
  }
}
