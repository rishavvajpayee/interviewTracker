import { InterviewTrackerApp } from "@/components/InterviewTrackerApp";
import { getDashboardState } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default function Home() {
  const initial = getDashboardState();
  return <InterviewTrackerApp initial={initial} />;
}
