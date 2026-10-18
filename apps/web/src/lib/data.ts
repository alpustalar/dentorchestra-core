// ==========================================
// TYPES (Tip Tanımlamaları)
// ==========================================

export type ClinicKey = string;

export type AppointmentStatus =
  | 'confirmed'
  | 'in-progress'
  | 'waiting'
  | 'cancelled';

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

export interface Appointment {
  time: string;
  patient: string;
  type: string;
  clinic: string;
  doctor: string;
  status: AppointmentStatus;
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

export const clinics = [
  { key: 'all', label: 'Tüm Klinikler' },
  { key: 'fethiye', label: 'Fethiye' },
  { key: 'ataevler', label: 'Ataevler' },
  { key: 'besevler', label: 'Beşevler' },
] as const satisfies readonly ClinicOption[];

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

export const revenueByMonth = [
  { month: 'Oca', fethiye: 820, ataevler: 640, besevler: 510 },
  { month: 'Şub', fethiye: 910, ataevler: 720, besevler: 560 },
  { month: 'Mar', fethiye: 880, ataevler: 690, besevler: 620 },
  { month: 'Nis', fethiye: 1020, ataevler: 810, besevler: 700 },
  { month: 'May', fethiye: 1140, ataevler: 880, besevler: 760 },
  { month: 'Haz', fethiye: 1080, ataevler: 950, besevler: 820 },
  { month: 'Tem', fethiye: 1220, ataevler: 1010, besevler: 910 },
  { month: 'Ağu', fethiye: 1310, ataevler: 1120, besevler: 980 },
] satisfies MonthlyRevenue[];

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

export const appointments = [
  {
    time: '09:00',
    patient: 'Elif Yıldız',
    type: 'İmplant Kontrol',
    clinic: 'Diş Kliniği',
    doctor: 'Dr. Kaya',
    status: 'confirmed',
  },
  {
    time: '09:30',
    patient: 'James Miller',
    type: 'Saç Ekimi (FUE)',
    clinic: 'Saç Ekimi',
    doctor: 'Op. Dr. Demir',
    status: 'in-progress',
  },
  {
    time: '10:15',
    patient: 'Ayşe Korkmaz',
    type: 'Rinoplasti Konsültasyon',
    clinic: 'Estetik Cerrahi',
    doctor: 'Op. Dr. Aslan',
    status: 'confirmed',
  },
  {
    time: '11:00',
    patient: 'Mohammed Al-Farsi',
    type: 'Diş Beyazlatma',
    clinic: 'Diş Kliniği',
    doctor: 'Dr. Kaya',
    status: 'waiting',
  },
  {
    time: '11:45',
    patient: 'Sofia Rossi',
    type: 'PRP Seansı',
    clinic: 'Saç Ekimi',
    doctor: 'Op. Dr. Demir',
    status: 'confirmed',
  },
  {
    time: '13:30',
    patient: 'Deniz Arslan',
    type: 'Botoks',
    clinic: 'Estetik Cerrahi',
    doctor: 'Op. Dr. Aslan',
    status: 'cancelled',
  },
] satisfies Appointment[];

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
