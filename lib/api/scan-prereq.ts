import { validateProjectInput } from "@/lib/validation/project";

export type ScanPrereqCode =
  | "name"
  | "repositoryUrl"
  | "documentationSourceUrl"
  | "openapiValidSpec";

export function collectScanPrereqMissing(input: {
  name: string;
  repositoryUrl: string;
  documentationSourceUrl: string;
  openapiAttached: boolean;
  openapiValid: boolean;
}): ScanPrereqCode[] {
  const missing: ScanPrereqCode[] = [];
  const v = validateProjectInput({
    name: input.name,
    repositoryUrl: input.repositoryUrl,
    documentationSourceUrl: input.documentationSourceUrl,
  });
  if (!v.ok) {
    if (v.errors.name) missing.push("name");
    if (v.errors.repositoryUrl) missing.push("repositoryUrl");
    if (v.errors.documentationSourceUrl) missing.push("documentationSourceUrl");
  } else {
    if (v.name.length === 0) missing.push("name");
  }
  if (!input.openapiAttached || !input.openapiValid) {
    missing.push("openapiValidSpec");
  }
  return Array.from(new Set(missing));
}
