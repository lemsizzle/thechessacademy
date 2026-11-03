"use client";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/Button";
import { AvatarRenderer } from "@/components/avatar/AvatarRenderer";
import { useGameDialogFocus } from "@/chess/hooks/useGameDialogFocus";
import { FreeClassCouponArt, MysteryChestArt } from "./StoreRewardArt";
import {
  mysteryBoxPool,
  isFreeClassReward,
  STORE_REWARD_PRICES,
  type StoreRewardKind,
  type StoreRewardReceipt,
} from "@/lib/avatar/storeRewards";
import type { StudentAvatarState } from "@/lib/avatar/supabaseAvatar";
import type {
  AvatarItem,
  StudentAvatarConfig,
  StudentWallet,
} from "@/lib/types";
import styles from "./StoreRewards.module.css";

type StoreState = {
  items: AvatarItem[];
  ownedItemIds: string[];
  wallet: StudentWallet;
  avatar: StudentAvatarConfig;
};
function Chest({ opening = false }: { opening?: boolean }) {
  return (
    <div
      className={`${styles.stage} ${opening ? styles.opening : ""}`}
      aria-hidden="true"
    >
      <div className={styles.glow} />
      <MysteryChestArt />
      {opening &&
        Array.from({ length: 16 }, (_, i) => (
          <i
            key={i}
            className={styles.spark}
            style={
              {
                "--sx": `${Math.cos((i * Math.PI) / 8) * 145}px`,
                "--sy": `${Math.sin((i * Math.PI) / 8) * 115 - 30}px`,
              } as CSSProperties
            }
          />
        ))}
    </div>
  );
}
function RewardOpening({
  receipt,
  state,
  onClose,
  onEquip,
}: {
  receipt: StoreRewardReceipt;
  state: StoreState;
  onClose: () => void;
  onEquip: (item: AvatarItem) => void;
}) {
  const [revealed, setRevealed] = useState(receipt.kind !== "mystery_box");
  const focus = useGameDialogFocus(() =>
    revealed ? onClose() : setRevealed(true),
  );
  useEffect(() => {
    if (receipt.kind !== "mystery_box") return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setRevealed(true);
      return;
    }
    const timer = setTimeout(() => setRevealed(true), 1900);
    return () => clearTimeout(timer);
  }, [receipt.kind]);
  const item = state.items.find((i) => i.id === receipt.item_id);
  const isCoupon = isFreeClassReward(receipt);
  return createPortal(
    <div className={styles.overlay}>
      <section
        ref={focus}
        tabIndex={-1}
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="store-reward-title"
      >
        <p className="text-xs font-black uppercase tracking-[.2em] text-amber-200">
          Chess Quest treasures
        </p>
        <h2 id="store-reward-title" className="mt-2 text-2xl font-black">
          {!revealed
            ? "Something magical inside…"
            : isCoupon
              ? receipt.status === "refunded"
                ? "This coupon was refunded"
                : receipt.status === "fulfilled"
                  ? "This coupon was redeemed"
                  : "Your FREE coupon is ready!"
              : "A new treasure for you!"}
        </h2>
        {!revealed ? (
          <>
            <Chest opening />
            <Button variant="secondary" onClick={() => setRevealed(true)}>
              Skip animation
            </Button>
          </>
        ) : (
          <div className={styles.prize}>
            <div className={styles.rewardArt}>
              {isCoupon ? (
                <FreeClassCouponArt />
              ) : item ? (
                <AvatarRenderer
                  items={state.items}
                  avatar={state.avatar}
                  previewItem={item}
                  size="studio"
                  label={item.name}
                />
              ) : (
                <span className="text-7xl" aria-hidden="true">
                  ✦
                </span>
              )}
            </div>
            <h3 className="text-xl font-black text-amber-100">
              {isCoupon ? "One free class" : receipt.item_snapshot?.name}
            </h3>
            <p className="my-3 text-sm text-slate-200">
              {isCoupon
                ? receipt.status === "pending"
                  ? "Added to your Trophy Case. Coach Lem will arrange your class. Your FREE coupons stack!"
                  : "This coupon has already been used or refunded. Open your Trophy Case to see your available coupons."
                : "Saved to your collection. It's yours to keep!"}
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {item && (
                <Button
                  onClick={() => {
                    onEquip(item);
                    onClose();
                  }}
                >
                  Equip item
                </Button>
              )}
              <Button variant="secondary" onClick={onClose}>
                Done
              </Button>
            </div>
            {isCoupon && (
              <a
                href="/student#trophy-case"
                className="mt-4 block text-sm text-cyan-200 underline"
              >
                View Trophy Case
              </a>
            )}
          </div>
        )}
      </section>
    </div>,
    document.body,
  );
}
export function StoreSpecialRewards({
  state,
  disabled,
  beginPurchase,
  endPurchase,
  onState,
  onEquip,
}: {
  state: StoreState;
  disabled: boolean;
  beginPurchase: () => boolean;
  endPurchase: () => void;
  onState: (state: StudentAvatarState) => void;
  onEquip: (item: AvatarItem) => void;
}) {
  const [receipts, setReceipts] = useState<StoreRewardReceipt[]>([]),
    [ready, setReady] = useState(false),
    [error, setError] = useState("");
  const [confirm, setConfirm] = useState<StoreRewardKind | null>(null),
    [reveal, setReveal] = useState<StoreRewardReceipt | null>(null);
  const [pending, setPending] = useState<{
    kind: StoreRewardKind;
    requestId: string;
  } | null>(null);
  const inFlight = useRef(false),
    key = `store-reward-pending:${state.avatar.studentId}`;
  const pool = useMemo(
    () => mysteryBoxPool(state.items, state.ownedItemIds),
    [state.items, state.ownedItemIds],
  );
  useEffect(() => {
    const controller = new AbortController();
    try {
      const saved = JSON.parse(sessionStorage.getItem(key) ?? "null");
      if (
        saved &&
        ["free_class", "mystery_box"].includes(saved.kind) &&
        typeof saved.requestId === "string"
      )
        setPending(saved);
    } catch {
      /* Storage is optional; server receipts remain authoritative. */
    }
    fetch("/api/student/avatar/rewards", {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw Error(data.error);
        setReceipts(data.receipts);
        setReady(true);
      })
      .catch((e) => {
        if (e.name !== "AbortError")
          setError("Rewards couldn't load. Refresh the store to retry.");
      });
    return () => controller.abort();
  }, [key]);
  async function purchase(kind: StoreRewardKind) {
    if (inFlight.current || !beginPurchase()) return;
    inFlight.current = true;
    setError("");
    const intent = pending ?? { kind, requestId: crypto.randomUUID() };
    setPending(intent);
    try {
      sessionStorage.setItem(key, JSON.stringify(intent));
    } catch {}
    try {
      const response = await fetch("/api/student/avatar/rewards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(intent),
        signal: AbortSignal.timeout(15000),
      });
      const data = await response.json();
      if (!response.ok) {
        if (response.status >= 400 && response.status < 500) {
          setPending(null);
          try {
            sessionStorage.removeItem(key);
          } catch {}
        }
        throw Error(data.error ?? "Purchase failed.");
      }
      setPending(null);
      try {
        sessionStorage.removeItem(key);
      } catch {}
      setConfirm(null);
      setReceipts((old) => [
        data.receipt,
        ...old.filter((r) => r.id !== data.receipt.id),
      ]);
      if (data.state) onState(data.state);
      else
        setError(
          "Your reward is saved. Refresh the store to update your balance.",
        );
      setReveal(data.receipt);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Purchase couldn't be confirmed. Retry safely below.",
      );
    } finally {
      inFlight.current = false;
      endPurchase();
    }
  }
  return (
    <section aria-labelledby="store-special-heading" className="space-y-3">
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-amber-200">
          Spend your Academy Coins
        </p>
        <h2 id="store-special-heading" className="text-2xl font-black">
          Treasures & rewards
        </h2>
      </div>
      <div className={styles.offers}>
        <article className={styles.offer}>
          <Chest />
          <h3 className="text-xl font-black">
            Mystery Box <span className="text-amber-200">· 500 coins</span>
          </h3>
          <p className="my-3 text-sm text-slate-300">
            Win an unowned avatar item or a rare FREE class coupon! Higher-value
            prizes are rarer. Avatar items never repeat; class coupons stack.
          </p>
          <Button
            disabled={
              !ready ||
              disabled ||
              Boolean(pending) ||
              pool.length === 0 ||
              state.wallet.academyCoins < 500
            }
            onClick={() => setConfirm("mystery_box")}
          >
            {pool.length === 0
              ? "Collection complete"
              : state.wallet.academyCoins < 500
                ? "Need 500 coins"
                : "Buy Mystery Box"}
          </Button>
        </article>
        <article className={styles.offer}>
          <div className="mx-auto h-[200px] w-52">
            <FreeClassCouponArt />
          </div>
          <h3 className="text-xl font-black">
            Free Class <span className="text-amber-200">· 5,000 coins</span>
          </h3>
          <p className="my-3 text-sm text-slate-300">
            Get a FREE class coupon in your Trophy Case. Coupons stack. Coach
            Lem will arrange your class with you.
          </p>
          <Button
            disabled={
              !ready ||
              disabled ||
              Boolean(pending) ||
              state.wallet.academyCoins < 5000
            }
            onClick={() => setConfirm("free_class")}
          >
            {state.wallet.academyCoins < 5000
              ? "Need 5,000 coins"
              : "Get Free Class"}
          </Button>
        </article>
      </div>
      {confirm && !pending && (
        <div
          className="rounded-xl border border-amber-200/40 bg-amber-200/10 p-4"
          role="group"
          aria-label="Confirm reward purchase"
        >
          <p className="mb-3 font-bold">
            Spend {STORE_REWARD_PRICES[confirm].toLocaleString()} coins on{" "}
            {confirm === "free_class"
              ? "one Free Class coupon"
              : "one Mystery Box"}
            ?
          </p>
          <div className="flex gap-2">
            <Button disabled={disabled} onClick={() => void purchase(confirm)}>
              Confirm purchase
            </Button>
            <Button
              variant="secondary"
              disabled={disabled}
              onClick={() => setConfirm(null)}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm text-amber-200">
          {error}
        </p>
      )}
      {pending && (
        <div className="rounded-lg border border-amber-300/40 p-3">
          <p className="mb-2 text-sm">
            {disabled
              ? "Saving your purchase…"
              : "Your last purchase needs confirmation. Retry with the same reference—no double charge or reroll."}
          </p>
          <Button
            disabled={disabled}
            onClick={() => void purchase(pending.kind)}
          >
            Recover purchase
          </Button>
        </div>
      )}
      {receipts.length > 0 && (
        <details className="rounded-lg border border-white/10 p-3">
          <summary className="cursor-pointer text-sm font-bold">
            Your reward purchases
          </summary>
          <ul className="mt-3 max-h-56 space-y-2 overflow-auto text-sm">
            {receipts.map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-2"
              >
                <span>
                  {isFreeClassReward(r)
                    ? r.kind === "mystery_box"
                      ? "Mystery Box · FREE Class"
                      : "Free Class"
                    : r.item_snapshot?.name}{" "}
                  · {r.status} · {new Date(r.created_at).toLocaleDateString()}
                </span>
                {r.kind === "mystery_box" && (
                  <Button variant="ghost" onClick={() => setReveal(r)}>
                    View reward
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}
      {reveal && (
        <RewardOpening
          key={reveal.id}
          receipt={reveal}
          state={state}
          onClose={() => setReveal(null)}
          onEquip={onEquip}
        />
      )}
    </section>
  );
}
