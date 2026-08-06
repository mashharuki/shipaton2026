import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Linking, Pressable, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { createAppError } from "shared";

import { ErrorState } from "@/components/error-state";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { BottomTabInset, MaxContentWidth, Spacing } from "@/constants/theme";
import {
  type PaywallOutcome,
  usePaywallPresentation,
  useRestorePurchases,
} from "@/features/subscription/use-purchases";
import { PRIVACY_POLICY_URL, TERMS_OF_SERVICE_URL } from "@/lib/config";

// 12.x/13.x: thin wrapper around RevenueCatUI.presentPaywall() -- the
// dashboard-configured template (pricing, trial, Free/Pro comparison) IS the
// paywall (design.md's flow section), this screen only drives presentation
// and supplies the footer items the template can't express (restore button,
// privacy/terms links, auto-renewal/cancellation copy -- 13.4/13.9/13.10).
export default function PaywallScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { present, isPresenting } = usePaywallPresentation();
  const { restore, isRestoring } = useRestorePurchases();
  const [outcome, setOutcome] = useState<PaywallOutcome | null>(null);
  const [restoreMessage, setRestoreMessage] = useState<
    "success" | "error" | null
  >(null);

  const openPaywall = useCallback(async () => {
    setOutcome(null);
    const result = await present();
    setOutcome(result);
    // 13.6: CANCELLED is not an error -- return to the pre-purchase state,
    // same as a successful purchase/restore (Pro is already reflected via
    // subscription-gate's CustomerInfo listener by the time this resolves).
    if (
      result.type === "purchased" ||
      result.type === "restored" ||
      result.type === "cancelled"
    ) {
      router.back();
    }
  }, [present, router]);

  // 12.5: reaching this screen at all already required a guard()-blocked
  // action upstream (task 6.4 wires that navigation) -- presenting
  // immediately on mount does not itself constitute a new trigger.
  // biome-ignore lint/correctness/useExhaustiveDependencies: present the paywall exactly once per mount, not on every openPaywall/present identity change.
  useEffect(() => {
    openPaywall();
  }, []);

  const handleRestore = useCallback(async () => {
    setRestoreMessage(null);
    const succeeded = await restore();
    setRestoreMessage(succeeded ? "success" : "error");
    if (succeeded) {
      router.back();
    }
  }, [restore, router]);

  // 13.7: ERROR (purchase/restore failed) and NOT_PRESENTED (offering
  // couldn't be fetched) both need a retry affordance.
  const showRetry =
    outcome?.type === "error" || outcome?.type === "not_presented";

  return (
    <ThemedView style={styles.container} testID="paywall-screen">
      <SafeAreaView style={styles.safeArea}>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.back()}
          testID="paywall-close"
        >
          <ThemedText type="link">{t("common.back")}</ThemedText>
        </Pressable>

        {isPresenting ? (
          <ThemedView style={styles.center} testID="paywall-loading">
            <ThemedText type="default" themeColor="textSecondary">
              {t("paywall.loading")}
            </ThemedText>
          </ThemedView>
        ) : null}

        {showRetry ? (
          <ErrorState
            error={createAppError("unknown", "paywall_presentation_failed")}
            onRetry={openPaywall}
          />
        ) : null}

        <ThemedView style={styles.footer}>
          <Pressable
            accessibilityRole="button"
            onPress={handleRestore}
            disabled={isRestoring}
            testID="paywall-restore"
          >
            <ThemedText type="link">{t("paywall.restorePurchases")}</ThemedText>
          </Pressable>
          {restoreMessage === "success" ? (
            <ThemedText
              type="small"
              themeColor="textSecondary"
              testID="paywall-restore-success"
            >
              {t("paywall.restoreSuccess")}
            </ThemedText>
          ) : null}
          {restoreMessage === "error" ? (
            <ThemedText
              type="small"
              themeColor="textSecondary"
              testID="paywall-restore-error"
            >
              {t("paywall.restoreError")}
            </ThemedText>
          ) : null}

          <ThemedText type="small" themeColor="textSecondary">
            {t("paywall.renewalTerms")}
          </ThemedText>

          <ThemedView style={styles.links}>
            {PRIVACY_POLICY_URL ? (
              <Pressable
                accessibilityRole="link"
                onPress={() => Linking.openURL(PRIVACY_POLICY_URL)}
                testID="paywall-privacy"
              >
                <ThemedText type="small">
                  {t("paywall.privacyPolicy")}
                </ThemedText>
              </Pressable>
            ) : null}
            {TERMS_OF_SERVICE_URL ? (
              <Pressable
                accessibilityRole="link"
                onPress={() => Linking.openURL(TERMS_OF_SERVICE_URL)}
                testID="paywall-terms"
              >
                <ThemedText type="small">
                  {t("paywall.termsOfService")}
                </ThemedText>
              </Pressable>
            ) : null}
          </ThemedView>
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
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  footer: {
    gap: Spacing.two,
  },
  links: {
    flexDirection: "row",
    gap: Spacing.three,
  },
});
