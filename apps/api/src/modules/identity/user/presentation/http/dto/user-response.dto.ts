import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { ProviderResponseDto } from '@modules/clinical/provider/presentation/http/dto/provider-response.dto';
import { Role, UserResponse } from '@shared';
import { GlobalStatusType as GlobalStatus, GlobalStatusSchema } from '@input-type-schemas/GlobalStatusSchema';
import { UserResponseGroups } from '@modules/identity/user/domain/contracts';

export class RelationalDto {
  @Expose() id: string;
  @Expose() name: string;
}

const { DATA_OWNER, INTERNAL, MANAGEMENT, ADMIN } = UserResponseGroups;

export class UserResponseDto implements UserResponse {
  // --------------------
  // Identity & Core (Public)
  // --------------------
  @Expose()
  id: string;

  @Expose()
  displayName: string;

  @Expose()
  picture?: string;

  @Expose()
  clinicId?: string;

  // --------------------
  // Ownership & Privacy (Self + Management)
  // --------------------
  @Expose({ groups: [ADMIN, DATA_OWNER, MANAGEMENT] })
  email: string;

  @Expose({ groups: [ADMIN, DATA_OWNER, MANAGEMENT] })
  role: Role;

  @Expose({ groups: [ADMIN, DATA_OWNER, MANAGEMENT] })
  emailVerified: boolean;

  @Expose({ groups: [ADMIN, DATA_OWNER, MANAGEMENT] })
  lastLogin: Date;

  // --------------------
  // Management & Operational (Internal Team)
  // --------------------
  @Expose({ groups: [ADMIN, MANAGEMENT, INTERNAL] })
  @ApiProperty({ enum: GlobalStatusSchema.options })
  status: GlobalStatus;

  @Expose({ groups: [ADMIN, MANAGEMENT] })
  createdAt: Date;

  @Expose({ groups: [ADMIN, MANAGEMENT] })
  updatedAt: Date;

  @Expose({ groups: [ADMIN] })
  deletedAt?: Date;

  // --------------------
  // Relational Data (Context Specific)
  // --------------------
  @Expose({ groups: [ADMIN, MANAGEMENT] })
  @Type(() => RelationalDto)
  managedClinics?: RelationalDto[];

  @Expose({ groups: [ADMIN, MANAGEMENT] })
  @Type(() => RelationalDto)
  ownedOrganizations?: RelationalDto[];

  @Expose()
  @Type(() => ProviderResponseDto)
  providerProfile?: { id: string };
}
