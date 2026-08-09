import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { isErr, WEEKDAYS } from "shared";

import { SectionLabel } from "@/components/ui/section-label";
import {
  BottomTabInset,
  Colors,
  Fonts,
  Gradients,
  MaxContentWidth,
  Radius,
  Shadows,
  Spacing,
  Typography,
} from "@/constants/theme";
import {
  getNotificationPermissionStatus,
  registerPushNotification,
  requestNotificationPermission,
  unregisterPushNotification,
  usePushRegistrationStore,
  type Weekday,
} from "@/features/notifications/push-registration";
import { useAppColorScheme } from "@/hooks/use-app-color-scheme";

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

function EnableToggle({
  isOn,
  disabled,
  onToggle,
  testID,
}: {
  isOn: boolean;
  disabled: boolean;
  onToggle: () => void;
  testID: string;
}) {
  const scheme = useAppColorScheme();
  const c = Colors[scheme];

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: isOn, disabled }}
      disabled={disabled}
      onPress={onToggle}
      testID={testID}
    >
      {isOn ? (
        <LinearGradient
          colors={Gradients[scheme].signal}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={[styles.toggleTrack, styles.toggleTrackOn]}
        >
          <View style={[styles.toggleKnob, Shadows.card, styles.knobRight]} />
        </LinearGradient>
      ) : (
        <View style={[styles.toggleTrack, { backgroundColor: c.hairline }]}>
          <View style={[styles.toggleKnob, Shadows.card, styles.knobLeft]} />
        </View>
      )}
    </Pressable>
  );
}

// 10.1-10.5: smart-notification opt-in + frequency/time settings. Reached
// from the settings tab; design.md lists this file directly under 10.x's own
// component set (task 8.2), separate from task 9.2's settings-hub shell.
export default function NotificationsSettingsScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const scheme = useAppColorScheme();
  const c = Colors[scheme];
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
    <View
      style={[styles.container, { backgroundColor: c.background }]}
      testID="notifications-settings-screen"
    >
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.back()}
            testID="notifications-settings-back"
            style={styles.back}
          >
            <Text style={[styles.backText, { color: c.text }]}>
              {t("common.back")}
            </Text>
          </Pressable>
          <Text style={[styles.title, { color: c.text }]}>
            {t("notificationsSettings.title")}
          </Text>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={[styles.enableRow, { backgroundColor: c.surfaceMuted }]}>
            <Text style={[styles.enableLabel, { color: c.text }]}>
              {registration
                ? t("notificationsSettings.enabled")
                : t("notificationsSettings.disabled")}
            </Text>
            <EnableToggle
              isOn={!!registration}
              disabled={isSaving}
              onToggle={registration ? handleDisable : handleEnable}
              testID={
                registration ? "notifications-disable" : "notifications-enable"
              }
            />
          </View>

          <View style={styles.section}>
            <SectionLabel>{t("notificationsSettings.weekdays")}</SectionLabel>
            <View style={styles.weekdayRow}>
              {WEEKDAYS.map((day) => {
                const isSelected = weekdays.includes(day);
                return (
                  <Pressable
                    key={day}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    testID={`notifications-weekday-${day}`}
                    onPress={() =>
                      setWeekdays((prev) => toggleWeekday(prev, day))
                    }
                    style={[
                      styles.weekdayButton,
                      isSelected
                        ? {
                            backgroundColor: `${c.seat}24`,
                            borderColor: `${c.seat}80`,
                          }
                        : {
                            backgroundColor: c.surfaceMuted,
                            borderColor: c.hairline,
                          },
                    ]}
                  >
                    <Text
                      style={[
                        styles.weekdayText,
                        { color: isSelected ? c.seat : c.textSecondary },
                      ]}
                    >
                      {t(`notificationsSettings.weekdayShort.${day}`)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.section}>
            <SectionLabel>{t("notificationsSettings.notifyAt")}</SectionLabel>
            <View style={styles.optionRow}>
              {NOTIFY_AT_OPTIONS.map((option) => {
                const isSelected = notifyAt === option;
                return (
                  <Pressable
                    key={option}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    testID={`notifications-notify-at-${option}`}
                    onPress={() => setNotifyAt(option)}
                    style={[
                      styles.optionButton,
                      isSelected
                        ? {
                            backgroundColor: `${c.seat}24`,
                            borderColor: `${c.seat}80`,
                          }
                        : {
                            backgroundColor: c.surfaceMuted,
                            borderColor: c.hairline,
                          },
                    ]}
                  >
                    <Text
                      style={[
                        styles.optionText,
                        { color: isSelected ? c.seat : c.text },
                      ]}
                    >
                      {option}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.section}>
            <SectionLabel>
              {t("notificationsSettings.leadMinutes")}
            </SectionLabel>
            <View style={styles.optionRow}>
              {LEAD_MINUTES_OPTIONS.map((option) => {
                const isSelected = leadMinutes === option;
                return (
                  <Pressable
                    key={option}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    testID={`notifications-lead-minutes-${option}`}
                    onPress={() => setLeadMinutes(option)}
                    style={[
                      styles.optionButton,
                      isSelected
                        ? {
                            backgroundColor: `${c.seat}24`,
                            borderColor: `${c.seat}80`,
                          }
                        : {
                            backgroundColor: c.surfaceMuted,
                            borderColor: c.hairline,
                          },
                    ]}
                  >
                    <Text
                      style={[
                        styles.optionText,
                        { color: isSelected ? c.seat : c.text },
                      ]}
                    >
                      {t("notificationsSettings.minutesValue", {
                        minutes: option,
                      })}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {errorMessage ? (
            <Text style={[styles.errorText, { color: c.textSecondary }]}>
              {errorMessage}
            </Text>
          ) : null}

          {registration ? (
            <Pressable
              accessibilityRole="button"
              testID="notifications-update"
              disabled={isSaving}
              onPress={applyRegistration}
              style={styles.updateLink}
            >
              <Text style={[styles.updateLinkText, { color: c.rail }]}>
                {t("notificationsSettings.updateAction")}
              </Text>
            </Pressable>
          ) : null}

          {permissionGranted === false ? (
            <Text style={[styles.errorText, { color: c.textSecondary }]}>
              {t("notificationsSettings.permissionDenied")}
            </Text>
          ) : null}
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
  header: {
    paddingHorizontal: Spacing.five,
    paddingTop: Spacing.three,
    gap: Spacing.two,
  },
  back: {
    minWidth: 44,
    minHeight: 44,
    paddingHorizontal: 12,
    justifyContent: "center",
    alignSelf: "flex-start",
    marginLeft: -12,
  },
  backText: {
    fontFamily: Fonts.jpBold,
    fontSize: 14,
  },
  title: {
    ...Typography.h1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.five,
    paddingTop: Spacing.four,
    paddingBottom: BottomTabInset + Spacing.four,
    gap: Spacing.four,
    maxWidth: MaxContentWidth,
    alignSelf: "center",
    width: "100%",
  },
  enableRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: Radius.lg,
    padding: Spacing.four,
  },
  enableLabel: {
    fontFamily: Fonts.jpBold,
    fontSize: 14,
  },
  toggleTrack: {
    width: 56,
    height: 32,
    borderRadius: 16,
    padding: 3,
  },
  toggleTrackOn: {
    alignItems: "flex-end",
  },
  toggleKnob: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#FFFFFF",
  },
  knobLeft: {
    alignSelf: "flex-start",
  },
  knobRight: {
    alignSelf: "flex-end",
  },
  section: {
    gap: Spacing.two,
  },
  weekdayRow: {
    flexDirection: "row",
    gap: Spacing.one,
  },
  weekdayButton: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  weekdayText: {
    fontFamily: Fonts.jpBold,
    fontSize: 12,
  },
  optionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.two,
  },
  optionButton: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.lg,
    borderWidth: 1,
  },
  optionText: {
    fontFamily: Fonts.numBold,
    fontSize: 14,
  },
  errorText: {
    fontFamily: Fonts.jp,
    fontSize: 12,
  },
  updateLink: {
    minHeight: 44,
    justifyContent: "center",
  },
  updateLinkText: {
    fontFamily: Fonts.jpBold,
    fontSize: 14,
  },
});
