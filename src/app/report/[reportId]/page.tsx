"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Markdown from "react-markdown";

interface Report {
  id: string;
  orderId: string;
  contentMarkdown: string;
  contentJson: string;
  sources: string;
  researchCostUsdc: number;
  createdAt: string;
}

export default function ReportPage() {
  const params = useParams();
  const reportId = params.reportId as string;
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchReport() {
      try {
        const res = await fetch(`/api/reports/${reportId}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load report");
        setReport(data.report);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load report");
      } finally {
        setLoading(false);
      }
    }
    fetchReport();
  }, [reportId]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Report Not Found</h2>
          <p className="text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  const sources: string[] = JSON.parse(report.sources || "[]");
  const meta = JSON.parse(report.contentJson || "{}");
  const apisCalled: string[] = meta.apisCalled || [];

  return (
    <div className="flex-1 flex flex-col">
      <header className="border-b border-border/50 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <a href="/" className="text-xl font-bold tracking-tight">
            Agent<span className="gradient-text">Zero</span>
          </a>
          <span className="text-sm text-muted-foreground">
            Generated {new Date(report.createdAt).toLocaleDateString()}
          </span>
        </div>
      </header>

      <main className="flex-1 max-w-4xl mx-auto px-6 py-12 w-full">
        {/* Title */}
        <div className="mb-10">
          <div className="inline-block mb-3 px-3 py-1 rounded-full bg-green-500/10 border border-green-500/20 text-sm text-green-400">
            Delivery Complete
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold mb-3">
            {meta.taskDescription
              ? meta.taskDescription.slice(0, 80)
              : `Report: ${meta.companyName || "Research"}`}
          </h1>
          <div className="flex flex-wrap gap-3 text-sm items-center">
            {meta.roundCount && (
              <span className="px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400">
                {meta.roundCount} round{meta.roundCount > 1 ? "s" : ""}
                {meta.durationMs && ` \u00b7 ${Math.round(meta.durationMs / 1000)}s`}
              </span>
            )}
            {meta.totalApiCalls && (
              <span className="px-2 py-0.5 rounded bg-yellow-500/10 text-yellow-400">
                {meta.totalApiCalls} API calls
              </span>
            )}
            {meta.taskType && (
              <span className="px-2 py-0.5 rounded bg-primary/10 text-primary-light">
                {meta.taskType.replace("_", " ")}
              </span>
            )}
            {apisCalled.map((api: string) => (
              <span key={api} className="px-2 py-0.5 rounded bg-muted text-muted-foreground">
                {api}
              </span>
            ))}
            {/* Cost hidden from users */}
          </div>
        </div>

        {/* Research Council */}
        {(meta.specialists || meta.debateCount || meta.totalPhases) && (
          <div className="rounded-xl bg-card border border-border p-4 mb-8 flex flex-wrap gap-4 text-sm">
            {meta.specialists && (
              <div>
                <span className="text-muted-foreground">Council: </span>
                <span>{meta.specialists.join(", ")}</span>
              </div>
            )}
            {meta.debateCount > 0 && (
              <div>
                <span className="text-muted-foreground">Debates: </span>
                <span>{meta.debateCount}</span>
              </div>
            )}
            {meta.totalPhases && (
              <div>
                <span className="text-muted-foreground">Phases: </span>
                <span>{meta.totalPhases}</span>
              </div>
            )}
          </div>
        )}

        {/* Report Content */}
        <article className="prose prose-invert prose-zinc max-w-none mb-16 [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:mt-10 [&_h2]:mb-4 [&_h2]:text-foreground [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-foreground [&_p]:text-zinc-300 [&_p]:leading-relaxed [&_ul]:text-zinc-300 [&_li]:mb-1 [&_strong]:text-foreground [&_a]:text-primary-light">
          <Markdown>{report.contentMarkdown}</Markdown>
        </article>

        {/* Sources */}
        {sources.length > 0 && (
          <div className="border-t border-border pt-8">
            <h3 className="text-lg font-semibold mb-4">Sources ({sources.length})</h3>
            <ul className="space-y-2">
              {sources.map((url, i) => (
                <li key={i}>
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary-light hover:underline break-all"
                  >
                    {url}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* CTA */}
        <div className="mt-12 text-center border-t border-border pt-8">
          <p className="text-muted-foreground mb-4">
            Report generated by Agent Zero using {(meta.apisCalled || []).length || "multiple"} premium data sources.
          </p>
          <a
            href="/"
            className="inline-block rounded-lg py-3 px-8 font-semibold text-white transition-all"
            style={{ background: "linear-gradient(180deg, #5934FF 0%, #4101F6 100%)" }}
          >
            Hire Agent Zero Again
          </a>
        </div>
      </main>
    </div>
  );
}
