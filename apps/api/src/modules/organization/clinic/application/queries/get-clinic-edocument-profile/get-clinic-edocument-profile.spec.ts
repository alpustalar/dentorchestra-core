import { GetClinicEDocumentProfileHandler } from './get-clinic-edocument-profile.handler';
import { GetClinicEDocumentProfileQuery } from './get-clinic-edocument-profile.query';
import type { IClinicQueryRepository } from '@modules/organization/clinic/domain/repositories/clinic/clinic.query.repository';
import type { IGetContext } from '@common/decorators';

describe('GetClinicEDocumentProfileHandler', () => {
  it('domain/Prisma nesnesi yerine yalnız e-belge profilini döndürür', async () => {
    const clinic = {
      id: 'clinic-1',
      name: 'Örnek Klinik',
      phone: '555',
      email: 'klinik@example.com',
      address: 'Adres',
      city: 'İstanbul',
      district: 'Kadıköy',
      slug: 'ornek',
      secretField: 'sızmamalı',
    };
    const repo = {
      findById: jest.fn().mockResolvedValue(clinic),
    } as unknown as IClinicQueryRepository;
    const handler = new GetClinicEDocumentProfileHandler(repo);

    const result = await handler.execute(
      new GetClinicEDocumentProfileQuery(
        'clinic-1',
        {} as unknown as IGetContext
      )
    );

    expect(result.data).toEqual({
      id: 'clinic-1',
      name: 'Örnek Klinik',
      phone: '555',
      email: 'klinik@example.com',
      address: 'Adres',
      city: 'İstanbul',
      district: 'Kadıköy',
    });
    expect(result.data).not.toHaveProperty('secretField');
  });
});
