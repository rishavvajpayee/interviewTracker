import { InterviewTrackerApp } from "@/components/InterviewTrackerApp";
import { getDashboardState } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function Home() {
  const initial = await getDashboardState();
  return <InterviewTrackerApp initial={initial} />;
}
