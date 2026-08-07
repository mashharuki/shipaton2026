import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Pressable, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { isErr, WEEKDAYS } from "shared";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { BottomTabInset, MaxContentWidth, Spacing } from "@/constants/theme";
import {
  getNotificationPermissionStatus,
  registerPushNotification,
  requestNotificationPermission,
  unregisterPushNotification,
  usePushRegistrationStore,
  type Weekday,
} from "@/features/notifications/push-registration";

const LEAD_MINUTES_OPTIONS = [15, 20, 25, 30] as const;
const NOTIFY_AT_OPTIONS = ["07:00", "07:30", "07:45", "08:00"] as const;

// 10.1: no station-picker exists yet -- same DEMO_QUERY substitute pattern
// used by the home screen's saved-routes/search entry points.
const DEMO_ROUTE = { fromStationId: "STA_SHINJUKU", toStationId: "STA_TOKYO" };
const DEFAULT_WEEKDAYS: Weekday[] = ["mon", "tue", "wed", "thu", "fri"];

function toggleWeekday(weekdays: Weekday[], day: Weekday): Weekday[] {
  return weekdays.includes(day)
    ? weekdays.filter((d) => d !== day)
    : [...weekdays, day];
}

// 10.1-10.5: smart-notification opt-in + frequency/time settings. Reached
// from the settings tab; design.md lists this file directly under 10.x's own
// component set (task 8.2), separate from task 9.2's settings-hub shell.
export default function NotificationsSettingsScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const registration = usePushRegistrationStore((state) => state.registration);

  const [permissionGranted, setPermissionGranted] = useState<boolean | null>(
    null,
  );
  const [weekdays, setWeekdays] = useState<Weekday[]>(
    registration?.weekdays ?? DEFAULT_WEEKDAYS,
  );
  const [notifyAt, setNotifyAt] = useState<string>(
    registration?.notifyAt ?? "07:45",
  );
  const [leadMinutes, setLeadMinutes] = useState<number>(
    registration?.leadMinutes ?? 20,
  );
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    getNotificationPermissionStatus().then((result) => {
      if (!isErr(result)) {
        setPermissionGranted(result.data);
      }
    });
  }, []);

  // usePushRegistrationStore persists through kv-store's async storage, so
  // `registration` can still be null/stale on this component's first render
  // (rehydration hasn't resolved yet) -- the useState initializers above
  // would otherwise permanently lock the form onto defaults even when a real
  // registration exists. Resync whenever the store's registration object
  // actually changes (hydration completing, or a save updating it).
  useEffect(() => {
    if (registration) {
      setWeekdays(registration.weekdays);
      setNotifyAt(registration.notifyAt);
      setLeadMinutes(registration.leadMinutes);
    }
  }, [registration]);

  const applyRegistration = async () => {
    setIsSaving(true);
    setErrorMessage(null);
    const result = await registerPushNotification({
      ...DEMO_ROUTE,
      weekdays,
      notifyAt,
      leadMinutes,
      locale: i18n.language === "ja" ? "ja" : "en",
    });
    setIsSaving(false);
    if (isErr(result)) {
      setErrorMessage(t("notificationsSettings.saveError"));
    }
  };

  // 10.1: pre-permission explanation shown before the OS dialog; declining
  // it (or the OS dialog itself) leaves the rest of the app untouched.
  const handleEnable = () => {
    Alert.alert(
      t("notificationsSettings.explanationTitle"),
      t("notificationsSettings.explanationBody"),
      [
        { text: t("notificationsSettings.explanationCancel"), style: "cancel" },
        {
          text: t("notificationsSettings.explanationConfirm"),
          onPress: async () => {
            const result = await requestNotificationPermission();
            const granted = !isErr(result) && result.data;
            setPermissionGranted(granted);
            if (granted) {
              await applyRegistration();
            }
          },
        },
      ],
    );
  };

  const handleDisable = async () => {
    setIsSaving(true);
    await unregisterPushNotification();
    setIsSaving(false);
  };

  return (
    <ThemedView style={styles.container} testID="notifications-settings-screen">
      <SafeAreaView style={styles.safeArea}>
        <ThemedView style={styles.header}>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.back()}
            testID="notifications-settings-back"
          >
            <ThemedText type="link">{t("common.back")}</ThemedText>
          </Pressable>
          <ThemedText type="title" style={styles.title}>
            {t("notificationsSettings.title")}
          </ThemedText>
        </ThemedView>

        {registration ? (
          <ThemedText type="small" themeColor="textSecondary">
            {t("notificationsSettings.enabled")}
          </ThemedText>
        ) : (
          <ThemedText type="small" themeColor="textSecondary">
            {t("notificationsSettings.disabled")}
          </ThemedText>
        )}

        <ThemedView type="backgroundElement" style={styles.section}>
          <ThemedText type="smallBold">
            {t("notificationsSettings.weekdays")}
          </ThemedText>
          <ThemedView style={styles.optionRow}>
            {WEEKDAYS.map((day) => (
              <Pressable
                key={day}
                accessibilityRole="button"
                accessibilityState={{ selected: weekdays.includes(day) }}
                testID={`notifications-weekday-${day}`}
                onPress={() => setWeekdays((prev) => toggleWeekday(prev, day))}
              >
                <ThemedView
                  type={
                    weekdays.includes(day) ? "backgroundSelected" : "background"
                  }
                  style={styles.optionButton}
                >
                  <ThemedText type="small">
                    {t(`notificationsSettings.weekdayShort.${day}`)}
                  </ThemedText>
                </ThemedView>
              </Pressable>
            ))}
          </ThemedView>
        </ThemedView>

        <ThemedView type="backgroundElement" style={styles.section}>
          <ThemedText type="smallBold">
            {t("notificationsSettings.notifyAt")}
          </ThemedText>
          <ThemedView style={styles.optionRow}>
            {NOTIFY_AT_OPTIONS.map((option) => (
              <Pressable
                key={option}
                accessibilityRole="button"
                accessibilityState={{ selected: notifyAt === option }}
                testID={`notifications-notify-at-${option}`}
                onPress={() => setNotifyAt(option)}
              >
                <ThemedView
                  type={
                    notifyAt === option ? "backgroundSelected" : "background"
                  }
                  style={styles.optionButton}
                >
                  <ThemedText type="small">{option}</ThemedText>
                </ThemedView>
              </Pressable>
            ))}
          </ThemedView>
        </ThemedView>

        <ThemedView type="backgroundElement" style={styles.section}>
          <ThemedText type="smallBold">
            {t("notificationsSettings.leadMinutes")}
          </ThemedText>
          <ThemedView style={styles.optionRow}>
            {LEAD_MINUTES_OPTIONS.map((option) => (
              <Pressable
                key={option}
                accessibilityRole="button"
                accessibilityState={{ selected: leadMinutes === option }}
                testID={`notifications-lead-minutes-${option}`}
                onPress={() => setLeadMinutes(option)}
              >
                <ThemedView
                  type={
                    leadMinutes === option ? "backgroundSelected" : "background"
                  }
                  style={styles.optionButton}
                >
                  <ThemedText type="small">
                    {t("notificationsSettings.minutesValue", {
                      minutes: option,
                    })}
                  </ThemedText>
                </ThemedView>
              </Pressable>
            ))}
          </ThemedView>
        </ThemedView>

        {errorMessage ? (
          <ThemedText type="small" themeColor="textSecondary">
            {errorMessage}
          </ThemedText>
        ) : null}

        {registration ? (
          <Pressable
            accessibilityRole="button"
            testID="notifications-disable"
            disabled={isSaving}
            onPress={handleDisable}
          >
            <ThemedView type="backgroundElement" style={styles.actionButton}>
              <ThemedText type="smallBold">
                {t("notificationsSettings.disableAction")}
              </ThemedText>
            </ThemedView>
          </Pressable>
        ) : (
          <Pressable
            accessibilityRole="button"
            testID="notifications-enable"
            disabled={isSaving}
            onPress={handleEnable}
          >
            <ThemedView type="backgroundSelected" style={styles.actionButton}>
              <ThemedText type="smallBold">
                {t("notificationsSettings.enableAction")}
              </ThemedText>
            </ThemedView>
          </Pressable>
        )}

        {registration ? (
          <Pressable
            accessibilityRole="button"
            testID="notifications-update"
            disabled={isSaving}
            onPress={applyRegistration}
          >
            <ThemedText type="link">
              {t("notificationsSettings.updateAction")}
            </ThemedText>
          </Pressable>
        ) : null}

        {permissionGranted === false ? (
          <ThemedText type="small" themeColor="textSecondary">
            {t("notificationsSettings.permissionDenied")}
          </ThemedText>
        ) : null}
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
  optionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.two,
  },
  optionButton: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
  },
  actionButton: {
    alignItems: "center",
    paddingVertical: Spacing.two,
    borderRadius: Spacing.three,
  },
});
