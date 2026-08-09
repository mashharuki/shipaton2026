import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { GradientButton } from "@/components/ui/gradient-button";
import {
  Colors,
  Fonts,
  MaxContentWidth,
  Radius,
  Spacing,
  Typography,
} from "@/constants/theme";
import { requestNotificationPermission } from "@/features/notifications/push-registration";
import { completeOnboarding } from "@/features/onboarding/onboarding-store";
import { useAppColorScheme } from "@/hooks/use-app-color-scheme";
import { analyticsClient } from "@/lib/analytics";

const STEP_COUNT = 3;

// 1.1-1.5: 3-screen value pager, shown once (gated by onboarding-store's
// kv-store flag, branched to from app/_layout.tsx). No screen requires the
// previous one's input, so this is plain local step state rather than a
// carousel library -- design.md doesn't name one, and the completion
// condition only needs "3 画面以内".
export default function OnboardingScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const scheme = useAppColorScheme();
  const c = Colors[scheme];
  const [step, setStep] = useState(0);

  // 1.5: navigate home regardless of whether persisting the flag succeeded --
  // a transient kv-store write failure must not trap the user on onboarding
  // forever with no way forward (worse than just re-showing onboarding once
  // more on the next cold start, which is the only consequence of the write
  // having failed).
  const finish = async () => {
    try {
      await completeOnboarding();
    } catch (cause) {
      console.warn("Failed to persist onboarding completion", cause);
    }
    // 17.1/10.1: fired regardless of whether the kv-store write above
    // succeeded -- the funnel step is "user finished onboarding", not
    // "flag persisted" (a persistence failure only means onboarding may
    // show again next cold start, it doesn't undo this session's completion).
    analyticsClient.track("onboarding_completed");
    router.replace("/(tabs)");
  };

  // 1.3: purpose shown before the OS permission dialog; 1.4: declining (via
  // "あとで"/"Not now", or the OS dialog itself) still finishes onboarding
  // into a fully usable app -- this step never blocks `finish`.
  const handleNotificationStep = () => {
    Alert.alert(
      t("onboarding.notificationExplanationTitle"),
      t("onboarding.notificationExplanationBody"),
      [
        { text: t("onboarding.notificationSkip"), style: "cancel" },
        {
          text: t("onboarding.notificationAllow"),
          onPress: () => requestNotificationPermission(),
        },
      ],
    );
  };

  const isLastStep = step === STEP_COUNT - 1;

  return (
    <View
      style={[styles.container, { backgroundColor: c.background }]}
      testID="onboarding-screen"
    >
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.topRow}>
          <View style={styles.progress} testID="onboarding-progress">
            {Array.from({ length: STEP_COUNT }, (_, i) => (
              <View
                // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length step indicator, never reordered
                key={i}
                style={[
                  styles.progressDot,
                  { backgroundColor: i <= step ? c.seat : c.hairline },
                ]}
              />
            ))}
          </View>
          {!isLastStep ? (
            <Pressable
              accessibilityRole="button"
              testID="onboarding-skip"
              onPress={finish}
              style={styles.skipButton}
            >
              <Text style={[styles.skipText, { color: c.textSecondary }]}>
                {t("onboarding.skip")}
              </Text>
            </Pressable>
          ) : null}
        </View>

        <View style={styles.content}>
          <LinearGradient
            colors={[`${c.rail}2E`, `${c.seat}14`]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0.7, y: 1 }}
            style={styles.visual}
          />

          {step === 0 ? (
            <View testID="onboarding-step-value" style={styles.step}>
              <Text style={[styles.stepTitle, { color: c.text }]}>
                {t("onboarding.step1Title")}
              </Text>
              <Text style={[styles.stepBody, { color: c.textSecondary }]}>
                {t("onboarding.step1Body")}
              </Text>
            </View>
          ) : null}

          {step === 1 ? (
            <View testID="onboarding-step-disclaimer" style={styles.step}>
              <Text style={[styles.stepTitle, { color: c.text }]}>
                {t("onboarding.step2Title")}
              </Text>
              <Text style={[styles.stepBody, { color: c.textSecondary }]}>
                {t("onboarding.step2Body")}
              </Text>
              <View
                style={[
                  styles.disclaimerCard,
                  { backgroundColor: c.surfaceMuted, borderColor: c.hairline },
                ]}
              >
                <Text
                  style={[styles.disclaimerText, { color: c.text }]}
                  testID="onboarding-not-a-reservation"
                >
                  {t("onboarding.notASeatReservation")}
                </Text>
              </View>
            </View>
          ) : null}

          {step === 2 ? (
            <View testID="onboarding-step-privacy" style={styles.step}>
              <Text style={[styles.stepTitle, { color: c.text }]}>
                {t("onboarding.step3Title")}
              </Text>
              <Text style={[styles.stepBody, { color: c.textSecondary }]}>
                {t("onboarding.step3Body")}
              </Text>
            </View>
          ) : null}
        </View>

        <View style={styles.footer}>
          <GradientButton
            label={isLastStep ? t("onboarding.start") : t("onboarding.next")}
            onPress={() => (isLastStep ? finish() : setStep((s) => s + 1))}
            testID="onboarding-next"
          />
          {isLastStep ? (
            <Pressable
              accessibilityRole="button"
              testID="onboarding-enable-notifications"
              onPress={handleNotificationStep}
              style={styles.notificationLink}
            >
              <Text style={[styles.notificationLinkText, { color: c.rail }]}>
                {t("onboarding.notificationCta")}
              </Text>
            </Pressable>
          ) : null}
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
    paddingHorizontal: Spacing.five,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.five,
    gap: Spacing.four,
    maxWidth: MaxContentWidth,
    alignSelf: "center",
    width: "100%",
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  progress: {
    flexDirection: "row",
    gap: Spacing.two,
  },
  progressDot: {
    width: 22,
    height: 4,
    borderRadius: 2,
  },
  skipButton: {
    minHeight: 44,
    paddingHorizontal: 12,
    justifyContent: "center",
  },
  skipText: {
    fontFamily: Fonts.jp,
    fontSize: 13,
  },
  content: {
    flex: 1,
    justifyContent: "center",
    gap: Spacing.five,
  },
  visual: {
    height: 210,
    borderRadius: Radius.xl,
  },
  step: {
    gap: Spacing.three,
  },
  stepTitle: {
    ...Typography.h1,
    fontSize: 27,
    lineHeight: 27 * 1.35,
  },
  stepBody: {
    fontFamily: Fonts.jp,
    fontSize: 14,
    lineHeight: 14 * 1.85,
  },
  disclaimerCard: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing.three,
  },
  disclaimerText: {
    fontFamily: Fonts.jpBold,
    fontSize: 13,
    lineHeight: 13 * 1.6,
  },
  footer: {
    gap: Spacing.two,
  },
  notificationLink: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  notificationLinkText: {
    fontFamily: Fonts.jpBold,
    fontSize: 13,
  },
});
