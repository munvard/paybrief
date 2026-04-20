"use client";
import { useEffect, useRef, useState } from "react";

interface Props {
  businessId: string;
  width?: number;
  height?: number;
  color?: string;
  preloaded?: number[];
}

export function Sparkline({ businessId, width = 140, height = 28, color = "var(--forge)", preloaded }: Props) {
  const [data, setData] = useState<number[] | null>(preloaded ?? null);
  const ref = useRef<SVGPolylineElement>(null);

  useEffect(() => {
    if (data) return;
    let cancelled = false;
    fetch(`/api/biz/${businessId}/sparkline`)
      .then((r) => r.json())
      .then((j) => {
        if (!cancelled && Array.isArray(j.buckets)) setData(j.buckets as number[]);
      })
      .catch(() => {
        if (!cancelled) setData([0, 0, 0, 0, 0]);
      });
    return () => { cancelled = true; };
  }, [businessId, data]);

  if (!data || data.length < 2) {
    return (
      <svg width={width} height={height} aria-hidden="true" style={{ display: "block" }}>
        <line x1="0" y1={height - 1} x2={width} y2={height - 1} stroke="var(--rule)" strokeWidth="1" />
      </svg>
    );
  }

  const max = Math.max(...data, 0.01);
  const min = Math.min(...data, 0);
  const span = Math.max(max - min, 0.01);
  const stepX = width / (data.length - 1);
  const pad = 2;
  const pts = data
    .map((v, i) => {
      const x = i * stepX;
      const y = height - pad - ((v - min) / span) * (height - pad * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg width={width} height={height} aria-hidden="true" style={{ display: "block" }}>
      <line x1="0" y1={height - 1} x2={width} y2={height - 1} stroke="var(--rule)" strokeWidth="1" />
      <polyline
        ref={ref}
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
