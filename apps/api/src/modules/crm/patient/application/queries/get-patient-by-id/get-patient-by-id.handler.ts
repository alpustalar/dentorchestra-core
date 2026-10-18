import {Inject} from '@nestjs/common';
import {IQueryHandler, QueryHandler} from '@nestjs/cqrs';
import {GetPatientByIdQuery} from './get-patient-by-id.query';
import {GetPatientByIdResponse} from './get-patient-by-id.response';
import {
    IPatientQueryRepository,
    PATIENT_QUERY_REPOSITORY,
} from '@modules/crm/patient/domain/repositories/patient/patient.query.repository';
import {
    IPolicyFactory,
    POLICY_FACTORY,
} from '@modules/platform/policy/staff/domain/interfaces/policy-factory.interface';
import {
    PatientAccessDeniedException,
    PatientNotFoundException,
} from '@modules/crm/patient/domain/exceptions/patient.exceptions';

@QueryHandler(GetPatientByIdQuery)
export class GetPatientByIdHandler
    implements IQueryHandler<GetPatientByIdQuery, GetPatientByIdResponse> {
    constructor(
        @Inject(PATIENT_QUERY_REPOSITORY)
        private readonly patientQueryRepo: IPatientQueryRepository,
        @Inject(POLICY_FACTORY)
        private readonly policyFactory: IPolicyFactory
    ) {
    }

    async execute(query: GetPatientByIdQuery): Promise<GetPatientByIdResponse> {
        const patient = await this.patientQueryRepo.findById(query.patientId);
        if (!patient) throw new PatientNotFoundException();


        const scope = {
            organizationId: patient.organizationId,
            clinicId: patient.clinicId,
        };


        return {
            data: patient,
            meta: {
                serializationOptions: this.policyFactory.patient(
                    query.ctx.actor,
                    query.ctx.source
                ).policy.getSerializationOptions(scope)
            },
        };
    }
}
