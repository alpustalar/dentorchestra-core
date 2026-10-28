import { Patient } from '@dentorchestra/shared/client';
import { DateTimeManager } from '@shared/common';

const currentYear = DateTimeManager.currentYear();
const today = DateTimeManager.startOfDay(DateTimeManager.create());
const recordCreatedAt = DateTimeManager.startOfYear(currentYear);

export const patients: Patient[] = [
  {
    id: '1',
    firebaseUid: '35',
    organizationId: 'org_1',
    clinicId: 'clinic_1',
    sectorId: 'sector_dental',
    firstName: 'Elif',
    lastName: 'Yıldız',
    tcNo: '12345678902',
    protocolNo: `MD-${currentYear}-0184`,
    status: 'ACTIVE', // PatientStatusSchema Enum değeri
    patientType: 'ACTIVE', // PatientTypeSchema Enum değeri
    phone: '05324812218',
    alternativePhone: null,
    email: 'elif.yildiz@example.com',
    gender: 'FEMALE', // GenderSchema Enum değeri
    bloodType: 'A_POS', // BloodTypeSchema Enum değeri
    birthDate: DateTimeManager.create('1988-05-14'),
    address: 'Nilüfer, Bursa',
    emergencyContact: null,
    companionName: null,
    companionPhone: null,
    profilePhoto: null,
    allergies: 'Penisilin',
    chronicDiseases: 'Yok',
    responsibleProviderId: 'provider_dr_kaya',
    checkupDate: DateTimeManager.addDays(today, 7),
    createdAt: DateTimeManager.create(recordCreatedAt),
    updatedAt: DateTimeManager.create(recordCreatedAt),
    deletedAt: null,
  },
  {
    id: '2',
    firebaseUid: '34',
    organizationId: 'org_1',
    clinicId: 'clinic_1',
    sectorId: 'sector_intl',
    firstName: 'James',
    lastName: 'Miller',
    tcNo: null,
    protocolNo: `MD-${currentYear}-0183`,
    status: 'ACTIVE',
    patientType: 'POTENTIAL',
    phone: '+442079460912',
    alternativePhone: null,
    email: 'james.miller@example.com',
    gender: 'MALE',
    bloodType: 'O_POS',
    birthDate: DateTimeManager.create('1981-09-22'),
    address: 'London, United Kingdom',
    emergencyContact: null,
    companionName: null,
    companionPhone: null,
    profilePhoto: null,
    allergies: 'Bilinmiyor',
    chronicDiseases: 'Yok',
    responsibleProviderId: 'provider_op_dr_demir',
    checkupDate: DateTimeManager.addDays(today, 9),
    createdAt: DateTimeManager.addDays(recordCreatedAt, 1),
    updatedAt: DateTimeManager.addDays(recordCreatedAt, 1),
    deletedAt: null,
  },
];
