import { fetchDemoData } from "@/lib/api";
import { WesDemoDashboard } from "@/components/wes-demo-dashboard";

export const dynamic = "force-dynamic";

export default async function Home() {
  const data = await fetchDemoData();
  return <WesDemoDashboard data={data} />;
}
