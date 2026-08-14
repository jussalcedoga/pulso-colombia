import { describe, expect, it } from "vitest";
import {
  canOpenConversation,
  initialConversationStatus
} from "./conversations";

describe("private conversation policy", () => {
  it("requires acceptance for offers made to a need post", () => {
    expect(initialConversationStatus("need")).toBe("pending");
    expect(canOpenConversation("pending", "need")).toBe(false);
    expect(canOpenConversation("accepted", "need")).toBe(true);
  });

  it.each(["offer", "update"] as const)(
    "opens %s post contacts immediately",
    (postType) => {
      expect(initialConversationStatus(postType)).toBe("accepted");
      expect(canOpenConversation("accepted", postType)).toBe(true);
    }
  );

  it("keeps legacy pending help contacts chat-enabled", () => {
    expect(canOpenConversation("pending", "offer")).toBe(true);
    expect(canOpenConversation("pending", "update")).toBe(true);
  });

  it("keeps closed conversations read-only", () => {
    expect(canOpenConversation("declined", "offer")).toBe(false);
    expect(canOpenConversation("withdrawn", "need")).toBe(false);
  });
});
