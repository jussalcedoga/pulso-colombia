import { describe, expect, it } from "vitest";
import {
  physicalImpactProxy,
  rankCities,
  rankLocalAreas,
  reportPriority,
  sampleMmi,
  scoreColor,
  summarizeCells
} from "./scoring";
import type { HazardResponse, MmiEvidenceCell, MmiGrid, Report } from "./types";

const grid: MmiGrid = {
  x: { start: -77, stop: -75, num: 3 },
  y: { start: 4, stop: 6, num: 3 },
  values: [
    4, 5, 6,
    5, 6, 7,
    6, 7, 8
  ]
};

const modeledCells: MmiEvidenceCell[] = [
  {
    id: "mmi-manizales-1",
    city: "manizales",
    bounds: [4.5, -76.5, 5.5, -75.5],
    mmi: 6
  }
];

function report(overrides: Partial<Report> = {}): Report {
  return {
    id: "rpt_1",
    userId: "usr_1",
    postType: "need",
    locationMode: "local",
    city: "manizales",
    neighborhood: "Centro",
    h3Cell: "882a107289fffff",
    latitude: 5,
    longitude: -76,
    needTypes: ["water"],
    urgency: 4,
    peopleCount: 3,
    details: "Se necesita agua potable.",
    status: "open",
    confirmations: 2,
    createdAt: "2026-08-13T00:00:00Z",
    updatedAt: "2026-08-13T00:00:00Z",
    author: {
      displayName: "Comunidad",
      accountType: "resident",
      role: "resident",
      verified: false
    },
    ...overrides
  };
}

describe("sampleMmi", () => {
  it("samples the nearest grid cell and rejects coordinates outside the grid", () => {
    expect(sampleMmi(grid, 5, -76)).toBe(6);
    expect(sampleMmi(grid, 6, -75)).toBe(8);
    expect(sampleMmi(grid, 7, -75)).toBeNull();
  });
});

describe("reportPriority", () => {
  it("raises priority with urgency and confirmations while reducing resolved reports", () => {
    const open = reportPriority(report(), modeledCells);
    const resolved = reportPriority(report({ status: "resolved" }), modeledCells);
    const critical = reportPriority(
      report({ urgency: 5, confirmations: 10 }),
      modeledCells
    );
    expect(open).toBeGreaterThan(resolved);
    expect(critical).toBeGreaterThan(open);
    expect(critical).toBeLessThanOrEqual(100);
  });
});

describe("physicalImpactProxy", () => {
  it("is bounded and responds nonlinearly to stronger shaking", () => {
    const light = physicalImpactProxy(4);
    const strong = physicalImpactProxy(7);
    const veryStrong = physicalImpactProxy(8);
    expect(light).toBeGreaterThan(0);
    expect(strong - light).toBeGreaterThan(veryStrong - strong);
    expect(veryStrong).toBeLessThan(100);
  });
});

describe("summarizeCells", () => {
  it("groups reports without losing need types or open counts", () => {
    const cells = summarizeCells(
      [
        report(),
        report({
          id: "rpt_2",
          needTypes: ["medical"],
          status: "matched",
          urgency: 5
        })
      ],
      modeledCells
    );
    expect(cells).toHaveLength(1);
    expect(cells[0].reportCount).toBe(2);
    expect(cells[0].openCount).toBe(1);
    expect(cells[0].needTypes).toEqual(expect.arrayContaining(["water", "medical"]));
  });
});

describe("rankCities", () => {
  it("combines official intensity with open reports", () => {
    const hazards = {
      cities: [
        { id: "manizales", name: "Manizales", latitude: 5, longitude: -76, mmi: 6 },
        { id: "cali", name: "Cali", latitude: 3.4, longitude: -76.5, mmi: 4 }
      ]
    } as unknown as HazardResponse;
    const ranked = rankCities(hazards, [report()]);
    expect(ranked[0].id).toBe("manizales");
    expect(ranked[0].openReports).toBe(1);
    expect(ranked[0].affectedPeople).toBe(3);
  });

  it("does not treat available-help posts as damage or community burden", () => {
    const hazards = {
      cities: [
        { id: "manizales", name: "Manizales", latitude: 5, longitude: -76, mmi: 5 }
      ]
    } as unknown as HazardResponse;
    const baseline = rankCities(hazards, [])[0];
    const withOffer = rankCities(
      hazards,
      [report({ postType: "offer", urgency: 5, peopleCount: 10_000, confirmations: 20 })]
    )[0];
    expect(withOffer.score).toBe(baseline.score);
    expect(withOffer.openReports).toBe(0);
    expect(withOffer.affectedPeople).toBe(0);
  });
});

describe("scoreColor", () => {
  it("uses stable severity colors", () => {
    expect(scoreColor(90)).toBe("#c62f3b");
    expect(scoreColor(10)).toBe("#668aa3");
  });
});

describe("rankLocalAreas", () => {
  it("ranks official mapped damage separately from community needs", () => {
    const hazards = {
      shakemap: { modeledCells },
      dyfi: { cells: [] },
      copernicus: {
        areas: [
          {
            id: "aoi",
            city: "manizales",
            name: "Centro",
            damagePoints: [
              {
                id: "damage-1",
                city: "manizales",
                latitude: 5,
                longitude: -76,
                classification: "destroyed",
                method: "Photo-interpretation"
              }
            ],
            roadBlocks: []
          }
        ]
      }
    } as unknown as HazardResponse;
    const ranked = rankLocalAreas("manizales", hazards, [report()]);
    expect(ranked).toHaveLength(1);
    expect(ranked[0].destroyed).toBe(1);
    expect(ranked[0].openReports).toBe(1);
    expect(ranked[0].neighborhood).toBe("Centro");
  });
});
