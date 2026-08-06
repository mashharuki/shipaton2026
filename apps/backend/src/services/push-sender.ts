import {
  type AppError,
  createAppError,
  err,
  ok,
  type Result,
  toAppError,
} from "shared";

const EXPO_PUSH_API_URL = "https://exp.host/--/api/v2/push/send";

export type ExpoPushMessage = {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
};

export async function sendExpoPushNotifications(
  messages: ExpoPushMessage[],
): Promise<Result<void, AppError>> {
  if (messages.length === 0) {
    return ok(undefined);
  }

  try {
    const response = await fetch(EXPO_PUSH_API_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify(messages),
    });
    if (!response.ok) {
      return err(
        createAppError(
          "http_error",
          `Expo push API responded ${response.status}`,
        ),
      );
    }
    return ok(undefined);
  } catch (cause) {
    return err(toAppError(cause));
  }
}
