"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/Button";
import { useGameDialogFocus } from "@/chess/hooks/useGameDialogFocus";
import type { StoreRewardReceipt } from "@/lib/avatar/storeRewards";
import { FreeClassCouponArt } from "./StoreRewardArt";
import styles from "./StoreRewards.module.css";
type CouponData = { receipts: StoreRewardReceipt[]; available: number };
const loads = new Map<
  string,
  { until: number; promise: Promise<CouponData> }
>();
function load(studentId: string) {
  const cached = loads.get(studentId);
  if (cached && cached.until > Date.now()) return cached.promise;
  const promise = fetch("/api/student/avatar/rewards", {
    cache: "no-store",
  }).then(async (r) => {
    const data = await r.json();
    if (!r.ok) throw Error(data.error);
    return {
      receipts: (data.receipts as StoreRewardReceipt[]).filter(
        (r) => r.kind === "free_class",
      ),
      available: data.availableCouponCount,
    };
  });
  loads.set(studentId, { until: Date.now() + 5000, promise });
  return promise;
}
function CouponsDialog({
  receipts,
  available,
  onClose,
}: {
  receipts: StoreRewardReceipt[];
  available: number;
  onClose: () => void;
}) {
  const focus = useGameDialogFocus(onClose);
  return createPortal(
    <div className={styles.overlay}>
      <section
        className={styles.dialog}
        ref={focus}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="free-coupons-title"
      >
        <div className="mx-auto h-40 w-40">
          <FreeClassCouponArt />
        </div>
        <h2 id="free-coupons-title" className="text-2xl font-black">
          {available} FREE class {available === 1 ? "coupon" : "coupons"}
        </h2>
        <p className="my-3 text-sm text-slate-300">
          Each available coupon covers one class. Coach Lem has your requests
          and will arrange the classes with you. Coupons stack until used.
        </p>
        <p className="text-xs text-slate-400">
          Recent purchases and available coupons shown below.
        </p>
        <ul className="my-4 max-h-48 space-y-2 overflow-auto text-left text-sm">
          {receipts.map((r) => (
            <li key={r.id} className="rounded-lg bg-white/5 p-3">
              {new Date(r.created_at).toLocaleDateString()} ·{" "}
              {r.status === "pending"
                ? "Available — awaiting teacher"
                : r.status === "fulfilled"
                  ? "Redeemed"
                  : "Refunded"}
              <span className="block text-xs text-slate-400">
                Coupon {r.id.slice(0, 8).toUpperCase()}
              </span>
            </li>
          ))}
        </ul>
        <Button onClick={onClose}>Close</Button>
      </section>
    </div>,
    document.body,
  );
}
export function FreeClassCoupons({ studentId }: { studentId: string }) {
  const anchor = useRef<HTMLDivElement>(null),
    [receipts, setReceipts] = useState<StoreRewardReceipt[]>([]),
    [available, setAvailable] = useState(0),
    [open, setOpen] = useState(false),
    [error, setError] = useState(false);
  useEffect(() => {
    let live = true;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        observer.disconnect();
        void load(studentId)
          .then((r) => {
            if (live) {
              setReceipts(r.receipts);
              setAvailable(r.available);
            }
          })
          .catch(() => {
            if (live) setError(true);
          });
      },
      { rootMargin: "100px" },
    );
    if (anchor.current) observer.observe(anchor.current);
    return () => {
      live = false;
      observer.disconnect();
    };
  }, [studentId]);
  return (
    <div ref={anchor} className="mt-4">
      {error && (
        <a href="/student/avatar" className="text-sm text-amber-200 underline">
          View your class coupons in the Avatar Store
        </a>
      )}
      {receipts.length > 0 && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="relative flex items-center gap-4 rounded-xl border border-amber-200/40 bg-gradient-to-r from-violet-950/70 to-slate-950 p-3 text-left shadow-[4px_4px_0_#b487342b,8px_8px_0_#b4873415]"
        >
          <span className="block h-24 w-24 shrink-0">
            <FreeClassCouponArt />
          </span>
          <span>
            <strong className="block text-lg text-amber-100">
              FREE Class × {available}
            </strong>
            <span className="text-sm text-slate-300">
              {available
                ? `${available} ${available === 1 ? "coupon" : "coupons"} available`
                : "View redeemed coupons"}
            </span>
          </span>
        </button>
      )}
      {open && (
        <CouponsDialog
          receipts={receipts}
          available={available}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}
