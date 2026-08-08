import { useRouter } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Linking, Pressable, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { BottomTabInset, MaxContentWidth, Spacing } from "@/constants/theme";
import {
  DATA_SHARING_SCOPES,
  usePrivacySettingsStore,
} from "@/features/settings/privacy-settings-store";
import { createSqliteTripHistoryStore } from "@/features/trip-history/trip-history-repository";
import { getDb } from "@/lib/db";

// 9.2/16.4-16.7/18.1: データ共有範囲・位置情報アクセス（OS 設定への導線 --
// この既存コードベースに位置情報を実際に要求する機能は 1 つもない、7.1 の
// 「位置あり分岐は未実装」という既に承認済みの範囲と一致するため、OS 設定を
// 開くリンクのみを提供する）・移動履歴の削除（アカウントレス構成のデータ
// 削除導線）を集約する。設定ハブ（app/(tabs)/settings.tsx）から遷移する。
export default function PrivacySettingsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const dataSharingScope = usePrivacySettingsStore(
    (state) => state.dataSharingScope,
  );
  const setDataSharingScope = usePrivacySettingsStore(
    (state) => state.setDataSharingScope,
  );

  const [isDeleting, setIsDeleting] = useState(false);
  const [deletionResult, setDeletionResult] = useState<
    "success" | "error" | null
  >(null);

  const runDeletion = async () => {
    setIsDeleting(true);
    setDeletionResult(null);
    try {
      const db = await getDb();
      await createSqliteTripHistoryStore(db).deleteAllTrips();
      setDeletionResult("success");
    } catch (cause) {
      console.warn("Failed to delete trip history", cause);
      setDeletionResult("error");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteHistory = () => {
    Alert.alert(
      t("privacySettings.historyDeletionConfirmTitle"),
      t("privacySettings.historyDeletionConfirmBody"),
      [
        {
          text: t("privacySettings.historyDeletionConfirmCancel"),
          style: "cancel",
        },
        {
          text: t("privacySettings.historyDeletionConfirmDelete"),
          style: "destructive",
          onPress: runDeletion,
        },
      ],
    );
  };

  return (
    <ThemedView style={styles.container} testID="privacy-settings-screen">
      <SafeAreaView style={styles.safeArea}>
        <ThemedView style={styles.header}>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.back()}
            testID="privacy-settings-back"
          >
            <ThemedText type="link">{t("common.back")}</ThemedText>
          </Pressable>
          <ThemedText type="title" style={styles.title}>
            {t("privacySettings.title")}
          </ThemedText>
        </ThemedView>

        <ThemedView type="backgroundElement" style={styles.section}>
          <ThemedText type="smallBold">
            {t("privacySettings.dataSharing")}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {t("privacySettings.dataSharingBody")}
          </ThemedText>
          <ThemedView style={styles.optionRow}>
            {DATA_SHARING_SCOPES.map((scope) => (
              <Pressable
                key={scope}
                accessibilityRole="button"
                accessibilityState={{ selected: dataSharingScope === scope }}
                testID={`privacy-data-sharing-${scope}`}
                onPress={() => setDataSharingScope(scope)}
                style={({ pressed }) => pressed && styles.pressed}
              >
                <ThemedView
                  type={
                    dataSharingScope === scope
                      ? "backgroundSelected"
                      : "background"
                  }
                  style={styles.optionButton}
                >
                  <ThemedText type="small">
                    {t(`privacySettings.dataSharingScope.${scope}`)}
                  </ThemedText>
                </ThemedView>
              </Pressable>
            ))}
          </ThemedView>
        </ThemedView>

        <Pressable
          accessibilityRole="button"
          testID="privacy-open-os-settings"
          onPress={() => Linking.openSettings()}
          style={({ pressed }) => pressed && styles.pressed}
        >
          <ThemedView type="backgroundElement" style={styles.section}>
            <ThemedText type="smallBold">
              {t("privacySettings.location")}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {t("privacySettings.locationBody")}
            </ThemedText>
          </ThemedView>
        </Pressable>

        <ThemedView type="backgroundElement" style={styles.section}>
          <ThemedText type="smallBold">
            {t("privacySettings.historyDeletion")}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {t("privacySettings.historyDeletionBody")}
          </ThemedText>
          <Pressable
            accessibilityRole="button"
            testID="privacy-delete-history"
            disabled={isDeleting}
            onPress={handleDeleteHistory}
            style={({ pressed }) => pressed && styles.pressed}
          >
            <ThemedView type="backgroundSelected" style={styles.actionButton}>
              <ThemedText type="smallBold">
                {t("privacySettings.historyDeletionAction")}
              </ThemedText>
            </ThemedView>
          </Pressable>
          {deletionResult === "success" ? (
            <ThemedText
              type="small"
              themeColor="textSecondary"
              testID="privacy-history-deletion-success"
            >
              {t("privacySettings.historyDeletionSuccess")}
            </ThemedText>
          ) : null}
          {deletionResult === "error" ? (
            <ThemedText
              type="small"
              themeColor="textSecondary"
              testID="privacy-history-deletion-error"
            >
              {t("privacySettings.historyDeletionError")}
            </ThemedText>
          ) : null}
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
  pressed: {
    opacity: 0.7,
  },
});
