import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';

export class EDocumentIntegrationResponseDto {
  @Expose() id: string;
  @ApiProperty({ enum: ['CLINIC', 'ORGANIZATION'] })
  @Expose()
  scope: 'CLINIC' | 'ORGANIZATION';
  @ApiProperty({ enum: ['NILVERA', 'LOGO', 'PARASUT'] })
  @Expose()
  provider: 'NILVERA' | 'LOGO' | 'PARASUT';
  @ApiProperty({ enum: ['TEST', 'PRODUCTION'] })
  @Expose()
  environment: 'TEST' | 'PRODUCTION';
  @Expose() configured: true;
  @Expose() credentialHint: string | null;
  @Expose() inherited: boolean;
  @Expose() sourceId: string;
  @Expose() lastTestSucceeded: boolean | null;
  @Type(() => Date) @Expose() lastTestedAt: Date | null;
  @Type(() => Date) @Expose() updatedAt: Date;
}
