import { useRouter } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Pressable, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { MaxContentWidth, Spacing } from "@/constants/theme";
import { requestNotificationPermission } from "@/features/notifications/push-registration";
import { completeOnboarding } from "@/features/onboarding/onboarding-store";
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
    <ThemedView style={styles.container} testID="onboarding-screen">
      <SafeAreaView style={styles.safeArea}>
        <ThemedView style={styles.progress} testID="onboarding-progress">
          {Array.from({ length: STEP_COUNT }, (_, i) => (
            <ThemedView
              // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length step indicator, never reordered
              key={i}
              type={i === step ? "backgroundSelected" : "backgroundElement"}
              style={styles.progressDot}
            />
          ))}
        </ThemedView>

        <ThemedView style={styles.content}>
          {step === 0 ? (
            <ThemedView testID="onboarding-step-value" style={styles.step}>
              <ThemedText type="title">{t("onboarding.step1Title")}</ThemedText>
              <ThemedText type="default" themeColor="textSecondary">
                {t("onboarding.step1Body")}
              </ThemedText>
            </ThemedView>
          ) : null}

          {step === 1 ? (
            <ThemedView testID="onboarding-step-disclaimer" style={styles.step}>
              <ThemedText type="title">{t("onboarding.step2Title")}</ThemedText>
              <ThemedText type="default" themeColor="textSecondary">
                {t("onboarding.step2Body")}
              </ThemedText>
              <ThemedText
                type="smallBold"
                testID="onboarding-not-a-reservation"
              >
                {t("onboarding.notASeatReservation")}
              </ThemedText>
            </ThemedView>
          ) : null}

          {step === 2 ? (
            <ThemedView testID="onboarding-step-privacy" style={styles.step}>
              <ThemedText type="title">{t("onboarding.step3Title")}</ThemedText>
              <ThemedText type="default" themeColor="textSecondary">
                {t("onboarding.step3Body")}
              </ThemedText>
              <Pressable
                accessibilityRole="button"
                testID="onboarding-enable-notifications"
                onPress={handleNotificationStep}
                style={({ pressed }) => pressed && styles.pressed}
              >
                <ThemedView
                  type="backgroundElement"
                  style={styles.secondaryButton}
                >
                  <ThemedText type="smallBold">
                    {t("onboarding.notificationCta")}
                  </ThemedText>
                </ThemedView>
              </Pressable>
            </ThemedView>
          ) : null}
        </ThemedView>

        <Pressable
          accessibilityRole="button"
          testID="onboarding-next"
          onPress={() => (isLastStep ? finish() : setStep((s) => s + 1))}
          style={({ pressed }) => pressed && styles.pressed}
        >
          <ThemedView type="backgroundSelected" style={styles.primaryButton}>
            <ThemedText type="smallBold">
              {isLastStep ? t("onboarding.start") : t("onboarding.next")}
            </ThemedText>
          </ThemedView>
        </Pressable>
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
    paddingBottom: Spacing.four,
    gap: Spacing.four,
    maxWidth: MaxContentWidth,
    alignSelf: "center",
    width: "100%",
  },
  progress: {
    flexDirection: "row",
    gap: Spacing.two,
    justifyContent: "center",
  },
  progressDot: {
    width: Spacing.three,
    height: Spacing.one,
    borderRadius: Spacing.half,
  },
  content: {
    flex: 1,
    justifyContent: "center",
  },
  step: {
    gap: Spacing.three,
  },
  secondaryButton: {
    alignItems: "center",
    paddingVertical: Spacing.two,
    borderRadius: Spacing.three,
  },
  primaryButton: {
    alignItems: "center",
    paddingVertical: Spacing.two,
    borderRadius: Spacing.three,
  },
  pressed: {
    opacity: 0.7,
  },
});
