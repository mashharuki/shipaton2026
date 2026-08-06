import { getLocales } from "expo-localization";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import en from "@/locales/en.json";
import ja from "@/locales/ja.json";

export const SUPPORTED_LOCALES = ["ja", "en"] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

function detectDeviceLocale(): SupportedLocale {
  const languageCode = getLocales()[0]?.languageCode;
  return languageCode === "ja" ? "ja" : "en";
}

i18n.use(initReactI18next).init({
  resources: {
    ja: { translation: ja },
    en: { translation: en },
  },
  lng: detectDeviceLocale(),
  fallbackLng: "en",
  interpolation: { escapeValue: false },
});

export default i18n;
