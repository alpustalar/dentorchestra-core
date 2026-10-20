import { slugIt } from '@shared/common/utils/slug-it';

export type EnumToSlug<T extends Record<string, string>> = Record<
  T[keyof T],
  string
>;

export function enumToSlug<T extends Record<string, string>>(
  enumParam: T
): EnumToSlug<T> {
  return Object.values(enumParam).reduce(
    (acc, value) => {
      acc[value] = slugIt(value);
      return acc;
    },
    {} as Record<T[keyof T], string>
  );
}
