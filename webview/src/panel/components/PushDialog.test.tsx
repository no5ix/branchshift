import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { PushDialog } from "./PushDialog";

function deferredVoid() {
  let resolve!: () => void;
  const promise = new Promise<void>((fulfill) => {
    resolve = () => fulfill();
  });
  return { promise, resolve };
}

afterEach(cleanup);

it("shows a force-push confirmation and prevents duplicate submissions", async () => {
  const pending = deferredVoid();
  const onPush = vi.fn(() => pending.promise);
  const view = render(
    <PushDialog branchName="feature" onClose={vi.fn()} onPush={onPush} />,
  );
  expect(view.getByText("⚠️ Force Push Branch")).toBeTruthy();
  expect(
    view.getByText("Force Push branch 'feature' to remote 'origin'."),
  ).toBeTruthy();
  expect(view.queryByRole("button", { name: "Push" })).toBeNull();
  const push = view.getByRole("button", { name: "Force Push" });

  fireEvent.click(push);
  fireEvent.click(push);
  expect(onPush).toHaveBeenCalledTimes(1);
  expect(onPush).toHaveBeenCalledWith(true);

  pending.resolve();
  await waitFor(() => expect((push as HTMLButtonElement).disabled).toBe(false));
});
