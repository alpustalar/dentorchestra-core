import slugify from 'slugify';

export const slugIt = (text: string, locale: string = 'tr') => {
  const preCleaned = text.replace(/_/g, '-');
  return slugify(preCleaned, {
    lower: true,
    strict: true,
    locale,
  });
};
