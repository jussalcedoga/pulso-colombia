import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTranslator } from "../i18n";
import type { Report, User } from "../types";
import { ReportModal } from "./ReportModal";

const apiMocks = vi.hoisted(() => ({
  deleteReport: vi.fn(),
  reportComments: vi.fn(),
  sendOffer: vi.fn()
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
  id: "rpt_test",
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
  details: "Test need with enough detail.",
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

const moderator: User = {
  id: "usr_moderator",
  displayName: "Owner",
  city: "manizales",
  accountType: "resident",
  role: "moderator",
  verified: false
};

function renderReport(user: User, currentReport = report) {
  const onChanged = vi.fn();
  const onEdit = vi.fn();
  const onConnectionCreated = vi.fn();
  render(
    <ReportModal
      t={createTranslator("en")}
      language="en"
      report={currentReport}
      user={user}
      hazards={null}
      onClose={vi.fn()}
      onEdit={onEdit}
      onRequireAuth={vi.fn()}
      onConnectionCreated={onConnectionCreated}
      onChanged={onChanged}
    />
  );
  return { onChanged, onEdit, onConnectionCreated };
}

describe("moderator report deletion", () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.clearAllMocks();
    apiMocks.reportComments.mockResolvedValue({ comments: [] });
    apiMocks.deleteReport.mockResolvedValue({ ok: true });
    apiMocks.sendOffer.mockResolvedValue({
      id: "ofr_direct",
      status: "accepted",
      canChat: true
    });
  });

  it("requires a second confirmation before deleting", async () => {
    const { onChanged } = renderReport(moderator);

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(screen.getByText("Delete this post?")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Delete permanently" }));

    await waitFor(() => expect(apiMocks.deleteReport).toHaveBeenCalledWith("rpt_test"));
    expect(onChanged).toHaveBeenCalledWith("Post deleted");
  });

  it("does not expose deletion controls to a resident", () => {
    renderReport({ ...moderator, id: "usr_resident", role: "resident" });

    expect(screen.queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();
  });

  it("allows the original author to edit and delete", () => {
    const { onEdit } = renderReport({
      ...moderator,
      id: report.userId,
      role: "resident"
    });

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    expect(onEdit).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
  });

  it("starts a direct private conversation with an available-help giver", async () => {
    const helpPost: Report = {
      ...report,
      id: "rpt_help",
      postType: "offer",
      details: "Drinking water is available for nearby families."
    };
    const { onConnectionCreated } = renderReport(
      moderator,
      helpPost
    );

    fireEvent.click(screen.getByRole("button", { name: "Contact" }));
    fireEvent.change(screen.getByLabelText("Private message"), {
      target: { value: "We need water for three people near the center." }
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Send private message" })
    );

    await waitFor(() =>
      expect(apiMocks.sendOffer).toHaveBeenCalledWith(
        helpPost.id,
        "supplies",
        "We need water for three people near the center."
      )
    );
    expect(onConnectionCreated).toHaveBeenCalledWith(
      "ofr_direct",
      "Message sent"
    );
  });
});
