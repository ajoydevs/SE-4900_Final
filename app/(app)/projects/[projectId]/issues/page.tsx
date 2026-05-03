import { IssuesClient } from "./issues-client";
import Link from "next/link";
import { Suspense } from "react";

type Props = { params: Promise<{ projectId: string }> };

export default async function IssuesPage(props: Props) {
  const { projectId } = await props.params;

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/projects/${projectId}`} className="text-sm text-slate-600 hover:text-slate-900">
          ← Project
        </Link>
        <h1 className="mt-2 text-xl font-semibold text-slate-900">Drift results</h1>
        <p className="mt-1 text-sm text-slate-600">
          Issues from the latest completed scan only. Filters sync to the URL without a full reload.
        </p>
      </div>
      <Suspense fallback={<div className="text-sm text-slate-600">Loading issues…</div>}>
        <IssuesClient projectId={projectId} />
      </Suspense>
    </div>
  );
}
