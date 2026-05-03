import { ProjectForm } from "@/components/ProjectForm";
import Link from "next/link";

export default function NewProjectPage() {
  return (
    <div className="space-y-6">
      <div>
        <Link href="/" className="text-sm text-slate-600 hover:text-slate-900">
          ← Back to dashboard
        </Link>
        <h1 className="mt-2 text-xl font-semibold text-slate-900">Add Project</h1>
        <p className="mt-1 text-sm text-slate-600">
          Register a project name plus repository and documentation URLs.
        </p>
      </div>
      <ProjectForm mode="create" />
    </div>
  );
}
