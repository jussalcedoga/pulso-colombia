import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTranslator } from "../i18n";
import type { PostType, Report, User } from "../types";
import { NeedModal } from "./NeedModal";

const apiMocks = vi.hoisted(() => ({
  updateReportContent: vi.fn()
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

vi.mock("./LocationPickerMap", () => ({
  LocationPickerMap: () => <div>Location picker</div>
}));

vi.mock("./TurnstileWidget", () => ({
  TurnstileWidget: () => null
}));

const author: User = {
  id: "usr_author",
  displayName: "Author",
  city: "manizales",
  accountType: "resident",
  role: "resident",
  verified: false
};

function reportFor(postType: PostType): Report {
  return {
    id: `rpt_${postType}`,
    userId: author.id,
    postType,
    locationMode: "local",
    city: "manizales",
    neighborhood: "Centro",
    h3Cell: "8966e6c1103ffff",
    latitude: 5.0679,
    longitude: -75.5162,
    needTypes: ["water", "food"],
    urgency: postType === "need" ? 4 : 1,
    peopleCount: postType === "update" ? 1 : 3,
    details: `Original ${postType} details for editing.`,
    status: "open",
    confirmations: 0,
    createdAt: "2026-08-14 08:00:00",
    updatedAt: "2026-08-14 08:00:00",
    author: {
      displayName: author.displayName,
      accountType: author.accountType,
      role: author.role,
      verified: false
    }
  };
}

describe("NeedModal editing", () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.clearAllMocks();
    apiMocks.updateReportContent.mockResolvedValue({ ok: true });
  });

  it.each<PostType>(["need", "offer", "update"])(
    "prefills and saves an existing %s post",
    async (postType) => {
      const report = reportFor(postType);
      const onPublished = vi.fn();
      render(
        <NeedModal
          t={createTranslator("en")}
          language="en"
          user={author}
          initialCity={report.city}
          initialPostType={report.postType}
          editingReport={report}
          turnstileSiteKey={null}
          onClose={vi.fn()}
          onPublished={onPublished}
        />
      );

      const details = screen.getByDisplayValue(report.details);
      fireEvent.change(details, {
        target: { value: `Updated ${postType} details with useful context.` }
      });
      fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

      await waitFor(() =>
        expect(apiMocks.updateReportContent).toHaveBeenCalledWith(
          report.id,
          expect.objectContaining({
            postType,
            details: `Updated ${postType} details with useful context.`
          })
        )
      );
      expect(onPublished).toHaveBeenCalledWith(postType);
    }
  );
});
