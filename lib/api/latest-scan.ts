import type { SupabaseClient } from "@supabase/supabase-js";

export async function getLatestCompletedScanId(
  supabase: SupabaseClient,
  projectId: string
): Promise<string | null> {
  const { data } = await supabase
    .from("scan_runs")
    .select("id")
    .eq("project_id", projectId)
    .eq("status", "completed")
    .in("result", ["drift", "no_drift"])
    .not("completed_at", "is", null)
    .order("completed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data?.id ?? null;
}
