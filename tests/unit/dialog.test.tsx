// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

function Example({ fromMenu = false }: { fromMenu?: boolean }) {
  const [open, setOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(fromMenu);
  return (
    <>
      <button type="button" id="menu-trigger" onClick={() => setMenuOpen(true)}>
        Add a photo
      </button>
      {menuOpen ? (
        // Stands in for a dropdown menu: it labels itself by its trigger and closes when an item is chosen.
        <div role="menu" aria-labelledby="menu-trigger">
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(true);
              // Radix keeps the menu mounted while it animates out, after the dialog has opened.
              setTimeout(() => setMenuOpen(false), 0);
            }}
          >
            From Unsplash
          </button>
        </div>
      ) : null}
      <button type="button" onClick={() => setOpen(true)}>
        Open guide
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent closeLabel="Close">
          <DialogTitle>Guide</DialogTitle>
          <DialogDescription>What the badges mean.</DialogDescription>
        </DialogContent>
      </Dialog>
    </>
  );
}

describe("DialogContent focus return", () => {
  it("gives focus back to the button that opened a dialog without a DialogTrigger", async () => {
    const user = userEvent.setup();
    render(<Example />);
    const opener = screen.getByRole("button", { name: "Open guide" });
    opener.focus();
    await user.keyboard("{Enter}");
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(opener).toHaveFocus();
  });

  it("gives focus to the menu's button when the dialog was opened from a menu item", async () => {
    const user = userEvent.setup();
    render(<Example fromMenu />);
    screen.getByRole("menuitem", { name: "From Unsplash" }).focus();
    await user.keyboard("{Enter}");
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Add a photo" })).toHaveFocus();
  });
});
