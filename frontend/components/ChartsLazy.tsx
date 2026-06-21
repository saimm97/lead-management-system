"use client";

import dynamic from "next/dynamic";
import { Spinner } from "./ui";

const loading = () => (
  <div className="flex h-60 items-center justify-center">
    <Spinner />
  </div>
);

export const SourceDonut = dynamic(
  () => import("./Charts").then((m) => m.SourceDonut),
  { ssr: false, loading }
);
export const RepBarChart = dynamic(
  () => import("./Charts").then((m) => m.RepBarChart),
  { ssr: false, loading }
);
export const PipelineBar = dynamic(
  () => import("./Charts").then((m) => m.PipelineBar),
  { ssr: false, loading }
);
export const OutcomeBarChart = dynamic(
  () => import("./Charts").then((m) => m.OutcomeBarChart),
  { ssr: false, loading }
);
export const FunnelChartView = dynamic(
  () => import("./Charts").then((m) => m.FunnelChartView),
  { ssr: false, loading }
);
