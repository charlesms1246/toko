"use client";

/**
 * Duel — challenge someone to the other side of a real window.
 *
 * You post a resting bid at the odds you want and share a link. Whoever opens it
 * buys the opposite outcome, and because a buyer of Up crossing a buyer of Down
 * makes the pool **mint a fresh pair**, the two of you trade with each other
 * directly — no seller, no market maker, no inventory on either side. That is
 * the one venue property that lets two strangers open a market between them on a
 * book nobody else is standing in.
 *
 * You choose how long the offer stands — 5m, 30m, 1h, 4h. That is the order's
 * own expiry rather than a series, so a duration the venue has no series for is
 * still real, and an unclaimed offer ages off **by protocol** and returns its
 * escrow whether or not anything of ours is running. The window is then whichever
 * live one outlasts the offer.
 *
 * Once posted the offer looks after itself. A challenge does not die of old age,
 * it dies of going **stale**: the book moves, somebody outbids it, and from
 * behind the queue it can never fill. So it is moved back to the front when that
 * happens — never above the price you first agreed to pay, and when the market
 * passes that, the offer stops and the escrow comes back.
 *
 * Two honest constraints shape the screen, both measured on chain:
 *
 * - **The price has to sit inside the spread.** A pool matches by price-time
 *   priority, so a challenge behind the market maker's bids never reaches the
 *   person you sent it to — their order crosses the maker instead. So the knob
 *   moves between the best bid and the best ask, where the challenge is first in
 *   line. That means posting a duel *is* posting the best bid on the book.
 * - **Your bid is public.** Being at the front is exactly what lets a stranger
 *   take it too. The screen says who took it rather than pretending otherwise.
 */

import { useEffect, useState, useSyncExternalStore } from "react";
import { useProgramConsole } from "@/lib/console/controls";
import {
  BigNumber,
  ScreenBar,
  ScreenHeader,
  ScreenRoot,
  ScreenRow,
} from "@/components/screen/Screen";
import { useMinuteRound, useNow, type Side } from "@/lib/games/useMinuteRound";
import * as coop from "@/lib/dreamdex/coop";
import * as book from "@/lib/dreamdex/book";
import * as wallet from "@/lib/dreamdex/wallet";
import { useToast } from "@/components/ui/Toast";
import { useUser } from "@/lib/api/hooks";

const STEPS = 5;
const SIZE = 1;

export default function DuelPage() {
  const [escrowIdx, setEscrowIdx] = useState(0);
  const escrow = coop.ESCROW_OPTIONS[escrowIdx];
  // The window has to outlast the offer, whichever series that turns out to be.
  const round = useMinuteRound(null, escrow.secs);
  const toast = useToast();
  const user = useUser();
  const [priceIdx, setPriceIdx] = useState(2);
  const [side, setSide] = useState<Side>("up");
  /** When the offer was posted, for the half-time revert. */
  const [postedAt, setPostedAt] = useState<number | null>(null);
  const now = useNow(500);
  /** The price actually posted. The live ladder keeps moving; this must not. */
  const [posted_, setPosted] = useState<number | null>(null);
  /** The dearest price the knob was offering when posted — the chase budget. */
  const [budget, setBudget] = useState<number | null>(null);
  /** Stable identity for this challenge, carried on chain in `userData`. */
  const [challengeId, setChallengeId] = useState<number | null>(null);
  const me = useSyncExternalStore(
    wallet.subscribe,
    wallet.getSnapshot,
    wallet.getServerSnapshot,
  );

  /**
   * Prices that put the challenge at the front of the book, read live. Going
   * up the ladder offers your friend a better deal and costs you more.
   */
  const ladder = coop.priceLadder(round.book, STEPS);
  const price = ladder.length ? ladder[Math.min(priceIdx, ladder.length - 1)] : null;
  /** Your price in your own side's terms — a short's cost is 1 − the YES price. */
  const myCost = price == null ? null : side === "up" ? price : 1 - price;
  const theirCost = myCost == null ? null : 1 - myCost;

  // The watcher's state is the screen's — read, not copied into local state,
  // which is what the React Compiler's set-state-in-effect rule is about.
  const keep = useSyncExternalStore(
    coop.subscribeKeepAlive,
    coop.getKeepAlive,
    coop.getKeepAliveServer,
  );
  const finished = keep.status === "expired" || keep.status === "pricedOut";

  /** What the offer costs *now* — it is re-priced each time it moves. */
  const livePrice = keep.status === "live" && keep.yesPrice > 0 ? keep.yesPrice : posted_;
  const postedCost =
    livePrice == null ? null : coop.costOf(round.side ?? side, livePrice);

  const settled = ["won", "lost", "void"].includes(round.status);
  const posted = round.status === "resting";
  const live = round.status === "open";

  const challenge: coop.Challenge | null =
    posted && round.window && challengeId != null && round.side && me.address
      ? {
          // The link names the challenge, not the order — both the order and the
          // window change as the offer moves itself.
          id: challengeId,
          from: me.address,
          side: round.side,
          yesPrice: posted_ ?? 0,
          size: SIZE,
          marketId: round.window.marketId,
          handle: user.username,
        }
      : null;

  const post = (s: Side) => {
    setSide(s);
    if (!round.canEnter || price == null) return;
    const id = coop.newChallengeId();
    setChallengeId(id);
    setPosted(price);
    setBudget(coop.budgetPrice(round.book, s));
    setPostedAt(Date.now());
    coop.clearKeepAlive();
    // `price` is the YES price whichever side is bought, so it is sent as-is;
    // going *down* the ladder makes a short more aggressive, not less.
    round.rest(s, price, SIZE, {
      expireNs: BigInt(Math.floor(Date.now() / 1000) + escrow.secs) * 1_000_000_000n,
      userData: coop.packTag(id),
    });
  };

  // Keep the offer takeable while it stands. This watcher lives outside React so
  // it survives leaving the screen; the order's own on-chain expiry is the
  // backstop if the tab is closed entirely.
  useEffect(() => {
    if (
      !posted ||
      !round.window ||
      round.restingOrderId == null ||
      posted_ == null ||
      challengeId == null
    ) {
      return;
    }
    return coop.keepAlive({
      window: round.window,
      side: round.side ?? side,
      orderId: round.restingOrderId,
      yesPrice: posted_,
      size: SIZE,
      escrowSecs: escrow.secs,
      maxCost: coop.costOf(round.side ?? side, budget ?? posted_),
      challengeId,
      // A callback from an external system is where a reset belongs.
      onFinish: (status) => {
        if (status === "expired" || status === "pricedOut") round.reset();
      },
    });
  }, [posted, round, posted_, budget, side, escrow, challengeId]);

  const share = async () => {
    if (!challenge) return;
    const url = coop.linkFor(challenge);
    try {
      if (navigator.share) await navigator.share({ url, title: "Take my side" });
      else {
        await navigator.clipboard.writeText(url);
        toast("Challenge link copied", "win");
      }
    } catch {
      // The share sheet was dismissed — nothing to report.
    }
  };

  useProgramConsole({
    main: live
      ? { label: "RIDING", disabled: true }
      : posted
        ? { label: "SHARE", pulse: true, onPress: () => void share() }
        : {
            label: round.status === "pending" ? "…" : "CHALLENGE",
            loading: round.status === "pending",
            disabled: !round.canEnter || price == null,
            onPress: () => post(side),
          },
    action1: {
      label: "LONG",
      pulse: !live && !posted && side === "up",
      disabled: live || posted || round.status === "pending",
      onPress: () => post("up"),
    },
    action2: {
      label: "SHORT",
      pulse: !live && !posted && side === "down",
      disabled: live || posted || round.status === "pending",
      onPress: () => post("down"),
    },
    knob: {
      min: 0,
      max: Math.max(0, ladder.length - 1),
      step: 1,
      value: Math.min(priceIdx, Math.max(0, ladder.length - 1)),
      label: "ODDS",
      format: (v) => {
        const p = ladder[v];
        if (p == null) return "—";
        return `${(1 / (side === "up" ? p : 1 - p)).toFixed(2)}x`;
      },
      onChange: (v) => !live && !posted && setPriceIdx(v),
    },
    numberWheel: {
      min: 0,
      max: coop.ESCROW_OPTIONS.length - 1,
      step: 1,
      value: escrowIdx,
      label: "OFFER",
      format: (v) => coop.ESCROW_OPTIONS[v].label,
      onChange: (v) => !live && !posted && setEscrowIdx(v),
    },
    status: {
      left: round.window
        ? `${round.window.asset} ${round.secsLeft.toFixed(0)}s`
        : "DUEL",
      right: `$${wallet.formatCollateral(round.balance)}`,
    },
    lightShow: round.status === "settling" || settled,
  });

  if (settled) {
    const won = round.status === "won";
    const net =
      round.payout != null && round.entryCost != null
        ? Number(round.payout - round.entryCost) / 1e6
        : null;
    return (
      <ScreenRoot className="items-center justify-center gap-1">
        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-text-3">
          {round.status === "void" ? "Voided" : won ? "You won it" : "They won it"}
        </div>
        <BigNumber
          value={net == null ? "—" : `${net >= 0 ? "+" : "−"}$${Math.abs(net).toFixed(2)}`}
          tone={won ? "up" : "down"}
        />
      </ScreenRoot>
    );
  }

  if (round.status === "settling") {
    return (
      <ScreenRoot className="items-center justify-center gap-2">
        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-text-3">
          Window closed
        </div>
        <BigNumber value="…" tone="brand" />
      </ScreenRoot>
    );
  }

  // ── Somebody took it — the duel is on ────────────────────────────────────
  if (live && round.window) {
    return (
      <ScreenRoot className="gap-1.5">
        <ScreenHeader
          left={`${round.window.asset} ${round.side === "up" ? "UP" : "DOWN"}`}
          right={`${round.secsLeft.toFixed(0)}s`}
        />
        <div className="text-center text-[10px] font-bold uppercase tracking-[0.2em] text-up">
          {round.filledOnArrival ? "Filled on arrival" : "Challenge taken"}
        </div>
        <BigNumber value={`$${(Number(round.held) / 1e6).toFixed(2)}`} tone="up" />
        <ScreenRow
          label="Paid"
          value={
            round.entryCost != null
              ? `$${(Number(round.entryCost) / 1e6).toFixed(2)}`
              : "—"
          }
        />
        <ScreenBar
          progress={
            round.window.intervalSec
              ? 1 - round.secsLeft / round.window.intervalSec
              : 0
          }
        />
        {round.filledOnArrival && (
          <div className="text-center text-[10px] font-semibold uppercase tracking-widest text-text-3">
            the book moved · you took the market, not a challenger
          </div>
        )}
      </ScreenRoot>
    );
  }

  // ── Posted, waiting for someone to take the other side ───────────────────
  if (posted && round.window) {
    return (
      <ScreenRoot className="gap-1.5">
        <ScreenHeader
          left={`${round.window.asset} ${round.side === "up" ? "UP" : "DOWN"}`}
          right={`${round.secsLeft.toFixed(0)}s`}
        />
        <div className="text-center text-[10px] font-bold uppercase tracking-[0.2em] text-text-3">
          Challenge is live
        </div>
        <BigNumber value="SHARE IT" tone="brand" />
        <ScreenRow
          label="You paid"
          value={postedCost == null ? "—" : `$${postedCost.toFixed(2)}`}
        />
        <ScreenRow
          label="They pay"
          value={postedCost == null ? "—" : `$${(1 - postedCost).toFixed(2)}`}
        />
        <ScreenRow
          label="Chase up to"
          value={
            budget == null
              ? "—"
              : `$${coop.costOf(round.side ?? side, budget).toFixed(2)}`
          }
        />
        <ScreenRow
          label="Offer expires in"
          value={
            postedAt == null
              ? escrow.label
              : `${Math.max(0, Math.ceil((postedAt + escrow.secs * 1000 - now) / 1000))}s`
          }
        />
        <ScreenBar
          progress={
            postedAt == null ? 0 : Math.min(1, (now - postedAt) / (escrow.secs * 1000))
          }
        />
        <div className="text-center text-[10px] font-semibold uppercase tracking-widest text-text-3">
          {keep.reposts > 0
            ? `moved to the front ${keep.reposts}x · anyone can take it`
            : "on the public board · anyone can take it"}
        </div>
      </ScreenRoot>
    );
  }

  const ask = book.best(side === "up" ? round.book.yesAsks : round.book.noAsks);

  return (
    <ScreenRoot className="gap-2">
      <ScreenHeader
        left="Duel"
        right={round.window ? `${round.secsLeft.toFixed(0)}s` : "—"}
      />
      <div className="text-center text-[10px] font-bold uppercase tracking-[0.2em] text-text-3">
        Your side pays
      </div>
      <BigNumber
        value={myCost == null ? "—" : `${(1 / myCost).toFixed(2)}x`}
        tone="brand"
      />

      <ScreenRow
        label="You pay"
        value={myCost == null ? "—" : `$${myCost.toFixed(2)}`}
      />
      <ScreenRow
        label="They pay"
        value={theirCost == null ? "—" : `$${theirCost.toFixed(2)}`}
      />
      <ScreenRow
        label="Offer stands"
        value={
          round.window
            ? `${escrow.label} · settles in ${Math.round(round.secsLeft / 60)}m`
            : escrow.label
        }
      />
      <ScreenRow
        label={side === "up" ? "Market up" : "Market down"}
        value={ask ? ask.price.toFixed(3) : "—"}
      />

      <div className="text-center text-[10px] font-semibold uppercase tracking-widest text-text-3">
        {round.message
          ? round.message
          : finished
            ? keep.message
            : !round.window
              ? `finding a window that outlasts ${escrow.label}`
              : round.balance === 0n
                ? "fund your wallet"
                : price == null
                  ? "spread too tight to post inside"
                  : "first in line · listed for anyone"}
      </div>
    </ScreenRoot>
  );
}
