/* eslint-disable */
import { ExecutionSources } from '../../../../shared/common/constants/execution-source.constant';
import { ForbiddenException } from '@nestjs/common';

export function InternalOnly() {
  return (
    target: object,
    propertyKey: string | symbol,
    descriptor: TypedPropertyDescriptor<any>
  ): void | any => {
    const originalMethod = descriptor.value;

    if (typeof originalMethod !== 'function') {
      return descriptor;
    }

    descriptor.value = function (this: unknown, ...args: any[]): any {
      // Arglar arasında context'i ara

      const context = args.find((arg) => {
        // Doğrudan context mi?
        if (arg && typeof arg === 'object' && 'source' in arg) return true;

        // İçinde context barındıran bir Command mi?
        if (
          arg &&
          typeof arg === 'object' &&
          'context' in arg &&
          arg.context?.source
        )
          return true;

        return false;
      });

      // Bulunan context'i belirle - direkt argüman mı yoksa command.context mi
      const actualContext = context?.source ? context : context?.context;

      if (
        !actualContext ||
        actualContext.source !== ExecutionSources.INTERNAL_CASCADE
      ) {
        throw new ForbiddenException(
          `Erişim Reddedildi: '${String(propertyKey)}' işlemi dışarıdan tetiklenemez.`
        );
      }

      return originalMethod.apply(this, args);
    };
  };
}
