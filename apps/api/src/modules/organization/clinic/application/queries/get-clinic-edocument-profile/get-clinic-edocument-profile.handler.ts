import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import {
  CLINIC_QUERY_REPOSITORY,
  IClinicQueryRepository,
} from '@modules/organization/clinic/domain/repositories/clinic/clinic.query.repository';
import { GetClinicEDocumentProfileQuery } from './get-clinic-edocument-profile.query';
import type { GetClinicEDocumentProfileResponse } from './get-clinic-edocument-profile.response';

@QueryHandler(GetClinicEDocumentProfileQuery)
export class GetClinicEDocumentProfileHandler implements IQueryHandler<
  GetClinicEDocumentProfileQuery,
  GetClinicEDocumentProfileResponse
> {
  constructor(
    @Inject(CLINIC_QUERY_REPOSITORY)
    private readonly clinicRepo: IClinicQueryRepository
  ) {}

  async execute(
    query: GetClinicEDocumentProfileQuery
  ): Promise<GetClinicEDocumentProfileResponse> {
    const clinic = await this.clinicRepo.findById(query.clinicId);

    return {
      data: clinic
        ? {
            id: clinic.id,
            name: clinic.name,
            phone: clinic.phone,
            email: clinic.email,
            address: clinic.address,
            city: clinic.city,
            district: clinic.district,
          }
        : null,
    };
  }
}
