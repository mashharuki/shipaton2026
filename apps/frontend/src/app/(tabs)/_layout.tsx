import AppTabs from "@/components/app-tabs";

// 5.4: the 3 tab screens (home/report/settings) moved into this group so
// the root Stack (app/_layout.tsx) can also hold non-tab screens like
// results.tsx, pushed on top of this persistent tab bar rather than
// replacing it. AppTabs itself is unchanged from 4.1 -- URL paths ("/",
// "/report", "/settings") are unaffected by the group folder, which is
// transparent to routing.
export default function TabsLayout() {
  return <AppTabs />;
}
