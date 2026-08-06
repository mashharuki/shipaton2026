import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { isErr, type VS_EXPECTED_OUTCOMES } from "shared";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { BottomTabInset, MaxContentWidth, Spacing } from "@/constants/theme";
import { endCoachSession } from "@/features/coach/coach-store";
import { getTimetableData } from "@/features/dataset/dataset-repository";
import { createSqliteDatasetStore } from "@/features/dataset/dataset-store";
import type {
  FeedbackOutcomeSelection,
  VsExpectedAnswer,
} from "@/features/feedback/use-feedback";
import {
  buildFeedbackPayload,
  useFeedback,
} from "@/features/feedback/use-feedback";
import type { RouteLeg } from "@/features/search/route-search-engine";
import { createSqliteTripHistoryStore } from "@/features/trip-history/trip-history-repository";
import { analyticsClient } from "@/lib/analytics";
import { getDb } from "@/lib/db";
import type { SupportedLocale } from "@/lib/i18n";
import { intermediateStationIds } from "@/lib/station-utils";

type VsExpected = (typeof VS_EXPECTED_OUTCOMES)[number];

const VS_EXPECTED_KEYS: Record<VsExpected, string> = {
  less_crowded_than_expected: "feedback.lessCrowded",
  as_expected: "feedback.asExpected",
  more_crowded_than_expected: "feedback.moreCrowded",
};
const VS_EXPECTED_VALUES: readonly VsExpected[] = [
  "less_crowded_than_expected",
  "as_expected",
  "more_crowded_than_expected",
];

// 7.3/8.1-8.6: reached from coach.tsx's "end ride" button. Outcome selection
// (+ station tap when needed) is what actually submits -- the 2-tap
// completion condition ("フィードバック送信が2タップで完了") -- while the
// optional "vs predicted" row (8.3) can be tapped beforehand without
// blocking that flow, so it never becomes a mandatory 3rd tap.
export default function FeedbackScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{
    tripId?: string;
    legs?: string;
    startedAt?: string;
    railwayId?: string;
    legKey?: string;
    boardedAt?: string;
    predictedStandingMin?: string;
  }>();

  const legs = useMemo<RouteLeg[]>(() => {
    if (!params.legs) {
      return [];
    }
    try {
      const parsed = JSON.parse(params.legs);
      return Array.isArray(parsed) ? (parsed as RouteLeg[]) : [];
    } catch {
      return [];
    }
  }, [params.legs]);

  const [vsExpected, setVsExpected] = useState<VsExpectedAnswer>(undefined);
  const [showStationPicker, setShowStationPicker] = useState(false);
  const feedbackMutation = useFeedback();
  const [submitted, setSubmitted] = useState(false);

  const stationsQuery = useQuery({
    queryKey: ["feedback-stations", legs],
    enabled: legs.length > 0,
    queryFn: async () => {
      const db = await getDb();
      const store = createSqliteDatasetStore(db);
      const result = await getTimetableData(store);
      return isErr(result) ? null : result.data;
    },
  });

  const seatedStationCandidates = useMemo(() => {
    const timetable = stationsQuery.data;
    if (!timetable || legs.length === 0) {
      return [];
    }
    const firstLeg = legs[0];
    const lastLeg = legs[legs.length - 1];
    if (!firstLeg || !lastLeg) {
      return [];
    }
    const middleIds = intermediateStationIds(
      timetable,
      firstLeg.fromStationId,
      lastLeg.toStationId,
    );
    const stationsById = new Map(
      timetable.stations.map((station) => [station.id, station]),
    );
    const destination = stationsById.get(lastLeg.toStationId);
    const candidates = middleIds
      .map((id) => stationsById.get(id))
      .filter((station): station is NonNullable<typeof station> => !!station);
    return destination ? [...candidates, destination] : candidates;
  }, [stationsQuery.data, legs]);

  async function submit(selection: FeedbackOutcomeSelection) {
    if (
      !params.tripId ||
      !params.railwayId ||
      !params.legKey ||
      !params.boardedAt
    ) {
      return;
    }
    const payload = buildFeedbackPayload(
      {
        tripId: params.tripId,
        railwayId: params.railwayId,
        legKey: params.legKey,
        boardedAt: params.boardedAt,
      },
      selection,
      vsExpected,
      params.predictedStandingMin
        ? Number(params.predictedStandingMin)
        : undefined,
    );

    const result = await feedbackMutation.mutateAsync(payload);
    if (isErr(result)) {
      return;
    }

    const now = new Date().toISOString();
    const db = await getDb();
    const tripHistory = createSqliteTripHistoryStore(db);
    await tripHistory.saveTrip({
      tripId: params.tripId,
      legs,
      startedAt: params.startedAt || now,
      endedAt: now,
      feedback: { ...selection, ...(vsExpected ? { vsExpected } : {}) },
    });

    analyticsClient.track("feedback_submitted");
    endCoachSession();
    setSubmitted(true);
  }

  function handleOutcomePress(
    outcome: "seated_from_start" | "stood_whole_trip",
  ) {
    void submit({ seatedOutcome: outcome });
  }

  function handleSeatedFromMiddlePress() {
    setShowStationPicker(true);
  }

  function handleStationPress(stationId: string) {
    void submit({
      seatedOutcome: "seated_from_middle",
      seatedStationId: stationId,
    });
  }

  if (submitted) {
    return (
      <ThemedView style={styles.container} testID="feedback-screen">
        <SafeAreaView style={styles.safeArea}>
          <ThemedView
            style={styles.confirmation}
            testID="feedback-confirmation"
          >
            <ThemedText type="title">{t("feedback.submitted")}</ThemedText>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.replace("/")}
              testID="feedback-back-home"
            >
              <ThemedText type="link">{t("feedback.backHome")}</ThemedText>
            </Pressable>
          </ThemedView>
        </SafeAreaView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container} testID="feedback-screen">
      <SafeAreaView style={styles.safeArea}>
        <ThemedText type="title" style={styles.title}>
          {t("feedback.title")}
        </ThemedText>

        <ScrollView contentContainerStyle={styles.content}>
          <ThemedText type="smallBold" themeColor="textSecondary">
            {t("feedback.improvementNotice")}
          </ThemedText>

          {!showStationPicker ? (
            <>
              <ThemedText type="default">{t("feedback.prompt")}</ThemedText>
              <Pressable
                accessibilityRole="button"
                onPress={() => handleOutcomePress("seated_from_start")}
                testID="feedback-seated-from-start"
              >
                <ThemedView type="backgroundElement" style={styles.option}>
                  <ThemedText type="default">
                    {t("feedback.seatedFromStart")}
                  </ThemedText>
                </ThemedView>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={handleSeatedFromMiddlePress}
                testID="feedback-seated-from-middle"
              >
                <ThemedView type="backgroundElement" style={styles.option}>
                  <ThemedText type="default">
                    {t("feedback.seatedFromMiddle")}
                  </ThemedText>
                </ThemedView>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => handleOutcomePress("stood_whole_trip")}
                testID="feedback-stood-whole-trip"
              >
                <ThemedView type="backgroundElement" style={styles.option}>
                  <ThemedText type="default">
                    {t("feedback.stoodWholeTrip")}
                  </ThemedText>
                </ThemedView>
              </Pressable>
            </>
          ) : (
            <>
              <ThemedText type="default">
                {t("feedback.selectSeatedStation")}
              </ThemedText>
              {seatedStationCandidates.map((station) => (
                <Pressable
                  key={station.id}
                  accessibilityRole="button"
                  onPress={() => handleStationPress(station.id)}
                  testID={`feedback-station-${station.id}`}
                >
                  <ThemedView type="backgroundElement" style={styles.option}>
                    <ThemedText type="default">
                      {(i18n.language as SupportedLocale) === "ja"
                        ? station.nameJa
                        : station.nameEn}
                    </ThemedText>
                  </ThemedView>
                </Pressable>
              ))}
            </>
          )}

          <ThemedText type="small" style={styles.sectionLabel}>
            {t("feedback.vsExpectedPrompt")}
          </ThemedText>
          <ThemedView style={styles.vsExpectedRow}>
            {VS_EXPECTED_VALUES.map((value) => (
              <Pressable
                key={value}
                accessibilityRole="button"
                onPress={() => setVsExpected(value)}
                testID={`feedback-vs-expected-${value}`}
              >
                <ThemedView
                  type={
                    vsExpected === value
                      ? "backgroundSelected"
                      : "backgroundElement"
                  }
                  style={styles.vsExpectedOption}
                >
                  <ThemedText type="small">
                    {t(VS_EXPECTED_KEYS[value])}
                  </ThemedText>
                </ThemedView>
              </Pressable>
            ))}
          </ThemedView>

          {feedbackMutation.isError ? (
            <ThemedText
              type="small"
              themeColor="textSecondary"
              testID="feedback-submit-error"
            >
              {t("feedback.submitError")}
            </ThemedText>
          ) : null}
        </ScrollView>
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
  title: {
    textAlign: "left",
  },
  content: {
    gap: Spacing.two,
  },
  option: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
  },
  sectionLabel: {
    marginTop: Spacing.three,
  },
  vsExpectedRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.one,
  },
  vsExpectedOption: {
    borderRadius: Spacing.three,
    padding: Spacing.two,
  },
  confirmation: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.three,
  },
});
