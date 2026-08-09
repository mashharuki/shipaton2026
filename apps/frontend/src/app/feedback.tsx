import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { isErr, type VS_EXPECTED_OUTCOMES } from "shared";

import {
  BottomTabInset,
  Colors,
  Fonts,
  MaxContentWidth,
  Radius,
  Spacing,
  Typography,
} from "@/constants/theme";
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
import { RANKED_ROUTE_TYPES } from "@/features/search/route-ranker";
import type { RouteLeg } from "@/features/search/route-search-engine";
import { createSqliteTripHistoryStore } from "@/features/trip-history/trip-history-repository";
import { useAppColorScheme } from "@/hooks/use-app-color-scheme";
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

function OptionCard({
  label,
  onPress,
  testID,
}: {
  label: string;
  onPress: () => void;
  testID: string;
}) {
  const scheme = useAppColorScheme();
  const c = Colors[scheme];
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      testID={testID}
      style={[
        styles.option,
        { backgroundColor: c.surfaceMuted, borderColor: c.hairline },
      ]}
    >
      <Text style={[styles.optionText, { color: c.text }]}>{label}</Text>
    </Pressable>
  );
}

// 7.3/8.1-8.6: reached from coach.tsx's "end ride" button. Outcome selection
// (+ station tap when needed) is what actually submits -- the 2-tap
// completion condition ("フィードバック送信が2タップで完了") -- while the
// optional "vs predicted" row (8.3) can be tapped beforehand without
// blocking that flow, so it never becomes a mandatory 3rd tap.
export default function FeedbackScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const scheme = useAppColorScheme();
  const c = Colors[scheme];
  const params = useLocalSearchParams<{
    tripId?: string;
    legs?: string;
    startedAt?: string;
    railwayId?: string;
    legKey?: string;
    boardedAt?: string;
    predictedStandingMin?: string;
    routeType?: string;
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
    const routeType = RANKED_ROUTE_TYPES.find(
      (type) => type === params.routeType,
    );
    await tripHistory.saveTrip({
      tripId: params.tripId,
      legs,
      startedAt: params.startedAt || now,
      endedAt: now,
      ...(routeType ? { routeType } : {}),
      ...(params.predictedStandingMin
        ? { predictedStandingMinutes: Number(params.predictedStandingMin) }
        : {}),
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
      <View style={[styles.container, { backgroundColor: c.background }]}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.confirmation} testID="feedback-confirmation">
            <Text style={[styles.confirmationTitle, { color: c.text }]}>
              {t("feedback.submitted")}
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.replace("/")}
              testID="feedback-back-home"
              style={styles.backHomeButton}
            >
              <Text style={[styles.backHomeText, { color: c.seat }]}>
                {t("feedback.backHome")}
              </Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View
      style={[styles.container, { backgroundColor: c.background }]}
      testID="feedback-screen"
    >
      <SafeAreaView style={styles.safeArea}>
        <Text style={[styles.title, { color: c.text }]}>
          {t("feedback.title")}
        </Text>

        <ScrollView contentContainerStyle={styles.content}>
          <Text style={[styles.improvementNotice, { color: c.textSecondary }]}>
            {t("feedback.improvementNotice")}
          </Text>

          {!showStationPicker ? (
            <>
              <Text style={[styles.prompt, { color: c.text }]}>
                {t("feedback.prompt")}
              </Text>
              <OptionCard
                label={t("feedback.seatedFromStart")}
                onPress={() => handleOutcomePress("seated_from_start")}
                testID="feedback-seated-from-start"
              />
              <OptionCard
                label={t("feedback.seatedFromMiddle")}
                onPress={handleSeatedFromMiddlePress}
                testID="feedback-seated-from-middle"
              />
              <OptionCard
                label={t("feedback.stoodWholeTrip")}
                onPress={() => handleOutcomePress("stood_whole_trip")}
                testID="feedback-stood-whole-trip"
              />
            </>
          ) : (
            <>
              <Text style={[styles.prompt, { color: c.text }]}>
                {t("feedback.selectSeatedStation")}
              </Text>
              {seatedStationCandidates.map((station) => (
                <OptionCard
                  key={station.id}
                  label={
                    (i18n.language as SupportedLocale) === "ja"
                      ? station.nameJa
                      : station.nameEn
                  }
                  onPress={() => handleStationPress(station.id)}
                  testID={`feedback-station-${station.id}`}
                />
              ))}
            </>
          )}

          <SectionSpacer />
          <Text style={[styles.sectionLabel, { color: c.textSecondary }]}>
            {t("feedback.vsExpectedPrompt")}
          </Text>
          <View style={styles.vsExpectedRow}>
            {VS_EXPECTED_VALUES.map((value) => {
              const isSelected = vsExpected === value;
              return (
                <Pressable
                  key={value}
                  accessibilityRole="button"
                  onPress={() => setVsExpected(value)}
                  testID={`feedback-vs-expected-${value}`}
                  style={[
                    styles.vsExpectedOption,
                    isSelected
                      ? {
                          backgroundColor: `${c.seat}1F`,
                          borderColor: c.seat,
                        }
                      : {
                          backgroundColor: c.surfaceMuted,
                          borderColor: c.hairline,
                        },
                  ]}
                >
                  <Text
                    style={[
                      styles.vsExpectedText,
                      { color: isSelected ? c.seat : c.text },
                    ]}
                  >
                    {t(VS_EXPECTED_KEYS[value])}
                  </Text>
                  {isSelected ? (
                    <Feather
                      name="check"
                      size={13}
                      color={c.seat}
                      style={styles.vsExpectedCheck}
                    />
                  ) : null}
                </Pressable>
              );
            })}
          </View>

          {feedbackMutation.isError ? (
            <Text
              style={[styles.submitError, { color: c.textSecondary }]}
              testID="feedback-submit-error"
            >
              {t("feedback.submitError")}
            </Text>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function SectionSpacer() {
  return <View style={{ height: Spacing.three }} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: Spacing.five,
    paddingTop: Spacing.three,
    gap: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.three,
    maxWidth: MaxContentWidth,
    alignSelf: "center",
    width: "100%",
  },
  title: {
    ...Typography.h1,
  },
  content: {
    gap: Spacing.two,
  },
  improvementNotice: {
    fontFamily: Fonts.jpBold,
    fontSize: 12,
  },
  prompt: {
    fontFamily: Fonts.jp,
    fontSize: 15,
  },
  option: {
    minHeight: 60,
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing.three,
    justifyContent: "center",
  },
  optionText: {
    fontFamily: Fonts.jp,
    fontSize: 14,
  },
  sectionLabel: {
    fontFamily: Fonts.jp,
    fontSize: 13,
  },
  vsExpectedRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.one,
  },
  vsExpectedOption: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: Radius.lg,
    borderWidth: 1,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  vsExpectedText: {
    fontFamily: Fonts.jp,
    fontSize: 12,
  },
  vsExpectedCheck: {
    marginLeft: 6,
  },
  submitError: {
    fontFamily: Fonts.jp,
    fontSize: 12,
  },
  confirmation: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.three,
  },
  confirmationTitle: {
    ...Typography.h1,
  },
  backHomeButton: {
    minWidth: 44,
    minHeight: 44,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 12,
  },
  backHomeText: {
    fontFamily: Fonts.jpBold,
    fontSize: 14,
  },
});
