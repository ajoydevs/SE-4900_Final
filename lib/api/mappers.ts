type ProjectRow = {
  id: string;
  name: string;
  repository_url: string;
  documentation_source_url: string;
  created_at: string;
  updated_at: string;
  last_scan_at: string | null;
  last_scan_result: "no_drift" | "drift" | "error" | null;
  last_scan_issue_count: number | null;
};

export function mapProject(row: ProjectRow) {
  return {
    id: row.id,
    name: row.name,
    repositoryUrl: row.repository_url,
    documentationSourceUrl: row.documentation_source_url,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastScanAt: row.last_scan_at,
    lastScanResult: row.last_scan_result,
    lastScanIssueCount: row.last_scan_issue_count ?? 0,
  };
}
