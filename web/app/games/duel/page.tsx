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
import { useRouter } from "next/navigation";
import { useProgramConsole } from "@/lib/console/controls";
import { useRound, useNow, type Side } from "@/lib/games/useRound";
import * as coop from "@/lib/dreamdex/coop";
import * as wallet from "@/lib/dreamdex/wallet";
import { fromRaw } from "@/lib/dreamdex/config";
import * as demo from "@/lib/demo";
import { useToast } from "@/components/ui/Toast";
import { useUser } from "@/lib/api/hooks";
import PriceChart from "@/components/screen/PriceChart";
import {
  Footer,
  Fx,
  GhostCount,
  Header,
  Notice,
  Payoff,
  Shell,
  Splash,
  Stage,
  StageReadout,
  Tile,
  TileRow,
} from "@/components/screen/GameScreen";
import { useSpot } from "@/lib/api/hooks";
import { formatPrice } from "@/lib/api/math";
import * as markets from "@/lib/dreamdex/markets";

const STEPS = 5;
const SIZE = 1;
/**
 * Enough runway that a fresh offer is never posted into a window already inside
 * its roll lead, which is a quarter of the window.
 */
const ROLL_FLOOR_S = 90;

export default function DuelPage() {
  const router = useRouter();
  const demoing = useSyncExternalStore(
    demo.subscribe,
    demo.isActive,
    () => false,
  );
  const [escrowIdx, setEscrowIdx] = useState(0);
  const escrow = coop.ESCROW_OPTIONS[escrowIdx];
  /**
   * Play the shortest window with runway, regardless of how long the offer
   * stands, and let the offer roll forward into successive windows.
   *
   * Picking a window that outlasts the offer was the obvious reading, but it
   * meant a 30-minute offer landed on a 24h window — settling hours after it was
   * taken, and priced wherever that window happened to be, which is often nearly
   * decided (a duel offered at $0.99 to win $1.00 is not a duel). A short window
   * keeps settlement minutes away and the odds near the middle.
   *
   * The floor keeps it out of a window already inside its roll lead, where the
   * price has stopped meaning anything.
   */
  const round = useRound(null, ROLL_FLOOR_S);
  const spot = useSpot(round.window?.asset ?? "BTC");
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
          handle: user.handle,
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
  //
  // Every dependency here is a primitive on purpose. `round` is a fresh object
  // each render and `round.window` is rebuilt by the market poller every few
  // seconds, so depending on either restarts the watcher constantly — and since
  // starting it publishes to a store this component subscribes to, that is an
  // infinite render loop, not just churn.
  const marketId = round.window?.marketId;
  const restingOrderId = round.restingOrderId;
  const roundSide = round.side;
  const resetRound = round.reset;

  useEffect(() => {
    if (!posted || !marketId || restingOrderId == null || posted_ == null) return;
    if (challengeId == null || budget == null) return;
    return coop.keepAlive({
      marketId,
      side: roundSide ?? side,
      orderId: restingOrderId,
      yesPrice: posted_,
      size: SIZE,
      escrowSecs: escrow.secs,
      maxCost: coop.costOf(roundSide ?? side, budget),
      challengeId,
      // A callback from an external system is where a reset belongs.
      onFinish: (status) => {
        if (status === "expired" || status === "pricedOut") resetRound();
      },
    });
  }, [
    posted,
    marketId,
    restingOrderId,
    roundSide,
    resetRound,
    posted_,
    budget,
    side,
    escrow,
    challengeId,
  ]);

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
    main: demoing
      ? {
          label: "SET UP",
          pulse: true,
          onPress: () => {
            demo.end();
            router.push("/");
          },
        }
      : live
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
    lightShow: round.status === "settling" || settled,
  });

  // A duel is two real orders crossing each other. A paper bid has nothing to
  // cross with and no order for anyone to find, so this is the one game that
  // cannot be demoed — it says so rather than pretending.
  if (demoing) {
    return (
      <Shell>
        <Notice
          title="Duel needs a wallet"
          body="A duel is your real order crossing somebody else's. A pretend one has nothing to cross with, and no order for anyone to find."
          hint="Setting one up takes seconds"
        />
      </Shell>
    );
  }

  const chart = (
    <>
      <PriceChart
        bare
        asset={round.window?.asset ?? "BTC"}
        entry={
          round.window?.strike != null
            ? markets.strikePrice(round.window.strike)
            : null
        }
      />
      <Fx />
    </>
  );

  const header = (
    <Header
      eyebrow={`Duel · ${round.window?.asset ?? "—"}`}
      value={spot > 0 ? `$${formatPrice(spot)}` : "—"}
      rightLabel="Available"
      rightValue={`$${wallet.formatCollateral(round.balance)}`}
      rightNote={
        round.window ? `Ends in ${round.secsLeft.toFixed(0)}s` : undefined
      }
    />
  );

  if (settled) {
    const won = round.status === "won";
    const net =
      round.payout != null && round.entryCost != null
        ? fromRaw(round.payout - round.entryCost)
        : null;
    return (
      <Shell>
        {header}
        <Stage>
          {chart}
          <Splash
            won={won}
            value={
              net == null
                ? "—"
                : `${net >= 0 ? "+" : "−"}$${Math.abs(net).toFixed(2)}`
            }
          />
        </Stage>
        <Footer>
          <div className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-text-3">
            {round.status === "void"
              ? "Voided"
              : won
                ? "You won it"
                : "They won it"}
          </div>
        </Footer>
      </Shell>
    );
  }

  if (round.status === "settling") {
    return (
      <Shell>
        {header}
        <Stage>
          {chart}
          <GhostCount>0</GhostCount>
        </Stage>
        <Footer>
          <div className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-text-3">
            Window closed
          </div>
        </Footer>
      </Shell>
    );
  }

  // ── Somebody took it — the duel is on ────────────────────────────────────
  if (live && round.window) {
    return (
      <Shell>
        {header}
        <TileRow cols={2}>
          <Tile
            label="Paid"
            value={
              round.entryCost != null
                ? `$${fromRaw(round.entryCost).toFixed(2)}`
                : "—"
            }
          />
          <Tile
            label="Pays"
            value={`$${fromRaw(round.held).toFixed(2)}`}
            tone="up"
          />
        </TileRow>
        <Stage>
          {chart}
          <GhostCount>{round.secsLeft.toFixed(0)}</GhostCount>
          <StageReadout
            label={round.filledOnArrival ? "Filled on arrival" : "Challenge taken"}
          >
            <span className="tnum text-[30px] font-extrabold leading-none text-up">
              {round.side === "up" ? "UP" : "DOWN"}
            </span>
          </StageReadout>
        </Stage>
        <Footer>
          <div className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-text-3">
            {round.filledOnArrival
              ? "the book moved · you took the market, not a challenger"
              : "the duel is on · riding to the buzzer"}
          </div>
        </Footer>
      </Shell>
    );
  }

  // ── Posted, waiting for someone to take the other side ───────────────────
  if (posted && round.window) {
    return (
      <Shell>
        {header}
        <TileRow cols={3}>
          <Tile
            label="You paid"
            value={postedCost == null ? "—" : `$${postedCost.toFixed(2)}`}
          />
          <Tile
            label="They pay"
            value={postedCost == null ? "—" : `$${(1 - postedCost).toFixed(2)}`}
          />
          <Tile
            label="Expires"
            value={
              postedAt == null
                ? escrow.label
                : `${Math.max(0, Math.ceil((postedAt + escrow.secs * 1000 - now) / 1000))}s`
            }
          />
        </TileRow>
        <Stage>
          {chart}
          <GhostCount>{round.secsLeft.toFixed(0)}</GhostCount>
          <StageReadout label="Challenge is live">
            <span className="tnum text-[30px] font-extrabold leading-none text-brand-500">
              SHARE IT
            </span>
          </StageReadout>
        </Stage>
        <Footer>
          <div className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-text-3">
            {keep.reposts > 0
              ? `moved to the front ${keep.reposts}x · anyone can take it`
              : "on the public board · anyone can take it"}
          </div>
          <div className="tnum mt-0.5 text-[15px] font-extrabold text-text">
            {budget == null
              ? "—"
              : `$${coop.costOf(round.side ?? side, budget).toFixed(2)}`}
            <span className="ml-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-text-3">
              chase budget
            </span>
          </div>
        </Footer>
      </Shell>
    );
  }

  return (
    <Shell>
      {header}
      <TileRow cols={3}>
        <Tile
          label="You pay"
          value={myCost == null ? "—" : `$${myCost.toFixed(2)}`}
        />
        <Tile
          label="They pay"
          value={theirCost == null ? "—" : `$${theirCost.toFixed(2)}`}
        />
        <Tile label="Stands" value={escrow.label} />
      </TileRow>
      <Stage>{chart}</Stage>
      <Footer>
        <Payoff
          label={
            myCost == null
              ? "No price inside the spread"
              : `${side === "up" ? "Long" : "Short"} · $${myCost.toFixed(2)} → $${SIZE.toFixed(2)}`
          }
          value={myCost == null ? "—" : `${(1 / myCost).toFixed(2)}x`}
        />
        <div className="mt-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-text-3">
          {round.message
            ? round.message
            : finished
              ? keep.message

            : !round.window
              ? "finding a fresh window"
              : round.balance === 0n
                ? "fund your wallet"
                : price == null
                  ? round.book.yesBids.length || round.book.yesAsks.length
                    ? "spread too tight to post inside"
                    : "waiting for the book"
                  : "first in line · listed for anyone"}
      </div>
    </Footer>
    </Shell>
  );
}
