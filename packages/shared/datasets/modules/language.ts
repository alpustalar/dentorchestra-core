import LanguageDirectionSchema from '@shared/generated-zod/inputTypeSchemas/LanguageDirectionSchema';
import { LANGUAGE_CODES } from '@shared/datasets';

const { TR, EN, AR } = LANGUAGE_CODES;
export const languageCreateManyInputs = [
  {
    name: 'Türkçe',
    code: TR,
  },
  {
    name: 'English',
    code: EN,
  },
  {
    name: 'اللغة العربية',
    code: AR,
    direction: LanguageDirectionSchema.enum.RTL,
  },
].map((language) => ({
  ...language,
  id: crypto.randomUUID(),
}));
