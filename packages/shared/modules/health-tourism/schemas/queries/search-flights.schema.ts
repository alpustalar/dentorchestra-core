import { z } from 'zod';

const DatePattern = /^\d{4}-\d{2}-\d{2}$/;
const IataPattern = /^[A-Z]{3}$/;

export const CabinClassSchema = z.enum([
  'economy',
  'premium_economy',
  'business',
  'first',
]);

export const SearchFlightsSchema = z.object({
  /** Kalkış havalimanı IATA kodu (ör. "FRA"). Boşsa klinik config'indeki varsayılan kullanılır. */
  origin: z.string().regex(IataPattern, '3 harfli IATA kodu olmalı'),
  /** Varış havalimanı IATA kodu (ör. "IST"). */
  destination: z.string().regex(IataPattern, '3 harfli IATA kodu olmalı'),
  departureDate: z.string().regex(DatePattern, 'YYYY-MM-DD formatında olmalı'),
  /** Doluysa gidiş-dönüş, boşsa tek yön aranır. */
  returnDate: z
    .string()
    .regex(DatePattern, 'YYYY-MM-DD formatında olmalı')
    .optional(),
  adults: z.coerce.number().int().positive().default(1),
  children: z.coerce.number().int().min(0).default(0),
  infants: z.coerce.number().int().min(0).default(0),
  cabinClass: CabinClassSchema.default('economy'),
  clinicId: z.uuid(),
});
