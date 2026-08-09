import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { GradientBorderCard } from "@/components/ui/gradient-border";
import {
  BottomTabInset,
  Colors,
  Fonts,
  MaxContentWidth,
  Radius,
  Spacing,
  Typography,
} from "@/constants/theme";
import { openSubscriptionManagement } from "@/features/subscription/purchases-client";
import { isPro } from "@/features/subscription/subscription-gate";
import { useAppColorScheme } from "@/hooks/use-app-color-scheme";
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

function OptionPill({
  label,
  isSelected,
  onPress,
  testID,
}: {
  label: string;
  isSelected: boolean;
  onPress: () => void;
  testID?: string;
}) {
  const scheme = useAppColorScheme();
  const c = Colors[scheme];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: isSelected }}
      onPress={onPress}
      testID={testID}
      style={[
        styles.optionButton,
        isSelected
          ? { backgroundColor: `${c.seat}24`, borderColor: `${c.seat}80` }
          : { backgroundColor: c.surfaceMuted, borderColor: c.hairline },
      ]}
    >
      <Text
        style={[
          styles.optionText,
          { color: isSelected ? c.seat : c.textSecondary },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function ListRow({
  label,
  onPress,
  testID,
  isLast,
}: {
  label: string;
  onPress: () => void;
  testID?: string;
  isLast?: boolean;
}) {
  const scheme = useAppColorScheme();
  const c = Colors[scheme];
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      testID={testID}
      style={[
        styles.listRow,
        !isLast && { borderBottomWidth: 1, borderBottomColor: c.hairline },
      ]}
    >
      <Text style={[styles.listRowText, { color: c.text }]}>{label}</Text>
    </Pressable>
  );
}

// 16.6 の設定ハブ本体（通知・位置情報・データ共有・履歴削除・サブスクリプ
// ション管理・プライバシーポリシー・利用規約への導線）は task 9.2 で実装。
// 位置情報・データ共有・履歴削除は settings/privacy.tsx に集約し、このハブ
// からはそこへの導線のみを持つ。
export default function SettingsScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const scheme = useAppColorScheme();
  const c = Colors[scheme];
  const preference = useThemeStore((state) => state.preference);
  const setPreference = useThemeStore((state) => state.setPreference);
  const pro = isPro();

  return (
    <View
      style={[styles.container, { backgroundColor: c.background }]}
      testID="settings-screen"
    >
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Text style={[styles.title, { color: c.text }]}>
            {t("settings.title")}
          </Text>

          <Pressable
            accessibilityRole="button"
            onPress={() =>
              pro ? openSubscriptionManagement() : router.push("/paywall")
            }
            testID="settings-plan-card"
          >
            <GradientBorderCard strong={pro}>
              <Text style={[styles.planLabel, { color: c.text }]}>
                {pro ? t("settings.planPro") : t("settings.planFree")}
              </Text>
              {!pro ? (
                <Text style={[styles.planCta, { color: c.seat }]}>
                  {t("settings.proCardCta")}
                </Text>
              ) : null}
            </GradientBorderCard>
          </Pressable>

          <View style={[styles.group, { backgroundColor: c.surfaceMuted }]}>
            <View style={styles.groupRow}>
              <Text style={[styles.groupLabel, { color: c.text }]}>
                {t("settings.appearance")}
              </Text>
              <View style={styles.optionRow}>
                {THEME_PREFERENCES.map((option) => (
                  <OptionPill
                    key={option}
                    label={t(PREFERENCE_LABEL_KEYS[option])}
                    isSelected={preference === option}
                    onPress={() => setPreference(option)}
                  />
                ))}
              </View>
            </View>
            <View
              style={[
                styles.groupRow,
                { borderTopWidth: 1, borderTopColor: c.hairline },
              ]}
            >
              <Text style={[styles.groupLabel, { color: c.text }]}>
                {t("settings.language")}
              </Text>
              <View style={styles.optionRow}>
                {SUPPORTED_LOCALES.map((locale) => (
                  <OptionPill
                    key={locale}
                    label={LOCALE_LABELS[locale]}
                    isSelected={i18n.language === locale}
                    onPress={() => i18n.changeLanguage(locale)}
                    testID={`settings-language-${locale}`}
                  />
                ))}
              </View>
            </View>
          </View>

          <View style={[styles.group, { backgroundColor: c.surfaceMuted }]}>
            <ListRow
              label={t("settings.notifications")}
              onPress={() => router.push("/settings/notifications")}
              testID="settings-notifications-link"
            />
            <ListRow
              label={t("settings.privacy")}
              onPress={() => router.push("/settings/privacy")}
              testID="settings-privacy-link"
            />
            <ListRow
              label={t("settings.subscriptionManagement")}
              onPress={() => openSubscriptionManagement()}
              testID="settings-subscription-management-link"
            />
            <ListRow
              label={t("settings.licenses")}
              onPress={() => router.push("/settings/licenses")}
              testID="settings-licenses-link"
            />
            <ListRow
              label={t("settings.replayOnboarding")}
              onPress={() => router.push("/onboarding")}
              testID="settings-replay-onboarding-link"
              isLast
            />
          </View>

          <View style={styles.linkRow}>
            {PRIVACY_POLICY_URL ? (
              <Pressable
                accessibilityRole="link"
                testID="settings-privacy-policy-link"
                onPress={() => Linking.openURL(PRIVACY_POLICY_URL)}
                style={styles.legalLink}
              >
                <Text
                  style={[styles.legalLinkText, { color: c.textSecondary }]}
                >
                  {t("settings.privacyPolicy")}
                </Text>
              </Pressable>
            ) : null}
            {TERMS_OF_SERVICE_URL ? (
              <Pressable
                accessibilityRole="link"
                testID="settings-terms-link"
                onPress={() => Linking.openURL(TERMS_OF_SERVICE_URL)}
                style={styles.legalLink}
              >
                <Text
                  style={[styles.legalLinkText, { color: c.textSecondary }]}
                >
                  {t("settings.termsOfService")}
                </Text>
              </Pressable>
            ) : null}
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.five,
    paddingTop: Spacing.five,
    gap: Spacing.four,
    paddingBottom: BottomTabInset + Spacing.three,
    maxWidth: MaxContentWidth,
    alignSelf: "center",
    width: "100%",
  },
  title: {
    ...Typography.h1,
  },
  planLabel: {
    fontFamily: Fonts.jpBold,
    fontSize: 16,
  },
  planCta: {
    fontFamily: Fonts.jpBold,
    fontSize: 13,
    marginTop: Spacing.one,
  },
  group: {
    borderRadius: Radius.xl,
    overflow: "hidden",
  },
  groupRow: {
    gap: Spacing.two,
    padding: Spacing.four,
  },
  groupLabel: {
    fontFamily: Fonts.jpBold,
    fontSize: 13,
  },
  optionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.two,
  },
  optionButton: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.lg,
    borderWidth: 1,
  },
  optionText: {
    fontFamily: Fonts.jp,
    fontSize: 12,
  },
  listRow: {
    minHeight: 56,
    justifyContent: "center",
    paddingHorizontal: Spacing.four,
  },
  listRowText: {
    fontFamily: Fonts.jp,
    fontSize: 14,
  },
  linkRow: {
    flexDirection: "row",
    gap: Spacing.three,
  },
  legalLink: {
    minHeight: 44,
    justifyContent: "center",
  },
  legalLinkText: {
    fontFamily: Fonts.jp,
    fontSize: 12,
  },
});
