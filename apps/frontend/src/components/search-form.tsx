import { useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";

import { AppPressable } from "@/components/ui/app-pressable";
import { GradientBorderCard } from "@/components/ui/gradient-border";
import { GradientButton } from "@/components/ui/gradient-button";
import { OptionCard } from "@/components/ui/option-card";
import { Colors, Fonts, Spacing } from "@/constants/theme";
import type { TimetableDatasetPayload } from "@/features/dataset/dataset-store";
import { useAppColorScheme } from "@/hooks/use-app-color-scheme";
import type { SupportedLocale } from "@/lib/i18n";

export type SearchFormValue = {
  fromStationId: string | null;
  toStationId: string | null;
  departureTime: string | null;
};

type OpenPicker = "from" | "to" | "time" | null;

type Station = TimetableDatasetPayload["stations"][number];

function stationName(station: Station, locale: SupportedLocale): string {
  return locale === "ja" ? station.nameJa : station.nameEn;
}

function timeTestId(time: string): string {
  return `search-time-${time.replace(":", "")}`;
}

// 3.1/3.5: the search form. Every option comes from the synced timetable
// (see features/search/search-form.ts), so an out-of-area or
// no-such-train selection is not reachable from here. Inline expanding
// lists rather than a native picker: the app ships no picker dependency
// and the Playwright suite drives this on Expo web.
export function SearchForm({
  stations,
  departureTimes,
  value,
  onChange,
  onSubmit,
}: {
  stations: Station[];
  departureTimes: string[];
  value: SearchFormValue;
  onChange: (next: SearchFormValue) => void;
  onSubmit: () => void;
}) {
  const { t, i18n } = useTranslation();
  const scheme = useAppColorScheme();
  const c = Colors[scheme];
  const [open, setOpen] = useState<OpenPicker>(null);
  const locale = i18n.language as SupportedLocale;

  const fromStation = stations.find((s) => s.id === value.fromStationId);
  const toStation = stations.find((s) => s.id === value.toStationId);
  const isComplete =
    value.fromStationId !== null &&
    value.toStationId !== null &&
    value.departureTime !== null;

  // Selecting a new origin invalidates a destination that is no longer
  // downstream of it, and any previously picked time (the option list is
  // derived from the pair).
  const handleFromPress = (stationId: string) => {
    onChange({
      fromStationId: stationId,
      toStationId: value.toStationId === stationId ? null : value.toStationId,
      departureTime: null,
    });
    setOpen(null);
  };

  const handleToPress = (stationId: string) => {
    onChange({ ...value, toStationId: stationId, departureTime: null });
    setOpen(null);
  };

  const handleTimePress = (time: string) => {
    onChange({ ...value, departureTime: time });
    setOpen(null);
  };

  return (
    <GradientBorderCard>
      <View style={styles.rows}>
        <FieldRow
          label={t("search.fromLabel")}
          valueText={
            fromStation
              ? stationName(fromStation, locale)
              : t("search.selectFrom")
          }
          isPlaceholder={!fromStation}
          testID="search-from-trigger"
          onPress={() => setOpen(open === "from" ? null : "from")}
        />
        {open === "from"
          ? stations.map((station) => (
              <OptionCard
                key={station.id}
                label={stationName(station, locale)}
                onPress={() => handleFromPress(station.id)}
                testID={`search-from-${station.id}`}
              />
            ))
          : null}

        <FieldRow
          label={t("search.toLabel")}
          valueText={
            toStation ? stationName(toStation, locale) : t("search.selectTo")
          }
          isPlaceholder={!toStation}
          testID="search-to-trigger"
          onPress={() => setOpen(open === "to" ? null : "to")}
        />
        {open === "to"
          ? stations
              .filter((station) => station.id !== value.fromStationId)
              .map((station) => (
                <OptionCard
                  key={station.id}
                  label={stationName(station, locale)}
                  onPress={() => handleToPress(station.id)}
                  testID={`search-to-${station.id}`}
                />
              ))
          : null}

        <FieldRow
          label={t("search.timeLabel")}
          valueText={value.departureTime ?? t("search.selectTime")}
          isPlaceholder={value.departureTime === null}
          testID="search-time-trigger"
          onPress={() => setOpen(open === "time" ? null : "time")}
        />
        {open === "time" ? (
          departureTimes.length === 0 ? (
            <Text
              style={[styles.emptyText, { color: c.textSecondary }]}
              testID="search-no-departures"
            >
              {t("search.noDepartures")}
            </Text>
          ) : (
            departureTimes.map((time) => (
              <OptionCard
                key={time}
                label={time}
                onPress={() => handleTimePress(time)}
                testID={timeTestId(time)}
              />
            ))
          )
        ) : null}
      </View>

      <View style={styles.cta}>
        <GradientButton
          label={t("search.submit")}
          onPress={onSubmit}
          disabled={!isComplete}
          testID="search-submit"
        />
      </View>
    </GradientBorderCard>
  );
}

function FieldRow({
  label,
  valueText,
  isPlaceholder,
  testID,
  onPress,
}: {
  label: string;
  valueText: string;
  isPlaceholder: boolean;
  testID: string;
  onPress: () => void;
}) {
  const scheme = useAppColorScheme();
  const c = Colors[scheme];
  return (
    <AppPressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      testID={testID}
      style={[styles.fieldRow, { borderColor: c.hairline }]}
    >
      <Text style={[styles.fieldLabel, { color: c.textSecondary }]}>
        {label}
      </Text>
      <Text
        style={[
          styles.fieldValue,
          { color: isPlaceholder ? c.textSecondary : c.text },
        ]}
      >
        {valueText}
      </Text>
    </AppPressable>
  );
}

const styles = StyleSheet.create({
  rows: {
    gap: Spacing.two,
  },
  fieldRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    paddingVertical: 14,
  },
  fieldLabel: {
    fontFamily: Fonts.jp,
    fontSize: 12,
  },
  fieldValue: {
    fontFamily: Fonts.jpBold,
    fontSize: 16,
  },
  emptyText: {
    fontFamily: Fonts.jp,
    fontSize: 13,
    paddingVertical: Spacing.two,
  },
  cta: {
    marginTop: Spacing.four,
  },
});
