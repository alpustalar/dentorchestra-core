import type { Lead } from '@dentorchestra/shared/client';

/**
 * Enum tipleri modelin kendisinden türetilir, `generated-zod`un enum
 * dosyalarından değil. İki kazanç: (1) `generated-zod` derin import'una gerek
 * kalmaz (ESLint onu haklı olarak kapatıyor), (2) alan tipi modelde değişirse
 * burası kendiliğinden takip eder — elle tutulan bir kopya bayatlayamaz.
 */
export type LeadStatus = Lead['status'];
export type LeadSource = Lead['source'];
