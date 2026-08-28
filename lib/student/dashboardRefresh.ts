export function createCoalescedDashboardRefresh(refresh: () => void, delayMs = 150) {
  let timer: ReturnType<typeof setTimeout> | null = null;

  return {
    schedule() {
      if (timer !== null) return;
      timer = setTimeout(() => {
        timer = null;
        refresh();
      }, delayMs);
    },
    cancel() {
      if (timer === null) return;
      clearTimeout(timer);
      timer = null;
    }
  };
}
