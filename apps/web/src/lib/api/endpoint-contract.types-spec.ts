/**
 * Sözleşme katmanının **derleme-zamanı testi**. Çalışma zamanı kodu yok;
 * `tsc` (ve dolayısıyla `next build`) her seferinde bu iddiaları doğrular.
 *
 * Kalıcı olmasının sebebi: bu tipler bir kez sessizce kırıldı. `path` alanı
 * `string | fn` birleşimi olduğu için `ParamsOf` hiç eşleşmiyor, `never`e
 * düşüyordu — sonuç olarak zorunlu yol parametreleri derleyiciden kaçıyor,
 * doğru çağrılar ise reddediliyordu. Hiçbir çalışma zamanı testi bunu
 * yakalayamazdı; yakalayan tek şey buradaki `@ts-expect-error` işaretleridir
 * (kullanılmayan bir işaret TS2578 ile hata verir, yani "hata bekleniyordu ama
 * olmadı" durumu da yakalanır).
 */
import { z } from 'zod';
import {
  defineEndpoint,
  meEndpoints,
  type ActorContextResponse,
} from '@dentorchestra/shared/client';

import { api, apiWithMeta } from './client';

type Expect<T extends true> = T;
type Equals<A, B> =
  (<G>() => G extends A ? 1 : 2) extends <G>() => G extends B ? 1 : 2
    ? true
    : false;

// 1) Cevap tipi sözleşmeden geliyor mu?
type ContextResult = Awaited<ReturnType<typeof api<typeof meEndpoints.context>>>;
export type _1 = Expect<Equals<ContextResult, ActorContextResponse>>;

// 2) Parametresiz/gövdesiz endpoint seçeneksiz çağrılabiliyor mu?
export const _2 = () => api(meEndpoints.context);

// 3) Tanımlı olmayan gövde geçilirse derleme hatası vermeli.
// @ts-expect-error — bu endpoint'in `body`si yok
export const _3 = () => api(meEndpoints.context, { body: { x: 1 } });

const withParams = defineEndpoint<{ id: string }[]>()({
  method: 'GET',
  path: (p: { clinicId: string }) => `/clinics/${p.clinicId}/leads`,
  query: z.object({ page: z.coerce.number().default(1) }),
});

// 4) Zorunlu `params` atlanırsa derleme hatası vermeli.
// @ts-expect-error — `params` zorunlu
export const _4 = () => api(withParams);

// 5) Yanlış parametre adı yakalanmalı.
// @ts-expect-error — `clinicId` bekleniyor
export const _5 = () => api(withParams, { params: { patientId: 'x' } });

// 6) `query` z.input olmalı: `.default()` taşıyan alan girişte opsiyonel.
export const _6 = () => api(withParams, { params: { clinicId: 'c1' }, query: {} });

// 7) Liste cevabı + sayfalama zarfı.
type ListResult = Awaited<ReturnType<typeof apiWithMeta<typeof withParams>>>;
export type _7 = Expect<Equals<ListResult['data'], { id: string }[]>>;

// 8) Gövde şeması tanımlıysa `body` zorunlu ve tipli olmalı.
const withBody = defineEndpoint<string>()({
  method: 'POST',
  path: '/leads',
  body: z.object({ fullName: z.string(), phone: z.string() }),
});

// @ts-expect-error — `body` zorunlu
export const _9 = () => api(withBody);

// @ts-expect-error — `phone` eksik
export const _10 = () => api(withBody, { body: { fullName: 'A' } });

export const _11 = () => api(withBody, { body: { fullName: 'A', phone: '5' } });
