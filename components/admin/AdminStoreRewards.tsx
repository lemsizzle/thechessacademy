"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
type Redemption = {
  id: string;
  student_id: string;
  status: string;
  kind: string;
  price_paid: number;
  created_at: string;
  students: { display_name: string } | null;
};
export function AdminStoreRewards({
  adminActionToken,
}: {
  adminActionToken?: string;
}) {
  const [rows, setRows] = useState<Redemption[]>([]),
    [resolved, setResolved] = useState(false),
    [message, setMessage] = useState("Loading class requests…"),
    [busy, setBusy] = useState(false),
    [confirm, setConfirm] = useState<{
      id: string;
      status: "fulfilled" | "refunded";
      pricePaid: number;
    } | null>(null);
  async function refresh(showResolved: boolean) {
    const r = await fetch(
      `/api/admin/store-rewards?status=${showResolved ? "resolved" : "pending"}`,
      {
        cache: "no-store",
        headers: adminActionToken
          ? { "x-admin-action-token": adminActionToken }
          : {},
      },
    );
    const data = await r.json();
    if (!r.ok) throw Error(data.error);
    setRows(data.receipts);
    setMessage("");
  }
  useEffect(() => {
    void refresh(resolved).catch((e) => setMessage(e.message));
  }, [resolved, adminActionToken]);
  async function resolve() {
    if (!confirm || busy) return;
    setBusy(true);
    try {
      const r = await fetch("/api/admin/store-rewards", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(adminActionToken
            ? { "x-admin-action-token": adminActionToken }
            : {}),
        },
        body: JSON.stringify(confirm),
      });
      const data = await r.json();
      if (!r.ok) throw Error(data.error);
      setConfirm(null);
      await refresh(resolved);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not update request.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card className="mb-6 space-y-4 p-5">
      <div className="flex flex-wrap justify-between gap-3">
        <div>
          <h2 className="text-xl font-black">Free Class requests</h2>
          <p className="text-sm text-slate-300">
            Coupons can be purchased directly or won in a Mystery Box. Arrange
            the class with the student, then mark one coupon redeemed.
          </p>
        </div>
        <Button
          variant="secondary"
          disabled={busy}
          onClick={() => setResolved(!resolved)}
        >
          {resolved ? "Pending requests" : "View resolved"}
        </Button>
      </div>
      {message && (
        <p role="status" className="text-amber-200">
          {message}
        </p>
      )}
      {!rows.length && !message && (
        <p className="text-slate-400">
          No {resolved ? "resolved" : "pending"} class requests.
        </p>
      )}
      <ul className="space-y-3">
        {rows.map((r) => (
          <li
            key={r.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-white/5 p-3"
          >
            <div>
              <a
                className="font-bold text-cyan-200 underline"
                href={`/admin/students/${r.student_id}`}
              >
                {r.students?.display_name ?? "Student"}
              </a>
              <p className="text-sm">
                Coupon {r.id.slice(0, 8).toUpperCase()} ·{" "}
                {new Date(r.created_at).toLocaleDateString()} · {r.status}
                {r.kind === "mystery_box"
                  ? " · Mystery Box prize"
                  : " · Direct purchase"}
              </p>
            </div>
            {r.status === "pending" && (
              <div className="flex gap-2">
                <Button
                  disabled={busy}
                  onClick={() =>
                    setConfirm({
                      id: r.id,
                      status: "fulfilled",
                      pricePaid: r.price_paid,
                    })
                  }
                >
                  Mark redeemed
                </Button>
                <Button
                  variant="secondary"
                  disabled={busy}
                  onClick={() =>
                    setConfirm({
                      id: r.id,
                      status: "refunded",
                      pricePaid: r.price_paid,
                    })
                  }
                >
                  Refund coins
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>
      {confirm && (
        <div className="rounded-lg border border-amber-200/40 p-3">
          <p className="mb-3">
            {confirm.status === "fulfilled"
              ? "Mark this one coupon redeemed? The student's available coupon count will decrease by one."
              : `Return ${confirm.pricePaid.toLocaleString()} coins (the amount paid) and cancel this one coupon?`}
          </p>
          <div className="flex gap-2">
            <Button disabled={busy} onClick={() => void resolve()}>
              Confirm
            </Button>
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => setConfirm(null)}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
