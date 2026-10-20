import { User } from '@modules/identity/user/domain/entities/user.entity';
import { Injectable } from '@nestjs/common';
import { BaseCommandRepository } from '@src/infrastructure/persistence/prisma/base-command.repository';
import { PrismaService } from '@src/infrastructure/persistence/prisma/prisma.service';
import {
  GlobalStatusSchema,
  GlobalStatusType,
} from '@input-type-schemas/GlobalStatusSchema';
import { normalizeArray } from '@common/utils/normalize-array';
import { Priority } from '@src/domain/value-objects/priority.vo';
import { DateTimeManager } from '@shared/common/utils/date-time/date-time.manager';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { UsersBulkSoftDeletedEvent } from '@modules/identity/user/domain/events/user-bulk-soft-deleted.event';
import { ChangeUsersStatusEvent } from '@modules/identity/user/domain/events/change-users-status.event';
import { IUserCommandRepository } from '@modules/identity/user/domain/repositories/user/user.command.repository';
import { emitDetached } from '@common/utils';

@Injectable()
export class UserCommandRepository
  extends BaseCommandRepository<User>
  implements IUserCommandRepository
{
  constructor(
    public readonly prisma: PrismaService,
    public readonly eventEmitter: EventEmitter2
  ) {
    super(prisma);
  }

  async findById(id: string): Promise<User | null> {
    const raw = await this.db.user.findUnique({
      where: { id },
      include: {
        role: { select: { id: true, priority: true } },
        workingClinic: { select: { id: true } },
        managedClinics: { select: { id: true } },
        ownedOrganizations: { select: { id: true } },
        providerProfile: { select: { id: true } },
      },
    });

    if (!raw) return null;

    const {
      managedClinics,
      ownedOrganizations,
      providerProfile,
      role,
      ...rest
    } = raw;
    return new User({
      ...rest,
      role: {
        priority: Priority.fromTrusted(role.priority),
        id: role.id,
      },
      managedClinicIds: managedClinics.map((c) => c.id),
      ownedOrganizationIds: ownedOrganizations.map((o) => o.id),
      providerProfileId: providerProfile?.id ?? null,
    });
  }

  async create(entity: User): Promise<User> {
    const data = entity.toPersistence();
    const raw = await this.db.user.create({
      data: {
        ...data,
        ...(entity.managedClinicIds?.length && {
          managedClinics: {
            connect: entity.managedClinicIds.map((id) => ({ id: id.value })),
          },
        }),
        ...(entity.ownedOrganizationIds?.length && {
          ownedOrganizations: {
            connect: entity.ownedOrganizationIds.map((id) => ({
              id: id.value,
            })),
          },
        }),
      },
    });
    entity.flushEvents();
    return new User({
      ...raw,
      role: entity.role,
      workingClinic: entity.workingClinic,
      managedClinicIds: entity.managedClinicIds
        ? entity.managedClinicIds.map((id) => id.value)
        : [],
      ownedOrganizationIds: entity.ownedOrganizationIds
        ? entity.ownedOrganizationIds.map((id) => id.value)
        : [],
      providerProfileId: entity.providerProfileId?.value ?? null,
    });
  }

  async update(entity: User): Promise<User> {
    const create = entity.toPersistence();
    const { id, ...update } = create;
    const raw = await this.db.user.update({
      where: { id },
      // Kapsam ilişkileri (managedClinics / ownedOrganizations) burada BİLEREK
      // yazılmaz: yetki devri kendi metotlarından geçer (bkz.
      // `replaceManagedClinics`). Buraya eklenseydi, ilişkileri yüklemeden
      // kurulmuş bir entity'nin sıradan güncellemesi kapsamı silerdi.
      data: update,
    });
    entity.flushEvents();
    return new User({
      ...raw,
      role: entity.role,
      workingClinic: entity.workingClinic,
      managedClinicIds: entity.managedClinicIds
        ? entity.managedClinicIds.map((id) => id.value)
        : [],

      ownedOrganizationIds: entity.ownedOrganizationIds
        ? entity.ownedOrganizationIds.map((id) => id.value)
        : [],
      providerProfileId: entity.providerProfileId?.value ?? null,
    });
  }

  async replaceManagedClinics(entity: User): Promise<void> {
    await this.db.user.update({
      where: { id: entity.id.value },
      data: {
        updatedAt: entity.updatedAt,
        managedClinics: {
          set: (entity.managedClinicIds ?? []).map(({ value: id }) => ({ id })),
        },
      },
    });
    entity.flushEvents();
  }

  async replaceOwnedOrganizations(entity: User): Promise<void> {
    await this.db.user.update({
      where: { id: entity.id.value },
      data: {
        updatedAt: entity.updatedAt,
        ownedOrganizations: {
          set: (entity.ownedOrganizationIds ?? []).map(({ value: id }) => ({
            id,
          })),
        },
      },
    });
    entity.flushEvents();
  }

  async addManagedClinicToOrganizationOwners(
    organizationId: string,
    clinicId: string
  ): Promise<{ attachedCount: number }> {
    // `managedClinics: { none: ... }` filtresi metodu idempotent yapar: bağı zaten
    // olan sahip sorguya hiç girmez, ikinci çağrı sessizce 0 döner.
    const owners = await this.db.user.findMany({
      where: {
        ownedOrganizations: { some: { id: organizationId } },
        managedClinics: { none: { id: clinicId } },
        deletedAt: null,
      },
      select: { id: true },
    });

    if (!owners.length) return { attachedCount: 0 };

    await Promise.all(
      owners.map((owner) =>
        this.db.user.update({
          where: { id: owner.id },
          data: { managedClinics: { connect: { id: clinicId } } },
        })
      )
    );

    return { attachedCount: owners.length };
  }

  updateLastLogin(id: string) {
    return this.db.user.update({
      where: { id },
      data: { lastLogin: DateTimeManager.create() },
    });
  }

  async changeStatus(
    status: GlobalStatusType,
    clinicId: string
  ): Promise<{ affectedCount: number }> {
    const affected = await this.db.user.findMany({
      where: { workingClinic: { is: { id: clinicId } } },
      select: { id: true },
    });
    const ids = affected.map((u) => u.id);

    const batchPayload = await this.db.user.updateMany({
      where: { clinicId },
      data: { status },
    });

    emitDetached(
      this.eventEmitter,
      ChangeUsersStatusEvent.NAME,
      new ChangeUsersStatusEvent({
        userIds: ids,
      })
    );

    return { affectedCount: batchPayload.count };
  }

  async softDeleteAllByClinicIds(
    clinicId: string[] | string
  ): Promise<{ deletedCount: number }> {
    const normalizedClinicId = normalizeArray(clinicId);

    const affected = await this.db.user.findMany({
      where: {
        workingClinic: {
          id: { in: normalizedClinicId },
        },
      },
      select: { id: true },
    });

    const ids = affected.map((u) => u.id);

    if (ids.length === 0) {
      return { deletedCount: 0 };
    }

    const { count: deletedCount } = await this.db.user.updateMany({
      where: {
        id: { in: ids },
      },
      data: {
        status: GlobalStatusSchema.enum.DELETED,
        deletedAt: DateTimeManager.create(),
      },
    });

    emitDetached(
      this.eventEmitter,
      UsersBulkSoftDeletedEvent.NAME,
      new UsersBulkSoftDeletedEvent({
        userIds: ids,
      })
    );

    return { deletedCount };
  }
}
