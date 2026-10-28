export { api, apiWithMeta, type RequestOptions } from './client';
export { ApiError, toApiError, type ApiErrorBody } from './error';
export { normalizeEnvelope, type ApiResult } from './envelope';
export {
  getTokenProvider,
  setTokenProvider,
  type TokenProvider,
} from './token-provider';

/*
 * Sözleşme katmanı `@dentorchestra/shared/client`te yaşıyor — endpoint kayıtları
 * (URL, metod, gövde şeması) frontend'e değil, paylaşılan sözleşmeye ait.
 * Kolaylık olsun diye buradan da yeniden dışa açılıyor.
 */
export {
  defineEndpoint,
  type AnyEndpoint,
  type BodyOf,
  type EndpointDefinition,
  type HttpMethod,
  type ParamsOf,
  type QueryOf,
  type ResponseOf,
} from '@dentorchestra/shared/client';
