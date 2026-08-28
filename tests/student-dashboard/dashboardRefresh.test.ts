import { afterEach, describe, expect, it, vi } from "vitest";
import { createCoalescedDashboardRefresh } from "@/lib/student/dashboardRefresh";

describe("createCoalescedDashboardRefresh", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("coalesces a burst of completed sync events into one refresh", () => {
    vi.useFakeTimers();
    const refresh = vi.fn();
    const controller = createCoalescedDashboardRefresh(refresh, 150);

    controller.schedule();
    controller.schedule();
    controller.schedule();
    vi.advanceTimersByTime(149);
    expect(refresh).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(refresh).toHaveBeenCalledTimes(1);

    controller.schedule();
    vi.advanceTimersByTime(150);
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it("cancels a pending refresh when the dashboard unmounts", () => {
    vi.useFakeTimers();
    const refresh = vi.fn();
    const controller = createCoalescedDashboardRefresh(refresh, 150);

    controller.schedule();
    controller.cancel();
    vi.runAllTimers();

    expect(refresh).not.toHaveBeenCalled();
  });
});
