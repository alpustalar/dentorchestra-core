import { Capability, Role as IRole, RoleCapability } from '@shared';
import { AggregateRoot } from '@common/domain/aggregate-root';
import { Name } from '@src/domain/value-objects/name.vo';
import { UUID } from '@src/domain/value-objects/uuid.vo';
import { Slug } from '@src/domain/value-objects/slug.vo';
import { DateTimeManager } from '@shared/common/utils/date-time/date-time.manager';
import { CreateRoleProps } from '@modules/identity/role/domain/contracts/role';
import { Priority } from '@src/domain/value-objects/priority.vo';
import { Guard } from '@common/domain/guards';

export type RoleWithCapabilities = IRole & {
  capabilities?: (RoleCapability & { capability: Capability })[];
};

export class Role extends AggregateRoot {
  constructor(data: RoleWithCapabilities) {
    super();
    this._id = UUID.fromTrusted(data.id);
    this._name = Name.fromTrusted(data.name);

    this._priority = Priority.fromTrusted(data.priority);
    this._isSystemRole = data.isSystemRole;
    this._createdAt = data.createdAt;
    this._updatedAt = data.updatedAt;
    this._capabilities = data.capabilities
      ? data?.capabilities?.map((rc) => rc.capability)
      : null;
  }

  private _id: UUID;

  get id(): UUID {
    return this._id;
  }

  private _name: Name;

  get name(): Name {
    return this._name;
  }

  get slug(): Slug {
    return this.name.toSlug();
  }

  private _priority: Priority;

  get priority(): Priority {
    return this._priority;
  }

  private _isSystemRole: boolean;

  get isSystemRole(): boolean {
    return this._isSystemRole;
  }

  private _createdAt: Date;

  get createdAt(): Date {
    return this._createdAt;
  }

  private _updatedAt: Date;

  get updatedAt(): Date {
    return this._updatedAt;
  }

  private _capabilities: Capability[] | null;

  get capabilities(): readonly Capability[] | null {
    return this._capabilities;
  }

  public get validate() {
    return {
      hasCapability: (module: string, action: string) =>
        this.hasCapability(module, action),
      canManage: (otherRole: Role) => this.canManage(otherRole),
    };
  }

  public static create(input: CreateRoleProps): Role {
    const roleId = UUID.generate();
    const roleName = Name.create(input.name).orThrow();

    const now = DateTimeManager.create();

    return new Role({
      id: roleId.value,
      name: roleName.value,
      slug: roleName.toSlug().value,
      priority: input.priority,
      isSystemRole: false,
      createdAt: now,
      updatedAt: now,
      capabilities: [],
    });
  }

  toPersistence(): IRole {
    return {
      id: this.id.value,
      name: this.name.value,
      slug: this.slug.value,
      priority: this.priority.value,
      isSystemRole: this.isSystemRole,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  private hasCapability(module: string, action: string) {
    let isValid = false;
    if (this.capabilities) {
      isValid = this.capabilities.some(
        (c) => c.module === module && c.action === action
      );
    }
    return Guard.monitor(
      isValid,
      isValid,
      () => new Error('Rol hedef kabiliyete sahip değil')
    );
  }

  private canManage(otherRole: Role) {
    return this.priority.validate.isHigherThan(otherRole.priority);
  }
}
