// 9.3/18.2: pure URL-building for the settings/licenses.tsx support contact
// link -- testable independent of Linking, same precedent as
// push-registration.ts's buildPushRegistrationRequestBody.
export function buildSupportMailtoUrl(
  email: string,
  subject: string,
): string | null {
  if (!email) {
    return null;
  }
  return `mailto:${email}?subject=${encodeURIComponent(subject)}`;
}
