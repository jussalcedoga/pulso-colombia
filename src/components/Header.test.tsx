import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createTranslator } from "../i18n";
import type { User } from "../types";
import { Header } from "./Header";

const moderator: User = {
  id: "usr_moderator",
  displayName: "Owner",
  city: "manizales",
  accountType: "resident",
  role: "moderator",
  verified: false
};

function renderHeader(user: User) {
  const onAdmin = vi.fn();
  render(
    <Header
      t={createTranslator("en")}
      language="en"
      user={user}
      hazards={null}
      inboxCount={0}
      onLanguageChange={vi.fn()}
      onAuth={vi.fn()}
      onLogout={vi.fn()}
      onInbox={vi.fn()}
      onAdmin={onAdmin}
    />
  );
  return { onAdmin };
}

describe("Header moderator controls", () => {
  afterEach(cleanup);

  it("shows a dedicated Manage button only to the moderator", () => {
    const { onAdmin } = renderHeader(moderator);

    fireEvent.click(screen.getByRole("button", { name: "Manage" }));
    expect(onAdmin).toHaveBeenCalledOnce();

    cleanup();
    renderHeader({ ...moderator, id: "usr_resident", role: "resident" });
    expect(screen.queryByRole("button", { name: "Manage" })).not.toBeInTheDocument();
  });
});
