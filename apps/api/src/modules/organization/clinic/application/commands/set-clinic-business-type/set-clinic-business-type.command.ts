import type { SetClinicBusinessType } from '@shared';
import { IGetContext } from '@common/decorators/get-context.decorator';

/**
 * Kliniğin işletme biçimini (şirket / şahıs) belirler. Kayıt akışı bunu ilk seçim için çağırır
 * (iç bağlam); sonradan değişiklik kapanmış mali yılı olmayan klinikte serbesttir.
 */
export class SetClinicBusinessTypeCommand {
  readonly __responseType!: void;

  constructor(
    public readonly payload: {
      readonly clinicId: string;
      readonly data: SetClinicBusinessType;
      readonly ctx: IGetContext;
    }
  ) {}
}
