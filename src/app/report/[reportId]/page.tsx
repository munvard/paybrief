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
        setError(
          err instanceof Error ? err.message : "Failed to load report"
        );
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

  return (
    <div className="flex-1 flex flex-col">
      <header className="border-b border-border/50 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <a href="/" className="text-xl font-bold tracking-tight">
            Pay<span className="gradient-text">Brief</span>
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
            Brief Complete
          </div>
          <h1 className="text-4xl font-bold mb-2">
            Market Brief:{" "}
            <span className="gradient-text">{meta.companyName || "Report"}</span>
          </h1>
          <div className="flex gap-4 text-sm text-muted-foreground">
            <span>Focus: {meta.focusArea || "all"}</span>
            <span>{meta.searchResultCount || 0} sources searched</span>
            <span>{meta.scrapedPageCount || 0} pages analyzed</span>
          </div>
        </div>

        {/* Brief Content */}
        <article className="prose prose-invert prose-zinc max-w-none mb-16 [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:mt-10 [&_h2]:mb-4 [&_h2]:text-foreground [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-foreground [&_p]:text-zinc-300 [&_p]:leading-relaxed [&_ul]:text-zinc-300 [&_li]:mb-1 [&_strong]:text-foreground [&_a]:text-primary-light">
          <Markdown>{report.contentMarkdown}</Markdown>
        </article>

        {/* Sources */}
        {sources.length > 0 && (
          <div className="border-t border-border pt-8">
            <h3 className="text-lg font-semibold mb-4">
              Sources ({sources.length})
            </h3>
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

        {/* Meta */}
        <div className="mt-8 border-t border-border pt-6 text-sm text-muted-foreground">
          <p>
            Research cost: ${report.researchCostUsdc.toFixed(4)} USDC | Generated
            by PayBrief using Locus Wrapped APIs
          </p>
        </div>
      </main>
    </div>
  );
}
