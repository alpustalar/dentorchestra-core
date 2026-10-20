import { applyDecorators, Type, UseInterceptors } from '@nestjs/common';
import {
  ApiExtraModels,
  ApiOkResponse,
  getSchemaPath,
} from '@nestjs/swagger';
import { MixinTransformInterceptor } from '@common/interceptors/transform/transform.interceptor';

export interface SerializeOptions {
  /** `data` bir liste ise `true`; yalnız OpenAPI sözleşmesini etkiler. */
  readonly isArray?: boolean;
}

/**
 * @Serialize
 * Gelen ham entity verisini, belirtilen DTO şemasına ve meta serialization gruplarına göre filtreler.
 *
 * Aynı zamanda OpenAPI'ye `QueryResponse` zarfını (`{ data, meta?, serialization? }`)
 * yazar: frontend (Orval) üretilen tipi buradan alır. `type: dto` tek başına
 * yazılsaydı zarf görünmez, istemci yanlış tipe bağlanırdı.
 *
 * @param dto Dönüştürülecek hedef DTO sınıfı (Örn: AppointmentResponseDto)
 * @param options `isArray` — `data` liste ise belirtilir (sözleşme için).
 */
export function Serialize<TEntity, TDto>(
  dto: Type<TDto>,
  options: SerializeOptions = {}
) {
  const item = { $ref: getSchemaPath(dto) };

  return applyDecorators(
    UseInterceptors(MixinTransformInterceptor<TEntity, TDto>(dto)),
    ApiExtraModels(dto),
    ApiOkResponse({
      schema: {
        type: 'object',
        required: ['data'],
        properties: {
          data: options.isArray ? { type: 'array', items: item } : item,
          meta: {
            type: 'object',
            properties: {
              pagination: {
                type: 'object',
                required: ['total', 'page', 'limit', 'totalPages'],
                properties: {
                  total: { type: 'number' },
                  page: { type: 'number' },
                  limit: { type: 'number' },
                  totalPages: { type: 'number' },
                },
              },
            },
            additionalProperties: true,
          },
          serialization: {
            type: 'object',
            required: ['groups'],
            properties: {
              groups: { type: 'array', items: { type: 'string' } },
            },
          },
        },
      },
    })
  );
}
