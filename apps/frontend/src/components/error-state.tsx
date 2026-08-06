import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet } from "react-native";
import type { AppError } from "shared";

import { Spacing } from "@/constants/theme";
import { getErrorDisplayContent } from "@/lib/error-display";
import { ThemedText } from "./themed-text";
import { ThemedView } from "./themed-view";

export type ErrorStateProps = {
  error: AppError;
  onRetry?: () => void;
};

// 15.1/15.5/3.3/13.7: single place every screen renders a failed ApiClient
// call through, so the copy and retry affordance (decided by
// error-display.ts) stay consistent regardless of which feature triggered
// it.
export function ErrorState({ error, onRetry }: ErrorStateProps) {
  const { t } = useTranslation();
  const content = getErrorDisplayContent(error);

  return (
    <ThemedView type="backgroundElement" style={styles.container}>
      <ThemedText type="small" themeColor="textSecondary">
        {t(content.messageKey)}
      </ThemedText>
      {content.canRetry && onRetry ? (
        <Pressable
          accessibilityRole="button"
          onPress={onRetry}
          style={({ pressed }) => pressed && styles.pressed}
        >
          <ThemedView type="backgroundSelected" style={styles.retryButton}>
            <ThemedText type="smallBold">{t("common.retry")}</ThemedText>
          </ThemedView>
        </Pressable>
      ) : null}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.two,
    borderRadius: Spacing.four,
    padding: Spacing.three,
    alignItems: "center",
  },
  retryButton: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
  },
  pressed: {
    opacity: 0.7,
  },
});
