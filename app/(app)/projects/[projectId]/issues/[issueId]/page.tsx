import { IssueDetailClient } from "./issue-detail-client";
import Link from "next/link";
import { Suspense } from "react";

type Props = { params: Promise<{ projectId: string; issueId: string }> };

export default async function IssueDetailPage(props: Props) {
  const { projectId, issueId } = await props.params;

  return (
    <div className="space-y-6">
      <Suspense fallback={<div className="text-sm text-slate-600">Loading…</div>}>
        <IssueDetailClient projectId={projectId} issueId={issueId} />
      </Suspense>
      <p className="text-xs text-slate-500">
        <Link href="/" className="underline">
          Projects
        </Link>
      </p>
    </div>
  );
}
