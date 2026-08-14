import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTranslator } from "../i18n";
import type { Report } from "../types";
import { AdminModal } from "./AdminModal";

const apiMocks = vi.hoisted(() => ({
  deleteReport: vi.fn()
}));

vi.mock("../api", () => ({
  api: apiMocks,
  ApiRequestError: class ApiRequestError extends Error {
    constructor(
      message: string,
      public readonly code: string,
      public readonly status: number
    ) {
      super(message);
    }
  }
}));

const report: Report = {
  id: "rpt_admin_test",
  userId: "usr_author",
  postType: "need",
  locationMode: "local",
  city: "manizales",
  neighborhood: "Centro",
  h3Cell: "8966e6c1103ffff",
  latitude: 5.0679,
  longitude: -75.5162,
  needTypes: ["water"],
  urgency: 3,
  peopleCount: 2,
  details: "Disposable post shown in the moderation list.",
  status: "open",
  confirmations: 0,
  createdAt: "2026-08-14 08:00:00",
  updatedAt: "2026-08-14 08:00:00",
  author: {
    displayName: "Community member",
    accountType: "resident",
    role: "resident",
    verified: false
  }
};

describe("AdminModal", () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.clearAllMocks();
    apiMocks.deleteReport.mockResolvedValue({ ok: true });
  });

  it("lists active posts and permanently deletes after confirmation", async () => {
    const onDeleted = vi.fn();
    render(
      <AdminModal
        t={createTranslator("en")}
        language="en"
        reports={[report]}
        onClose={vi.fn()}
        onDeleted={onDeleted}
      />
    );

    expect(screen.getByText(report.details)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete permanently" }));

    await waitFor(() =>
      expect(apiMocks.deleteReport).toHaveBeenCalledWith("rpt_admin_test")
    );
    expect(onDeleted).toHaveBeenCalledWith("Post deleted");
  });
});
