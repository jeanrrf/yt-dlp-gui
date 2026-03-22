import { createI18n } from "vue-i18n";
import ptBR from "./pt-BR.json";

export const APP_LOCALE = "pt-BR";

export const resolveLocale = (): string => APP_LOCALE;

const i18n = createI18n({
  legacy: false,
  locale: APP_LOCALE,
  fallbackLocale: APP_LOCALE,
  messages: {
    [APP_LOCALE]: ptBR,
  },
});

export const setI18nLocale = () => {
  (i18n.global.locale as unknown as { value: string }).value = APP_LOCALE;
  document.documentElement.lang = APP_LOCALE;
};

document.documentElement.lang = APP_LOCALE;

export default i18n;
