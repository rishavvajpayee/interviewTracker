import { loadDashboardState } from "./db";

export async function getDashboardState() {
  return loadDashboardState();
}
