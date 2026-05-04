import type { Pool } from "pg";

export async function getLatestCompletedScanId(
  pool: Pool,
  projectId: string
): Promise<string | null> {
  const { rows } = await pool.query<{ id: string }>(
    `select id from scan_runs
     where project_id = $1
       and status = 'completed'
       and result in ('drift', 'no_drift')
       and completed_at is not null
     order by completed_at desc
     limit 1`,
    [projectId]
  );
  return rows[0]?.id ?? null;
}
