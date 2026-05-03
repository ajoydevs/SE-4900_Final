const MAX_URL = 2048;
const MAX_NAME = 120;

export type ProjectFieldErrors = Partial<
  Record<"name" | "repositoryUrl" | "documentationSourceUrl", string>
>;

export function validateProjectInput(input: {
  name?: unknown;
  repositoryUrl?: unknown;
  documentationSourceUrl?: unknown;
}): { ok: true; name: string; repositoryUrl: string; documentationSourceUrl: string } | { ok: false; errors: ProjectFieldErrors } {
  const errors: ProjectFieldErrors = {};
  const nameRaw = typeof input.name === "string" ? input.name : "";
  const name = nameRaw.trim();
  if (name.length === 0) errors.name = "Project name is required.";
  else if (name.length > MAX_NAME) errors.name = `Name must be at most ${MAX_NAME} characters.`;

  const repo = validateUrlField(input.repositoryUrl, "repositoryUrl", errors);
  const doc = validateUrlField(input.documentationSourceUrl, "documentationSourceUrl", errors);

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }
  return {
    ok: true,
    name,
    repositoryUrl: repo!,
    documentationSourceUrl: doc!,
  };
}

function validateUrlField(
  value: unknown,
  key: "repositoryUrl" | "documentationSourceUrl",
  errors: ProjectFieldErrors
): string | undefined {
  if (typeof value !== "string" || value.trim().length === 0) {
    errors[key] =
      key === "repositoryUrl"
        ? "Repository URL is required and must be valid."
        : "Documentation source URL is required and must be valid.";
    return undefined;
  }
  const s = value.trim();
  if (s.length > MAX_URL) {
    errors[key] = "URL is too long.";
    return undefined;
  }
  let u: URL;
  try {
    u = new URL(s);
  } catch {
    errors[key] =
      key === "repositoryUrl"
        ? "Repository URL is required and must be valid."
        : "Documentation source URL is required and must be valid.";
    return undefined;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    errors[key] = "URL must use http or https.";
    return undefined;
  }
  return u.toString();
}

export function isUuid(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    id
  );
}
