import type { HazardResponse, MmiGrid, NeedType, Report } from "./types";

export function sampleMmi(
  grid: MmiGrid | null | undefined,
  latitude: number,
  longitude: number
): number | null {
  if (!grid) return null;
  const xRatio = (longitude - grid.x.start) / (grid.x.stop - grid.x.start);
  const yRatio = (latitude - grid.y.start) / (grid.y.stop - grid.y.start);
  if (xRatio < 0 || xRatio > 1 || yRatio < 0 || yRatio > 1) return null;
  const x = Math.round(xRatio * (grid.x.num - 1));
  const y = Math.round(yRatio * (grid.y.num - 1));
  const value = grid.values[y * grid.x.num + x];
  return Number.isFinite(value) ? Number(value.toFixed(1)) : null;
}

export function physicalImpactProxy(mmi: number | null): number {
  if (mmi == null) return 20;
  return 100 / (1 + Math.exp(-1.2 * (mmi - 5.8)));
}

export function reportPriority(report: Report, grid?: MmiGrid | null): number {
  if (report.postType !== "need") return 0;
  const mmi = sampleMmi(grid, report.latitude, report.longitude);
  const official = physicalImpactProxy(mmi) * 0.6;
  const urgency = 24 * Math.pow(report.urgency / 5, 1.6);
  const exposure = 9 * Math.min(1, Math.log1p(report.peopleCount) / Math.log1p(50));
  const confirmation = 7 * (1 - Math.exp(-report.confirmations / 2));
  const statusAdjustment = report.status === "resolved" ? -45 : report.status === "matched" ? -15 : 0;
  return Math.round(
    Math.max(0, Math.min(100, official + urgency + exposure + confirmation + statusAdjustment))
  );
}

export interface CellSummary {
  h3Cell: string;
  latitude: number;
  longitude: number;
  score: number;
  mmi: number | null;
  reportCount: number;
  openCount: number;
  needTypes: NeedType[];
  reportIds: string[];
}

export function summarizeCells(reports: Report[], grid?: MmiGrid | null): CellSummary[] {
  const cells = new Map<string, CellSummary>();
  for (const report of reports) {
    if (report.postType !== "need") continue;
    const current = cells.get(report.h3Cell);
    const score = reportPriority(report, grid);
    const mmi = sampleMmi(grid, report.latitude, report.longitude);
    if (!current) {
      cells.set(report.h3Cell, {
        h3Cell: report.h3Cell,
        latitude: report.latitude,
        longitude: report.longitude,
        score,
        mmi,
        reportCount: 1,
        openCount: report.status === "open" ? 1 : 0,
        needTypes: [...report.needTypes],
        reportIds: [report.id]
      });
      continue;
    }
    current.score = Math.max(current.score, score);
    current.reportCount += 1;
    current.openCount += report.status === "open" ? 1 : 0;
    current.reportIds.push(report.id);
    current.needTypes = [...new Set([...current.needTypes, ...report.needTypes])];
  }
  return [...cells.values()].sort((a, b) => b.score - a.score);
}

export interface CityPriority {
  id: HazardResponse["cities"][number]["id"];
  name: string;
  latitude: number;
  longitude: number;
  mmi: number | null;
  score: number;
  openReports: number;
  affectedPeople: number;
}

export function rankCities(hazards: HazardResponse | null, reports: Report[]): CityPriority[] {
  if (!hazards) return [];
  return hazards.cities
    .map((city) => {
      const cityReports = reports.filter(
        (report) => report.city === city.id && report.postType === "need"
      );
      const open = cityReports.filter((report) => report.status === "open");
      const official = physicalImpactProxy(city.mmi) * 0.72;
      const burden = open.reduce(
        (total, report) =>
          total +
          Math.pow(report.urgency, 1.4) *
            Math.log1p(report.peopleCount) *
            (1 + Math.min(0.6, report.confirmations * 0.08)),
        0
      );
      const community = 28 * (1 - Math.exp(-burden / 30));
      return {
        ...city,
        score: Math.round(Math.max(0, Math.min(100, official + community))),
        openReports: open.length,
        affectedPeople: open.reduce((total, report) => total + report.peopleCount, 0)
      };
    })
    .sort((a, b) => b.score - a.score);
}

export function scoreColor(score: number): string {
  if (score >= 80) return "#c62f3b";
  if (score >= 60) return "#e5672f";
  if (score >= 40) return "#d6a72a";
  if (score >= 20) return "#4e9a67";
  return "#668aa3";
}
