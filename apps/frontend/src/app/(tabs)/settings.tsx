import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { Linking, Pressable, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { BottomTabInset, MaxContentWidth, Spacing } from "@/constants/theme";
import { openSubscriptionManagement } from "@/features/subscription/purchases-client";
import { PRIVACY_POLICY_URL, TERMS_OF_SERVICE_URL } from "@/lib/config";
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

// 16.6 の設定ハブ本体（通知・位置情報・データ共有・履歴削除・サブスクリプ
// ション管理・プライバシーポリシー・利用規約への導線）は task 9.2 で実装。
// 位置情報・データ共有・履歴削除は settings/privacy.tsx に集約し、このハブ
// からはそこへの導線のみを持つ。
export default function SettingsScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
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

        <Pressable
          accessibilityRole="button"
          testID="settings-notifications-link"
          onPress={() => router.push("/settings/notifications")}
          style={({ pressed }) => pressed && styles.pressed}
        >
          <ThemedView type="backgroundElement" style={styles.section}>
            <ThemedText type="smallBold">
              {t("settings.notifications")}
            </ThemedText>
          </ThemedView>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          testID="settings-privacy-link"
          onPress={() => router.push("/settings/privacy")}
          style={({ pressed }) => pressed && styles.pressed}
        >
          <ThemedView type="backgroundElement" style={styles.section}>
            <ThemedText type="smallBold">{t("settings.privacy")}</ThemedText>
          </ThemedView>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          testID="settings-subscription-management-link"
          onPress={() => openSubscriptionManagement()}
          style={({ pressed }) => pressed && styles.pressed}
        >
          <ThemedView type="backgroundElement" style={styles.section}>
            <ThemedText type="smallBold">
              {t("settings.subscriptionManagement")}
            </ThemedText>
          </ThemedView>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          testID="settings-licenses-link"
          onPress={() => router.push("/settings/licenses")}
          style={({ pressed }) => pressed && styles.pressed}
        >
          <ThemedView type="backgroundElement" style={styles.section}>
            <ThemedText type="smallBold">{t("settings.licenses")}</ThemedText>
          </ThemedView>
        </Pressable>

        <ThemedView style={styles.linkRow}>
          {PRIVACY_POLICY_URL ? (
            <Pressable
              accessibilityRole="link"
              testID="settings-privacy-policy-link"
              onPress={() => Linking.openURL(PRIVACY_POLICY_URL)}
              style={({ pressed }) => pressed && styles.pressed}
            >
              <ThemedText type="link">{t("settings.privacyPolicy")}</ThemedText>
            </Pressable>
          ) : null}
          {TERMS_OF_SERVICE_URL ? (
            <Pressable
              accessibilityRole="link"
              testID="settings-terms-link"
              onPress={() => Linking.openURL(TERMS_OF_SERVICE_URL)}
              style={({ pressed }) => pressed && styles.pressed}
            >
              <ThemedText type="link">
                {t("settings.termsOfService")}
              </ThemedText>
            </Pressable>
          ) : null}
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
  linkRow: {
    flexDirection: "row",
    gap: Spacing.three,
  },
  pressed: {
    opacity: 0.7,
  },
});
