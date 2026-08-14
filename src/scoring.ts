import { cellToLatLng, latLngToCell } from "h3-js";
import type {
  CityId,
  DyfiEvidenceCell,
  HazardResponse,
  MmiEvidenceCell,
  MmiGrid,
  NeedType,
  Report
} from "./types";

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

export function sampleModeledMmi(
  cells: MmiEvidenceCell[] | null | undefined,
  latitude: number,
  longitude: number
): number | null {
  if (!cells?.length) return null;
  const cell = cells.find(({ bounds }) => {
    const [south, west, north, east] = bounds;
    return latitude >= south && latitude <= north && longitude >= west && longitude <= east;
  });
  return cell?.mmi ?? null;
}

export function reportPriority(
  report: Report,
  modeledCells?: MmiEvidenceCell[] | null
): number {
  if (report.postType !== "need") return 0;
  const mmi = sampleModeledMmi(modeledCells, report.latitude, report.longitude);
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

export function summarizeCells(
  reports: Report[],
  modeledCells?: MmiEvidenceCell[] | null
): CellSummary[] {
  const cells = new Map<string, CellSummary>();
  for (const report of reports) {
    if (report.postType !== "need") continue;
    const current = cells.get(report.h3Cell);
    const score = reportPriority(report, modeledCells);
    const mmi = sampleModeledMmi(modeledCells, report.latitude, report.longitude);
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
      const hasObservedEvidence =
        city.observedCdi != null && city.dyfiResponses > 0;
      const modeledWeight = hasObservedEvidence ? 0.6 : 0.72;
      const modeled = physicalImpactProxy(city.mmi) * modeledWeight;
      const observedConfidence = 1 - Math.exp(-city.dyfiResponses / 8);
      const observed = hasObservedEvidence
        ? physicalImpactProxy(city.observedCdi) * 0.12 * observedConfidence
        : 0;
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
        score: Math.round(Math.max(0, Math.min(100, modeled + observed + community))),
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

export type LocalPriorityBand = "critical" | "high" | "active";

export interface LocalAreaPriority {
  id: string;
  latitude: number;
  longitude: number;
  neighborhood: string;
  officialAreaName: string;
  triageIndex: number;
  priorityBand: LocalPriorityBand;
  destroyed: number;
  damaged: number;
  possiblyDamaged: number;
  roadBlocks: number;
  openReports: number;
  affectedPeople: number;
  criticalNeeds: number;
  modeledMmi: number | null;
  observedCdi: number | null;
  dyfiResponses: number;
}

interface MutableLocalArea extends LocalAreaPriority {
  neighborhoods: Map<string, number>;
}

function dyfiAtPoint(
  cells: DyfiEvidenceCell[],
  latitude: number,
  longitude: number
): { cdi: number; responses: number } | null {
  const cell = cells.find(({ bounds }) => {
    const [south, west, north, east] = bounds;
    return latitude >= south && latitude <= north && longitude >= west && longitude <= east;
  });
  return cell ? { cdi: cell.cdi, responses: cell.responses } : null;
}

export function rankLocalAreas(
  city: CityId,
  hazards: HazardResponse | null,
  reports: Report[]
): LocalAreaPriority[] {
  const groups = new Map<string, MutableLocalArea>();
  const getGroup = (
    latitude: number,
    longitude: number,
    officialAreaName = ""
  ): MutableLocalArea => {
    const id = latLngToCell(latitude, longitude, 9);
    const existing = groups.get(id);
    if (existing) {
      if (!existing.officialAreaName && officialAreaName) {
        existing.officialAreaName = officialAreaName;
      }
      return existing;
    }
    const [centerLatitude, centerLongitude] = cellToLatLng(id);
    const modeledMmi = sampleModeledMmi(
      hazards?.shakemap.modeledCells.filter((cell) => cell.city === city),
      centerLatitude,
      centerLongitude
    );
    const observed = dyfiAtPoint(
      hazards?.dyfi.cells.filter((cell) => cell.city === city) ?? [],
      centerLatitude,
      centerLongitude
    );
    const created: MutableLocalArea = {
      id,
      latitude: centerLatitude,
      longitude: centerLongitude,
      neighborhood: "",
      officialAreaName,
      triageIndex: 0,
      priorityBand: "active",
      destroyed: 0,
      damaged: 0,
      possiblyDamaged: 0,
      roadBlocks: 0,
      openReports: 0,
      affectedPeople: 0,
      criticalNeeds: 0,
      modeledMmi,
      observedCdi: observed?.cdi ?? null,
      dyfiResponses: observed?.responses ?? 0,
      neighborhoods: new Map()
    };
    groups.set(id, created);
    return created;
  };

  for (const area of hazards?.copernicus.areas.filter((item) => item.city === city) ?? []) {
    for (const point of area.damagePoints) {
      const group = getGroup(point.latitude, point.longitude, area.name);
      if (point.classification === "destroyed") group.destroyed += 1;
      else if (point.classification === "damaged") group.damaged += 1;
      else group.possiblyDamaged += 1;
    }
    for (const road of area.roadBlocks) {
      getGroup(road.latitude, road.longitude, area.name).roadBlocks += 1;
    }
  }

  for (const report of reports) {
    if (report.city !== city || report.postType !== "need" || report.status === "resolved") {
      continue;
    }
    const group = getGroup(report.latitude, report.longitude);
    group.openReports += 1;
    group.affectedPeople += report.peopleCount;
    if (report.urgency >= 4) group.criticalNeeds += 1;
    const neighborhood = report.neighborhood.trim();
    if (neighborhood) {
      group.neighborhoods.set(
        neighborhood,
        (group.neighborhoods.get(neighborhood) ?? 0) + 1
      );
    }
  }

  return [...groups.values()]
    .map((group) => {
      group.neighborhood =
        [...group.neighborhoods.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
      const damageBurden =
        group.destroyed * 5 + group.damaged * 3 + group.possiblyDamaged;
      const needBurden =
        group.criticalNeeds * 6 +
        group.openReports * 2 +
        Math.log1p(group.affectedPeople);
      const officialComponent = 60 * (1 - Math.exp(-damageBurden / 12));
      const communityComponent = 30 * (1 - Math.exp(-needBurden / 12));
      const shakingComponent =
        10 * (physicalImpactProxy(group.modeledMmi) / 100);
      group.triageIndex = Number(
        Math.min(100, officialComponent + communityComponent + shakingComponent).toFixed(1)
      );
      group.priorityBand =
        group.destroyed >= 3 || group.criticalNeeds >= 2
          ? "critical"
          : group.destroyed > 0 ||
              group.damaged >= 3 ||
              group.criticalNeeds > 0 ||
              group.roadBlocks > 0
            ? "high"
            : "active";
      const { neighborhoods: _neighborhoods, ...result } = group;
      return result;
    })
    .sort((a, b) => b.triageIndex - a.triageIndex);
}
