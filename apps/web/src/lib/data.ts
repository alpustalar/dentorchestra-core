// ==========================================
// TYPES (Tip Tanımlamaları)
// ==========================================

import {
  Appointment,
  AppointmentCreatorTypeSchema,
  AppointmentSourceSchema,
  AppointmentStatusSchema,
  Clinic,
  ExaminationTypeSchema,
  ExternalSystemSchema,
  TimeZoneSchema,
  VisitTypeSchema,
} from '@shared/generated-zod';
import { DateTimeManager } from '@shared/common';
import { dateAtTime } from '@/lib/date-time';

const mockToday = DateTimeManager.startOfDay(DateTimeManager.create());
const mockRecordDate = () =>
  DateTimeManager.startOfYear(DateTimeManager.currentYear());
const mockAppointmentTime = (time: string) => dateAtTime(mockToday, time);
const mockPreviousTime = (days: number, time: string) =>
  dateAtTime(DateTimeManager.subtractDays(mockToday, days), time);

export type ClinicKey = string;

export type InboxChannel = 'whatsapp' | 'instagram' | 'facebook' | 'email';

export type PaymentStatus = 'success' | 'pending' | 'failed';

export type StaffStatus = 'available' | 'busy' | 'break';

export type PosStatus = 'online' | 'busy' | 'offline';

export interface ClinicOption {
  readonly key: ClinicKey;
  readonly label: string;
}

export interface KpiItem {
  id: 'revenue' | 'patients' | 'appointments' | 'leads';
  label: string;
  value: string;
  delta: number;
  sub: string;
}

export interface MonthlyRevenue {
  month: string;
  year: number;
  fethiye: number;
  ataevler: number;
  besevler: number;
}

export interface LeadFunnelStage {
  stage: string;
  value: number;
  color: string;
}

export interface AdChannel {
  name: string;
  value: number;
  spend: string;
  cpl: string;
}

export interface InboxMessage {
  channel: InboxChannel;
  name: string;
  country: string;
  message: string;
  unread: number;
  time: string;
}

export interface TourismPatient {
  name: string;
  country: string;
  flag: string;
  package: string;
  stage: string;
  value: string;
}

export interface RecentPatient {
  name: string;
  initials: string;
  treatment: string;
  progress: number;
  clinic: string;
}

export interface LowStockItem {
  item: string;
  stock: number;
  min: number;
  unit: 'adet' | 'kutu' | string;
}

export interface PaymentMethod {
  key: 'pos' | 'cash' | 'transfer' | 'installment';
  label: string;
  amount: number;
  share: number;
  color: string;
}

export type PaymentMethodKey = PaymentMethod['key'];

export interface PosTerminal {
  id: string;
  name: string;
  bank: string;
  model: string;
  status: PosStatus;
}

export interface RecentPayment {
  patient: string;
  desc: string;
  method: PaymentMethodKey;
  amount: number;
  time: string;
  status: PaymentStatus;
}

export interface StaffMember {
  name: string;
  role: string;
  initials: string;
  status: StaffStatus;
}

// ==========================================
// MOCK DATA (Veriler)
// ==========================================

export const mockClinics: Clinic[] = [
  {
    id: 'clinic_fethiye',
    organizationId: 'org_as_yazilim',
    sectorId: 'sector_health_01',
    name: 'Fethiye Şubesi (Ana Klinik)',
    slug: 'fethiye',
    status: 'ACTIVE', // GlobalStatusSchema değerine göre (örn: ACTIVE)
    timezone: 'Europe_Istanbul',
    phone: '+902240000001',
    email: 'fethiye@medora.com',
    address: 'Fethiye Mah. Mudanya Cad. No:123',
    city: 'Bursa',
    district: 'Nilüfer',
    latitude: 40.2185,
    longitude: 28.9321,
    consultationSlotDuration: 30,
    isPlatform: false,
    logo: 'https://images.unsplash.com/photo-1629909613654-28e377c37b09?w=150',
    createdAt: mockRecordDate(),
    updatedAt: mockRecordDate(),
    deletedAt: null,
  },
  {
    id: 'clinic_ataevler',
    organizationId: 'org_as_yazilim',
    sectorId: 'sector_health_01',
    name: 'Ataevler Saç Ekimi ve Estetik Merkezi',
    slug: 'ataevler',
    status: 'ACTIVE',
    timezone: 'Europe_Istanbul',
    phone: '+902240000002',
    email: 'ataevler@medora.com',
    address: 'Ataevler Mah. Sağlık Sok. No:45',
    city: 'Bursa',
    district: 'Nilüfer',
    latitude: 40.2241,
    longitude: 28.9189,
    consultationSlotDuration: 45,
    isPlatform: false,
    logo: 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=150',
    createdAt: mockRecordDate(),
    updatedAt: mockRecordDate(),
    deletedAt: null,
  },
  {
    id: 'clinic_besevler',
    organizationId: 'org_as_yazilim',
    sectorId: 'sector_health_01',
    name: 'Beşevler Diş Kliniği',
    slug: 'besevler',
    status: 'ACTIVE',
    timezone: 'Europe_Istanbul',
    phone: '+902240000003',
    email: 'besevler@medora.com',
    address: 'Beşevler Mah. Yıldırım Cad. No:88',
    city: 'Bursa',
    district: 'Nilüfer',
    latitude: 40.2112,
    longitude: 28.945,
    consultationSlotDuration: 20,
    isPlatform: false,
    logo: 'https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?w=150',
    createdAt: mockRecordDate(),
    updatedAt: mockRecordDate(),
    deletedAt: null,
  },
  {
    id: 'clinic_platform_hq',
    organizationId: 'org_as_yazilim',
    sectorId: 'sector_health_01',
    name: 'Medora Global Platform',
    slug: 'platform-hq',
    status: 'ACTIVE',
    timezone: 'Europe_Istanbul',
    phone: null,
    email: 'hq@medora.com',
    address: null,
    city: 'Bursa',
    district: 'Nilüfer',
    latitude: null,
    longitude: null,
    consultationSlotDuration: 30,
    isPlatform: true, // Şemadaki açıklamaya göre platform merkezi (kiracı listesinden düşer)
    logo: null,
    createdAt: mockRecordDate(),
    updatedAt: mockRecordDate(),
    deletedAt: null,
  },
];

export const kpis = [
  {
    id: 'revenue',
    label: 'Aylık Gelir',
    value: '4.82M TL',
    delta: 12.4,
    sub: 'Geçen aya göre',
  },
  {
    id: 'patients',
    label: 'Aktif Hasta',
    value: '1.284',
    delta: 8.1,
    sub: 'Son 30 gün',
  },
  {
    id: 'appointments',
    label: 'Bugünkü Randevu',
    value: '47',
    delta: -3.2,
    sub: '12 tamamlandı',
  },
  {
    id: 'leads',
    label: 'Yeni Lead',
    value: '329',
    delta: 21.7,
    sub: 'Meta & Google Ads',
  },
] satisfies KpiItem[];

const revenueValues = [
  { fethiye: 820, ataevler: 640, besevler: 510 },
  { fethiye: 910, ataevler: 720, besevler: 560 },
  { fethiye: 880, ataevler: 690, besevler: 620 },
  { fethiye: 1020, ataevler: 810, besevler: 700 },
  { fethiye: 1140, ataevler: 880, besevler: 760 },
  { fethiye: 1080, ataevler: 950, besevler: 820 },
  { fethiye: 1220, ataevler: 1010, besevler: 910 },
  { fethiye: 1310, ataevler: 1120, besevler: 980 },
] as const;

export const revenueByMonth = revenueValues.map((values, index) => {
  const date = DateTimeManager.addMonths(
    mockToday,
    index - revenueValues.length + 1
  );

  return {
    ...values,
    month: new Intl.DateTimeFormat('tr-TR', {
      month: 'short',
      timeZone: DateTimeManager.toIana('Europe_Istanbul'),
    }).format(date),
    year: DateTimeManager.getYear(date),
  };
}) satisfies MonthlyRevenue[];

export const leadFunnel = [
  { stage: 'Ulaşan Lead', value: 1290, color: 'var(--chart-1)' },
  { stage: 'İletişim Kuruldu', value: 870, color: 'var(--chart-2)' },
  { stage: 'Konsültasyon', value: 430, color: 'var(--chart-3)' },
  { stage: 'Teklif', value: 240, color: 'var(--chart-4)' },
  { stage: 'Kazanılan', value: 118, color: 'var(--chart-5)' },
] satisfies LeadFunnelStage[];

export const adChannels = [
  { name: 'Meta Ads', value: 148, spend: '62K', cpl: '419' },
  { name: 'Google Ads', value: 96, spend: '54K', cpl: '562' },
  { name: 'TikTok Ads', value: 52, spend: '18K', cpl: '346' },
  { name: 'Organik / Referans', value: 33, spend: '—', cpl: '—' },
] satisfies AdChannel[];

export const mockAppointments: Appointment[] = [
  {
    id: 'apt_mock_001',
    source: AppointmentSourceSchema.enum.CLINIC_INTERNAL,
    timezone: TimeZoneSchema.enum.Europe_Istanbul,
    creatorType: AppointmentCreatorTypeSchema.enum.CLINIC_STAFF,
    status: AppointmentStatusSchema.enum.PENDING,
    examinationType: ExaminationTypeSchema.enum.FOLLOW_UP,
    visitType: VisitTypeSchema.enum.WALK_IN,
    externalSystem: null,
    patientName: 'Elif Yıldız',
    patientPhone: '+905330001122',
    patientEmail: 'elif@example.com',
    startTime: mockAppointmentTime('09:00'),
    endTime: mockAppointmentTime('09:45'),
    treatmentType: 'İmplant Kontrol',
    notes: 'Klinik kontrolü yapılacak, röntgen istendi.',
    approvedAt: mockPreviousTime(1, '14:20'),
    approvedBy: 'staff_user_01',
    createdById: 'staff_user_01',
    createdByRealName: 'Zeynep Ak',
    checkedInAt: null,
    reminderSentAt: mockPreviousTime(1, '18:00'),
    canceledAt: null,
    canceledBy: null,
    cancelReason: null,
    createdAt: mockPreviousTime(1, '14:00'),
    updatedAt: mockPreviousTime(1, '14:20'),
    version: 1,
    isConsultation: false,
    externalId: null,
    treatmentId: 'treat_implant_01',
    clinicId: 'clinic_fethiye', // Multi-clinic filtreleme için kritik
    providerId: 'doc_mehmet_kaya',
    patientId: 'pat_1',
    resourceId: 'chair_01',
    isDeleted: false,
    deletedAt: null,
  },
  {
    id: 'apt_mock_002',
    source: AppointmentSourceSchema.enum.INTEGRATION,
    timezone: TimeZoneSchema.enum.Europe_Istanbul,
    creatorType: AppointmentCreatorTypeSchema.enum.AI_AGENT,
    status: AppointmentStatusSchema.enum.PENDING,
    examinationType: ExaminationTypeSchema.enum.FIRST_VISIT,
    visitType: VisitTypeSchema.enum.SCHEDULED,
    externalSystem: ExternalSystemSchema.enum.WHATSAPP,
    patientName: 'James Miller',
    patientPhone: '+447700900077',
    patientEmail: 'james@example.co.uk',
    startTime: mockAppointmentTime('09:30'),
    endTime: mockAppointmentTime('13:00'),
    treatmentType: 'FUE Saç Ekimi (3500 Greft)',
    notes: 'Safir uç kullanılacak. Öğle arasında yemek molası verilecek.',
    approvedAt: mockPreviousTime(3, '10:00'),
    approvedBy: 'admin_alp',
    createdById: 'staff_user_02',
    createdByRealName: 'Elif Şahin',
    checkedInAt: mockAppointmentTime('09:15'),
    reminderSentAt: mockPreviousTime(1, '18:00'),
    canceledAt: null,
    canceledBy: null,
    cancelReason: null,
    createdAt: mockPreviousTime(3, '09:30'),
    updatedAt: mockAppointmentTime('09:15'),
    version: 2,
    isConsultation: false,
    externalId: 'wa_msg_998877',
    treatmentId: 'treat_fue_02',
    clinicId: 'clinic_ataevler',
    providerId: 'doc_selin_demir',
    patientId: 'pat_2',
    resourceId: 'surgery_room_02',
    isDeleted: false,
    deletedAt: null,
  },
  {
    id: 'apt_mock_003',
    source: AppointmentSourceSchema.enum.INTEGRATION,
    timezone: TimeZoneSchema.enum.Europe_Istanbul,
    creatorType: AppointmentCreatorTypeSchema.enum.AI_AGENT,
    status: AppointmentStatusSchema.enum.PENDING,
    examinationType: ExaminationTypeSchema.enum.FIRST_VISIT,
    visitType: VisitTypeSchema.enum.SCHEDULED,
    externalSystem: null,
    patientName: 'Ayşe Korkmaz',
    patientPhone: '+905359998877',
    patientEmail: 'ayse@example.com',
    startTime: mockAppointmentTime('10:15'),
    endTime: mockAppointmentTime('11:00'),
    treatmentType: 'Rinoplasti Konsültasyon',
    notes: 'Öncesi/Sonrası simülasyonu yapılacak.',
    approvedAt: mockPreviousTime(2, '11:00'),
    approvedBy: 'staff_user_01',
    createdById: 'staff_user_01',
    createdByRealName: 'Zeynep Ak',
    checkedInAt: null,
    reminderSentAt: mockPreviousTime(1, '18:00'),
    canceledAt: null,
    canceledBy: null,
    cancelReason: null,
    createdAt: mockPreviousTime(2, '10:45'),
    updatedAt: mockPreviousTime(2, '11:00'),
    version: 1,
    isConsultation: true,
    externalId: null,
    treatmentId: 'treat_rhino_01',
    clinicId: 'clinic_besevler',
    providerId: 'doc_cem_aslan',
    patientId: 'pat_3',
    resourceId: 'consult_room_01',
    isDeleted: false,
    deletedAt: null,
  },
  {
    id: 'apt_mock_004',
    source: AppointmentSourceSchema.enum.INTEGRATION,
    timezone: TimeZoneSchema.enum.Europe_Istanbul,
    creatorType: AppointmentCreatorTypeSchema.enum.AI_AGENT,
    status: AppointmentStatusSchema.enum.PENDING,
    examinationType: ExaminationTypeSchema.enum.FIRST_VISIT,
    visitType: VisitTypeSchema.enum.SCHEDULED,
    externalSystem: null,
    patientName: 'Mohammed Al-Farsi',
    patientPhone: '+971501234567',
    patientEmail: 'mohammed@example.ae',
    startTime: mockAppointmentTime('11:00'),
    endTime: mockAppointmentTime('12:00'),
    treatmentType: 'Diş Beyazlatma (Laser)',
    notes: 'VIP Medikal Turizm hastası, tercüman eşlik edecek.',
    approvedAt: mockPreviousTime(1, '09:00'),
    approvedBy: 'staff_user_01',
    createdById: null,
    createdByRealName: null,
    checkedInAt: mockAppointmentTime('10:50'),
    reminderSentAt: mockPreviousTime(1, '18:00'),
    canceledAt: null,
    canceledBy: null,
    cancelReason: null,
    createdAt: mockPreviousTime(1, '08:30'),
    updatedAt: mockAppointmentTime('10:50'),
    version: 1,
    isConsultation: false,
    externalId: null,
    treatmentId: 'treat_dental_02',
    clinicId: 'clinic_fethiye',
    providerId: 'doc_mehmet_kaya',
    patientId: 'pat_4',
    resourceId: 'chair_02',
    isDeleted: false,
    deletedAt: null,
  },
  {
    id: 'apt_mock_005',
    source: AppointmentSourceSchema.enum.INTEGRATION,
    timezone: TimeZoneSchema.enum.Europe_Istanbul,
    creatorType: AppointmentCreatorTypeSchema.enum.AI_AGENT,
    status: AppointmentStatusSchema.enum.PENDING,
    examinationType: ExaminationTypeSchema.enum.FIRST_VISIT,
    visitType: VisitTypeSchema.enum.SCHEDULED,
    externalSystem: ExternalSystemSchema.enum.WHATSAPP,
    patientName: 'Deniz Arslan',
    patientPhone: '+905321112233',
    patientEmail: null,
    startTime: mockAppointmentTime('13:30'),
    endTime: mockAppointmentTime('14:15'),
    treatmentType: 'Botoks Konsültasyon',
    notes: 'Hasta şehir dışına çıkacağı için randevuyu iptal etti.',
    approvedAt: mockPreviousTime(2, '15:00'),
    approvedBy: 'staff_user_01',
    createdById: 'staff_user_01',
    createdByRealName: 'Zeynep Ak',
    checkedInAt: null,
    reminderSentAt: mockPreviousTime(1, '18:00'),
    canceledAt: mockPreviousTime(1, '20:10'),
    canceledBy: 'Deniz Arslan (Hasta)',
    cancelReason: 'Acil şehir dışı seyahati',
    createdAt: mockPreviousTime(2, '14:30'),
    updatedAt: mockPreviousTime(1, '20:10'),
    version: 2,
    isConsultation: true,
    externalId: 'ig_dm_thread_123',
    treatmentId: 'treat_botox_01',
    clinicId: 'clinic_besevler',
    providerId: 'doc_cem_aslan',
    patientId: 'pat_5',
    resourceId: null,
    isDeleted: false,
    deletedAt: null,
  },
];

const providerNameById: Record<string, string> = {
  doc_mehmet_kaya: 'Dr. Mehmet Kaya',
  doc_selin_demir: 'Dr. Selin Demir',
  doc_cem_aslan: 'Dr. Cem Aslan',
};

/** Legacy workspace shape kept for the dashboard and patient profile mocks. */
export const appointments = mockAppointments.map((item) => ({
  ...item,
  time: new Intl.DateTimeFormat('tr-TR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(item.startTime),
  patient: item.patientName,
  type: item.treatmentType ?? 'Genel Muayene',
  clinic:
    mockClinics.find((clinicItem) => clinicItem.id === item.clinicId)?.name ??
    'Klinik',
  doctor: providerNameById[item.providerId] ?? 'Klinik Doktoru',
  status:
    item.status === 'CONFIRMED'
      ? 'confirmed'
      : item.status === 'CANCELLED'
        ? 'cancelled'
        : 'waiting',
}));

export const inbox = [
  {
    channel: 'whatsapp',
    name: 'Ayhan Karan',
    country: '🇹🇷',
    message: 'Saat 3e olsun',
    unread: 2,
    time: '2dk',
  },
  {
    channel: 'instagram',
    name: 'Lucia Fernández',
    country: '🇪🇸',
    message: 'Hola, precio de rinoplastia?',
    unread: 1,
    time: '8dk',
  },
  {
    channel: 'whatsapp',
    name: 'Ahmed Hassan',
    country: '🇪🇬',
    message: 'Saç ekimi için fiyat listesi alabilir miyim?',
    unread: 0,
    time: '21dk',
  },
  {
    channel: 'facebook',
    name: 'Elif Yıldız',
    country: '🇹🇷',
    message: 'İmplant kontrol randevumu onaylıyorum.',
    unread: 0,
    time: '34dk',
  },
  {
    channel: 'email',
    name: 'Sofia Rossi',
    country: '🇮🇹',
    message: 'Trattamento PRP — informazioni',
    unread: 1,
    time: '1sa',
  },
] satisfies InboxMessage[];

export const tourismPatients = [
  {
    name: 'James Miller',
    country: 'Birleşik Krallık',
    flag: '🇬🇧',
    package: 'Saç Ekimi + Otel',
    stage: 'Transfer Bekleniyor',
    value: '€2.400',
  },
  {
    name: 'Mohammed Al-Farsi',
    country: 'BAE',
    flag: '🇦🇪',
    package: 'All-on-4 İmplant',
    stage: 'Tedavi Sürüyor',
    value: '€7.800',
  },
  {
    name: 'Sofia Rossi',
    country: 'İtalya',
    flag: '🇮🇹',
    package: 'Rinoplasti',
    stage: 'Konsültasyon',
    value: '€4.200',
  },
  {
    name: 'Lucia Fernández',
    country: 'İspanya',
    flag: '🇪🇸',
    package: 'Anne Estetiği',
    stage: 'Teklif Gönderildi',
    value: '€9.500',
  },
] satisfies TourismPatient[];

export const recentPatients = [
  {
    name: 'Elif Yıldız',
    initials: 'EY',
    treatment: 'İmplant Tedavisi',
    progress: 75,
    clinic: 'Diş',
  },
  {
    name: 'James Miller',
    initials: 'JM',
    treatment: 'FUE Saç Ekimi',
    progress: 40,
    clinic: 'Saç',
  },
  {
    name: 'Ayşe Korkmaz',
    initials: 'AK',
    treatment: 'Rinoplasti',
    progress: 20,
    clinic: 'Estetik',
  },
  {
    name: 'Sofia Rossi',
    initials: 'SR',
    treatment: 'PRP (4 Seans)',
    progress: 60,
    clinic: 'Saç',
  },
] satisfies RecentPatient[];

export const lowStock = [
  { item: 'Titanyum İmplant 4.0mm', stock: 12, min: 30, unit: 'adet' },
  { item: 'Lidokain %2 Ampul', stock: 24, min: 50, unit: 'adet' },
  { item: 'FUE Safir Uç 0.8mm', stock: 8, min: 25, unit: 'adet' },
  { item: 'Hyaluronik Dolgu 1ml', stock: 5, min: 15, unit: 'kutu' },
] satisfies LowStockItem[];

export const paymentMethods = [
  {
    key: 'pos',
    label: 'POS / Kredi Kartı',
    amount: 2840000,
    share: 59,
    color: 'var(--chart-1)',
  },
  {
    key: 'cash',
    label: 'Elden / Nakit',
    amount: 720000,
    share: 15,
    color: 'var(--chart-5)',
  },
  {
    key: 'transfer',
    label: 'Havale / EFT',
    amount: 910000,
    share: 19,
    color: 'var(--chart-2)',
  },
  {
    key: 'installment',
    label: 'Taksit / Senet',
    amount: 350000,
    share: 7,
    color: 'var(--chart-4)',
  },
] as const satisfies readonly PaymentMethod[];

export const posTerminals = [
  {
    id: 'pos-1',
    name: 'Resepsiyon POS',
    bank: 'Garanti',
    model: 'Ingenico Move/5000',
    status: 'online',
  },
  {
    id: 'pos-2',
    name: 'Diş Kliniği POS',
    bank: 'İş Bankası',
    model: 'Verifone V240m',
    status: 'online',
  },
  {
    id: 'pos-3',
    name: 'Estetik Kat POS',
    bank: 'Yapı Kredi',
    model: 'PAX A920',
    status: 'busy',
  },
  {
    id: 'pos-4',
    name: 'Mobil POS',
    bank: 'Enpara',
    model: 'SoftPOS',
    status: 'offline',
  },
] satisfies PosTerminal[];

export const recentPayments = [
  {
    patient: 'Elif Yıldız',
    desc: 'İmplant Tedavisi — 2. taksit',
    method: 'pos',
    amount: 18500,
    time: '10:24',
    status: 'success',
  },
  {
    patient: 'James Miller',
    desc: 'Saç Ekimi Paketi (peşin)',
    method: 'transfer',
    amount: 74200,
    time: '09:58',
    status: 'success',
  },
  {
    patient: 'Ayşe Korkmaz',
    desc: 'Rinoplasti — kapora',
    method: 'cash',
    amount: 12000,
    time: '09:40',
    status: 'success',
  },
  {
    patient: 'Mohammed Al-Farsi',
    desc: 'All-on-4 — POS çekimi',
    method: 'pos',
    amount: 96000,
    time: '09:12',
    status: 'pending',
  },
  {
    patient: 'Deniz Arslan',
    desc: 'Botoks seansı',
    method: 'pos',
    amount: 6800,
    time: 'Dün',
    status: 'failed',
  },
] satisfies RecentPayment[];

export const staffOnDuty = [
  {
    name: 'Dr. Mehmet Kaya',
    role: 'Diş Hekimi',
    initials: 'MK',
    status: 'available',
  },
  {
    name: 'Op. Dr. Selin Demir',
    role: 'Saç Ekimi Uzmanı',
    initials: 'SD',
    status: 'busy',
  },
  {
    name: 'Op. Dr. Cem Aslan',
    role: 'Plastik Cerrah',
    initials: 'CA',
    status: 'busy',
  },
  {
    name: 'Zeynep Ak',
    role: 'Hasta Danışmanı',
    initials: 'ZA',
    status: 'available',
  },
  { name: 'Elif Şahin', role: 'Hemşire', initials: 'EŞ', status: 'break' },
] satisfies StaffMember[];
