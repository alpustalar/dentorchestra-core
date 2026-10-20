import { LANGUAGE_CODES, LanguageCode } from '@shared/datasets';

export type TranslationHelper = { [key in LanguageCode]: string };
type TranslationHelperInput = { tr: string; en: string; ar: string };

export const translationsHelper = ({
  tr,
  en,
  ar,
}: TranslationHelperInput): TranslationHelper => {
  return {
    [LANGUAGE_CODES.TR]: tr,
    [LANGUAGE_CODES.EN]: en,
    [LANGUAGE_CODES.AR]: ar,
  };
};
