import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { BottomTabInset, MaxContentWidth, Spacing } from "@/constants/theme";
import { SUPPORTED_LOCALES, type SupportedLocale } from "@/lib/i18n";
import {
  THEME_PREFERENCES,
  type ThemePreference,
  useThemeStore,
} from "@/stores/theme-store";

const PREFERENCE_LABEL_KEYS: Record<ThemePreference, string> = {
  system: "settings.appearanceSystem",
  light: "settings.appearanceLight",
  dark: "settings.appearanceDark",
};

// Language names are proper nouns shown in their own language, not the
// currently active one -- otherwise a user who switched away from the
// language they read couldn't find their way back.
const LOCALE_LABELS: Record<SupportedLocale, string> = {
  ja: "日本語",
  en: "English",
};

// 16.6 の設定ハブ本体は task 9.2 の担当（通知・位置情報・データ共有・
// 履歴削除・サブスクリプション管理・プライバシーポリシー・利用規約への導線）。
// このスクリーンは 4.1（外観切替）と 4.4（言語切替）の完了条件が要求する
// トグルのみを持つ骨格。
export default function SettingsScreen() {
  const { t, i18n } = useTranslation();
  const preference = useThemeStore((state) => state.preference);
  const setPreference = useThemeStore((state) => state.setPreference);

  return (
    <ThemedView style={styles.container} testID="settings-screen">
      <SafeAreaView style={styles.safeArea}>
        <ThemedText type="title" style={styles.title}>
          {t("settings.title")}
        </ThemedText>

        <ThemedView type="backgroundElement" style={styles.section}>
          <ThemedText type="smallBold">{t("settings.appearance")}</ThemedText>
          <ThemedView style={styles.optionRow}>
            {THEME_PREFERENCES.map((option) => (
              <Pressable
                key={option}
                accessibilityRole="button"
                accessibilityState={{ selected: preference === option }}
                onPress={() => setPreference(option)}
                style={({ pressed }) => pressed && styles.pressed}
              >
                <ThemedView
                  type={
                    preference === option ? "backgroundSelected" : "background"
                  }
                  style={styles.optionButton}
                >
                  <ThemedText
                    type="small"
                    themeColor={
                      preference === option ? "text" : "textSecondary"
                    }
                  >
                    {t(PREFERENCE_LABEL_KEYS[option])}
                  </ThemedText>
                </ThemedView>
              </Pressable>
            ))}
          </ThemedView>
        </ThemedView>

        <ThemedView type="backgroundElement" style={styles.section}>
          <ThemedText type="smallBold">{t("settings.language")}</ThemedText>
          <ThemedView style={styles.optionRow}>
            {SUPPORTED_LOCALES.map((locale) => (
              <Pressable
                key={locale}
                accessibilityRole="button"
                accessibilityState={{ selected: i18n.language === locale }}
                onPress={() => i18n.changeLanguage(locale)}
                style={({ pressed }) => pressed && styles.pressed}
              >
                <ThemedView
                  type={
                    i18n.language === locale
                      ? "backgroundSelected"
                      : "background"
                  }
                  style={styles.optionButton}
                >
                  <ThemedText
                    type="small"
                    themeColor={
                      i18n.language === locale ? "text" : "textSecondary"
                    }
                  >
                    {LOCALE_LABELS[locale]}
                  </ThemedText>
                </ThemedView>
              </Pressable>
            ))}
          </ThemedView>
        </ThemedView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    flexDirection: "row",
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.five,
    gap: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.three,
    maxWidth: MaxContentWidth,
    alignSelf: "center",
    width: "100%",
  },
  title: {
    textAlign: "left",
  },
  section: {
    gap: Spacing.two,
    borderRadius: Spacing.four,
    padding: Spacing.three,
  },
  optionRow: {
    flexDirection: "row",
    gap: Spacing.two,
  },
  optionButton: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
  },
  pressed: {
    opacity: 0.7,
  },
});
