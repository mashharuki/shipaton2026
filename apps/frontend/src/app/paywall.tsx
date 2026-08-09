import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { createAppError } from "shared";

import { ErrorState } from "@/components/error-state";
import {
  BottomTabInset,
  Colors,
  Fonts,
  MaxContentWidth,
  Spacing,
} from "@/constants/theme";
import { fetchCustomerInfo } from "@/features/subscription/purchases-client";
import {
  isTrialPeriod,
  outcomeToAnalyticsEvent,
  type PaywallOutcome,
  usePaywallPresentation,
  useRestorePurchases,
} from "@/features/subscription/use-purchases";
import { useAppColorScheme } from "@/hooks/use-app-color-scheme";
import { analyticsClient } from "@/lib/analytics";
import { PRIVACY_POLICY_URL, TERMS_OF_SERVICE_URL } from "@/lib/config";

// 12.x/13.x: thin wrapper around RevenueCatUI.presentPaywall() -- the
// dashboard-configured template (pricing, trial, Free/Pro comparison) IS the
// paywall (design.md's flow section), this screen only drives presentation
// and supplies the footer items the template can't express (restore button,
// privacy/terms links, auto-renewal/cancellation copy -- 13.4/13.9/13.10).
export default function PaywallScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const scheme = useAppColorScheme();
  const c = Colors[scheme];
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

    // 17.1/10.1: "トライアル開始・購入完了/復元/失敗" -- a PURCHASED result
    // could be either a trial or a full purchase; CustomerInfo (fetched
    // fresh, since presentPaywall() itself doesn't return it) is the only
    // way to tell those apart.
    if (result.type === "purchased") {
      const infoResult = await fetchCustomerInfo();
      analyticsClient.track(
        infoResult.ok && isTrialPeriod(infoResult.data)
          ? "trial_started"
          : "purchase_completed",
        { planType: "pro" },
      );
    } else {
      const eventName = outcomeToAnalyticsEvent(result);
      if (eventName) {
        analyticsClient.track(
          eventName,
          eventName === "purchase_restored" ? { planType: "pro" } : {},
        );
      }
    }

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
      // 17.1/10.1: the explicit "購入を復元" button is a second trigger
      // point for the same funnel event openPaywall() tracks when
      // presentPaywall()'s own template drives a restore.
      analyticsClient.track("purchase_restored", { planType: "pro" });
      router.back();
    }
  }, [restore, router]);

  // 13.7: ERROR (purchase/restore failed) and NOT_PRESENTED (offering
  // couldn't be fetched) both need a retry affordance.
  const showRetry =
    outcome?.type === "error" || outcome?.type === "not_presented";
  const isNativePaywallUnavailable = outcome?.type === "unavailable";

  return (
    <View
      style={[styles.container, { backgroundColor: c.background }]}
      testID="paywall-screen"
    >
      <SafeAreaView style={styles.safeArea}>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.back()}
          testID="paywall-close"
          style={styles.close}
        >
          <Text style={[styles.closeText, { color: c.text }]}>
            {t("common.back")}
          </Text>
        </Pressable>

        {isPresenting ? (
          <View style={styles.center} testID="paywall-loading">
            <Text style={[styles.bodyText, { color: c.textSecondary }]}>
              {t("paywall.loading")}
            </Text>
          </View>
        ) : null}

        {showRetry ? (
          <ErrorState
            error={createAppError("unknown", "paywall_presentation_failed")}
            onRetry={openPaywall}
          />
        ) : null}

        {isNativePaywallUnavailable ? (
          <View
            style={styles.center}
            testID="paywall-development-build-required"
          >
            <Text style={[styles.bodyText, { color: c.textSecondary }]}>
              {t("paywall.developmentBuildRequired")}
            </Text>
          </View>
        ) : null}

        <View style={styles.footer}>
          <Pressable
            accessibilityRole="button"
            onPress={handleRestore}
            disabled={isRestoring || isNativePaywallUnavailable}
            testID="paywall-restore"
            style={styles.restoreLink}
          >
            <Text style={[styles.restoreLinkText, { color: c.rail }]}>
              {t("paywall.restorePurchases")}
            </Text>
          </Pressable>
          {restoreMessage === "success" ? (
            <Text
              style={[styles.smallText, { color: c.textSecondary }]}
              testID="paywall-restore-success"
            >
              {t("paywall.restoreSuccess")}
            </Text>
          ) : null}
          {restoreMessage === "error" ? (
            <Text
              style={[styles.smallText, { color: c.textSecondary }]}
              testID="paywall-restore-error"
            >
              {t("paywall.restoreError")}
            </Text>
          ) : null}

          <Text style={[styles.smallText, { color: c.textSecondary }]}>
            {t("paywall.renewalTerms")}
          </Text>

          <View style={styles.links}>
            {PRIVACY_POLICY_URL ? (
              <Pressable
                accessibilityRole="link"
                onPress={() => Linking.openURL(PRIVACY_POLICY_URL)}
                testID="paywall-privacy"
              >
                <Text style={[styles.smallText, { color: c.textSecondary }]}>
                  {t("paywall.privacyPolicy")}
                </Text>
              </Pressable>
            ) : null}
            {TERMS_OF_SERVICE_URL ? (
              <Pressable
                accessibilityRole="link"
                onPress={() => Linking.openURL(TERMS_OF_SERVICE_URL)}
                testID="paywall-terms"
              >
                <Text style={[styles.smallText, { color: c.textSecondary }]}>
                  {t("paywall.termsOfService")}
                </Text>
              </Pressable>
            ) : null}
          </View>
        </View>
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
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    gap: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.three,
    maxWidth: MaxContentWidth,
    alignSelf: "center",
    width: "100%",
  },
  close: {
    minWidth: 44,
    minHeight: 44,
    paddingHorizontal: 12,
    justifyContent: "center",
    alignSelf: "flex-start",
    marginLeft: -12,
  },
  closeText: {
    fontFamily: Fonts.jpBold,
    fontSize: 14,
  },
  bodyText: {
    fontFamily: Fonts.jp,
    fontSize: 14,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  footer: {
    gap: Spacing.two,
  },
  restoreLink: {
    minHeight: 44,
    justifyContent: "center",
  },
  restoreLinkText: {
    fontFamily: Fonts.jpBold,
    fontSize: 14,
  },
  smallText: {
    fontFamily: Fonts.jp,
    fontSize: 12,
  },
  links: {
    flexDirection: "row",
    gap: Spacing.three,
  },
});
