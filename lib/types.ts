export type ProjectListItem = {
  id: string;
  name: string;
  repositoryUrl: string;
  documentationSourceUrl: string;
  createdAt: string;
  updatedAt: string;
  lastScanAt: string | null;
  lastScanResult: "no_drift" | "drift" | "error" | null;
  lastScanIssueCount: number;
};

export type ProjectDetail = ProjectListItem & {
  openapi: {
    attached: boolean;
    originalFilename: string | null;
    validationStatus: "valid" | "invalid";
    updatedAt: string | null;
  };
};

export type IssueRow = {
  id: string;
  title: string;
  affectedArea: string;
  severity: string;
  status: string;
  detectedAt: string;
  scanRunId: string;
};

export type IssueDetail = IssueRow & {
  reason: string;
  documentationReference: string;
  ruleId: string;
};
