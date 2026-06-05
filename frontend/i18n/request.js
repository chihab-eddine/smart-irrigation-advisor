import { getRequestConfig } from "next-intl/server";

const locales = ["fr", "ar"];
const defaultLocale = "fr";

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = locales.includes(requested) ? requested : defaultLocale;

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
