import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";

const storage = new Map<string, string>();
Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: {
    clear: () => storage.clear(),
    getItem: (key: string) => storage.get(key) ?? null,
    removeItem: (key: string) => storage.delete(key),
    setItem: (key: string, value: string) => storage.set(key, value)
  }
});

const apiMocks = vi.hoisted(() => ({
  config: vi.fn(),
  inbox: vi.fn(),
  me: vi.fn(),
  reports: vi.fn()
}));

vi.mock("./api", () => ({
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

vi.mock("./components/Header", () => ({
  Header: ({
    inboxCount,
    onInbox
  }: {
    inboxCount: number;
    onInbox: () => void;
  }) => (
    <>
      <button type="button" onClick={onInbox}>
        Open test inbox
      </button>
      <span>Unread conversations: {inboxCount}</span>
    </>
  )
}));

vi.mock("./components/SidePanel", () => ({
  SidePanel: () => <div>Side panel</div>
}));

vi.mock("./components/MapView", () => ({
  MapView: () => <div>Map</div>
}));

vi.mock("./components/InboxModal", () => ({
  InboxModal: ({ user }: { user: { id: string } }) => (
    <div>Inbox for {user.id}</div>
  )
}));

describe("desktop inbox", () => {
  afterEach(cleanup);

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    apiMocks.config.mockResolvedValue({ turnstileSiteKey: null });
    apiMocks.reports.mockResolvedValue({ reports: [] });
    apiMocks.me.mockResolvedValue({
      user: {
        id: "usr_moderator",
        displayName: "Owner",
        city: "manizales",
        accountType: "resident",
        role: "moderator",
        verified: false
      }
    });
    apiMocks.inbox.mockResolvedValue({ offers: [] });
  });

  it("requests fresh inbox data whenever Messages is opened", async () => {
    render(<App />);

    await waitFor(() => expect(apiMocks.inbox).toHaveBeenCalledTimes(1));
    apiMocks.inbox.mockClear();

    fireEvent.click(screen.getByRole("button", { name: "Open test inbox" }));

    expect(await screen.findByText("Inbox for usr_moderator")).toBeInTheDocument();
    await waitFor(() => expect(apiMocks.inbox).toHaveBeenCalledTimes(1));
  });

  it("counts unread direct conversations in the header", async () => {
    apiMocks.inbox.mockResolvedValue({
      offers: [
        {
          id: "ofr_unread",
          reportId: "rpt_help",
          direction: "received",
          senderId: "usr_sender",
          senderName: "Sender",
          recipientId: "usr_moderator",
          recipientName: "Owner",
          offerType: "supplies",
          message: "Can we coordinate pickup privately?",
          responseMessage: "",
          status: "accepted",
          canChat: true,
          unreadCount: 2,
          createdAt: "2026-08-14 08:00:00",
          updatedAt: "2026-08-14 08:05:00",
          report: {
            postType: "offer",
            city: "manizales",
            neighborhood: "Centro",
            details: "Water is available for pickup."
          }
        }
      ]
    });

    render(<App />);

    expect(
      await screen.findByText("Unread conversations: 1")
    ).toBeInTheDocument();
  });
});
