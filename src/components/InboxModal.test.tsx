import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTranslator } from "../i18n";
import type { Offer, User } from "../types";
import { InboxModal } from "./InboxModal";

const apiMocks = vi.hoisted(() => ({
  chatMessages: vi.fn(),
  sendChatMessage: vi.fn(),
  updateOffer: vi.fn()
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

const giver: User = {
  id: "usr_giver",
  displayName: "Local giver",
  city: "manizales",
  accountType: "volunteer",
  role: "resident",
  verified: false
};

function directConversation(): Offer {
  return {
    id: "ofr_direct",
    reportId: "rpt_help",
    direction: "received",
    senderId: "usr_seeker",
    senderName: "Neighbor seeking help",
    recipientId: giver.id,
    recipientName: giver.displayName,
    offerType: "supplies",
    message: "Could you provide drinking water for three people?",
    responseMessage: "",
    status: "accepted",
    canChat: true,
    unreadCount: 1,
    createdAt: "2026-08-14 08:00:00",
    updatedAt: "2026-08-14 08:00:00",
    report: {
      postType: "offer",
      city: "manizales",
      neighborhood: "Centro",
      details: "Drinking water is available for nearby families."
    }
  };
}

function pendingNeedOffer(): Offer {
  return {
    ...directConversation(),
    id: "ofr_need",
    reportId: "rpt_need",
    senderId: "usr_helper",
    senderName: "Community helper",
    message: "I can deliver water and food this afternoon.",
    status: "pending",
    canChat: false,
    report: {
      postType: "need",
      city: "manizales",
      neighborhood: "Centro",
      details: "A family needs drinking water and food."
    }
  };
}

function renderInbox(offers: Offer[], initialOfferId: string) {
  const onRead = vi.fn();
  const onChanged = vi.fn();
  render(
    <InboxModal
      t={createTranslator("en")}
      language="en"
      user={giver}
      offers={offers}
      loading={false}
      loadError=""
      initialOfferId={initialOfferId}
      onRefresh={vi.fn()}
      onRead={onRead}
      onClose={vi.fn()}
      onChanged={onChanged}
    />
  );
  return { onChanged, onRead };
}

describe("private conversations", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    apiMocks.chatMessages.mockResolvedValue({ messages: [] });
    apiMocks.sendChatMessage.mockResolvedValue({
      message: {
        id: 7,
        offerId: "ofr_direct",
        senderId: giver.id,
        senderName: giver.displayName,
        message: "Yes, I can arrange a pickup point.",
        createdAt: "2026-08-14 08:05:00",
        mine: true
      }
    });
    apiMocks.updateOffer.mockResolvedValue({ ok: true });
  });

  it("opens a giver conversation immediately and sends a reply", async () => {
    const offer = directConversation();
    const { onRead } = renderInbox([offer], offer.id);

    expect(
      await screen.findByRole("textbox", { name: "Write a message" })
    ).toBeInTheDocument();
    expect(screen.getAllByText(offer.message)).toHaveLength(2);
    expect(onRead).toHaveBeenCalledWith(offer.id);

    fireEvent.change(screen.getByRole("textbox", { name: "Write a message" }), {
      target: { value: "Yes, I can arrange a pickup point." }
    });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));

    await waitFor(() =>
      expect(apiMocks.sendChatMessage).toHaveBeenCalledWith(
        offer.id,
        "Yes, I can arrange a pickup point."
      )
    );
    expect(
      await screen.findByText("Yes, I can arrange a pickup point.")
    ).toBeInTheDocument();
  });

  it("keeps a need-post offer private until its recipient accepts", async () => {
    const offer = pendingNeedOffer();
    const { onChanged } = renderInbox([offer], offer.id);

    expect(
      await screen.findByRole("button", { name: "Accept and open chat" })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("textbox", { name: "Write a message" })
    ).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Private response"), {
      target: { value: "Please arrive at the community center after 2 PM." }
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Accept and open chat" })
    );

    await waitFor(() =>
      expect(apiMocks.updateOffer).toHaveBeenCalledWith(
        offer.id,
        "accepted",
        "Please arrive at the community center after 2 PM."
      )
    );
    expect(onChanged).toHaveBeenCalledWith("Accepted");
  });

  it("checks an active conversation again after four seconds", async () => {
    vi.useFakeTimers();
    const offer = directConversation();
    renderInbox([offer], offer.id);

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(apiMocks.chatMessages).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(4_000);
    });
    expect(apiMocks.chatMessages).toHaveBeenCalledTimes(2);
  });
});
