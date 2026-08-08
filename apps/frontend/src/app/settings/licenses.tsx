import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { Linking, Pressable, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { BottomTabInset, MaxContentWidth, Spacing } from "@/constants/theme";
import { SUPPORT_EMAIL } from "@/lib/config";
import { buildSupportMailtoUrl } from "@/lib/support";

const ODPT_TERMS_URL = "https://www.odpt.org/";

// 9.3/18.2/18.3: attribution for external data providers (ODPT, whose usage
// terms require an in-app credit -- requirements.md 18.3) plus a support
// contact entry point (18.2). MANUAL_VERIFY_REQUIRED, same disclosed-gap
// precedent as tasks.md's 3.8/4.1 notes: this environment has no access to
// re-confirm ODPT's current terms-of-use wording against this screen's exact
// text before store submission -- a human still owes that check.
export default function LicensesScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const supportUrl = buildSupportMailtoUrl(
    SUPPORT_EMAIL,
    t("licenses.supportEmailSubject"),
  );

  return (
    <ThemedView style={styles.container} testID="licenses-screen">
      <SafeAreaView style={styles.safeArea}>
        <ThemedView style={styles.header}>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.back()}
            testID="licenses-back"
          >
            <ThemedText type="link">{t("common.back")}</ThemedText>
          </Pressable>
          <ThemedText type="title" style={styles.title}>
            {t("licenses.title")}
          </ThemedText>
        </ThemedView>

        <ThemedView type="backgroundElement" style={styles.section}>
          <ThemedText type="smallBold">{t("licenses.odptTitle")}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {t("licenses.odptBody")}
          </ThemedText>
          <Pressable
            accessibilityRole="link"
            testID="licenses-odpt-link"
            onPress={() => Linking.openURL(ODPT_TERMS_URL)}
            style={({ pressed }) => pressed && styles.pressed}
          >
            <ThemedText type="link">{t("licenses.odptLinkLabel")}</ThemedText>
          </Pressable>
        </ThemedView>

        <ThemedView type="backgroundElement" style={styles.section}>
          <ThemedText type="smallBold">{t("licenses.supportTitle")}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {t("licenses.supportBody")}
          </ThemedText>
          {supportUrl ? (
            <Pressable
              accessibilityRole="link"
              testID="licenses-support-link"
              onPress={() => Linking.openURL(supportUrl)}
              style={({ pressed }) => pressed && styles.pressed}
            >
              <ThemedText type="link">{t("licenses.supportAction")}</ThemedText>
            </Pressable>
          ) : (
            <ThemedText
              type="small"
              themeColor="textSecondary"
              testID="licenses-support-unavailable"
            >
              {t("licenses.supportUnavailable")}
            </ThemedText>
          )}
        </ThemedView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    gap: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.three,
    maxWidth: MaxContentWidth,
    alignSelf: "center",
    width: "100%",
  },
  header: {
    gap: Spacing.one,
  },
  title: {
    textAlign: "left",
  },
  section: {
    gap: Spacing.two,
    borderRadius: Spacing.four,
    padding: Spacing.three,
  },
  pressed: {
    opacity: 0.7,
  },
});
