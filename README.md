# TOKO

A handheld trading console that trades **real DreamDEX Event Contracts on
Somnia**. You pick a side and a price, the price *is* your multiple, and one
live window is one round — entered, settled by the oracle the moment it expires,
and paid out at exactly 1 tUSDC per winning contract.

Nothing on screen is simulated. Every price, book, countdown, fill, settlement
and payout comes from Shannon testnet. The single exception is **Demo Mode**,
which lets someone play before they have a wallet, is labelled everywhere, and
is described honestly below.

```bash
cd web
npm install
npm run dev        # http://localhost:3000
```

With no configuration at all you can play **Demo Mode** immediately — live
markets, real settlement, hypothetical fills. Funding a real wallet needs one
secret; see Configuration.

---

## Trying it in sixty seconds

1. Open `http://localhost:3000`.
2. **"Try it first"** — no wallet, no signup, no configuration. You are trading
   a live BTC window against the real book within seconds.
3. Play `/games/lucky`. Hold to expiry and the real oracle settles it.

**START** instead does the same thing for real: a wallet is generated in your
browser, gas is sponsored from the treasury, and **500 tUSDC** is minted to you.
That path needs `TREASURY_PRIVATE_KEY` set. Without it the app says so and points
at Somnia's public faucets rather than pretending to fund you.

---

## Configuration

Everything needed to *play* is already in the code — chain, contracts, indexer
and price feed all come from the SDK's deployment manifest. The only secret is
the gas sponsor.

Create `web/.env` (gitignored):

```bash
# Pays the gas for new players. Server-side only — never NEXT_PUBLIC_.
# A browser holding this key could be drained from devtools.
TREASURY_PRIVATE_KEY=0x...

# Only for the verification scripts below. The app never reads it.
PRIVATE_KEY=0x...
```

Fund the treasury with testnet STT from [the Somnia faucet
bot](https://t.me/somnia_helper_bot) (50 STT / 24h, no group join) or [Google
Cloud's](https://cloud.google.com/application/web3/faucet/somnia/shannon)
(1 STT / day). A transaction costs about **0.004 STT**, so 1 STT is roughly 250
trades.

**Node 22.** Next 16 wants 20.9+, and the verification scripts below need 22 for
native TypeScript stripping.

---

## What it trades

[DreamDEX Event Contracts](https://dreamdex.io): binary Up/Down markets on an
on-chain CLOB. A contract's price *is* its implied probability, so the payout is
exactly `1 / price`, and winners redeem 1 collateral unit. Zero fees.

That one fact is what lets the console survive intact: **the payout knob became a
limit price** and still reads as a multiple. 2x is 0.50, 3x is 0.33, 10x is 0.10.
`ConsoleControls` never changed.

Measured on Shannon rather than taken from the docs (`claude-docs/TESTNET_FACTS.md`):

| | |
|---|---|
| Oracle resolve latency | **0 s** across 327 windows, **0 %** voided |
| Latest confirmed entry | **2.16 s** before expiry; the limit is liquidity, not the protocol |
| Order round trip | 2.5–3.0 s including the receipt |
| Redemption | exactly **1.000000 tUSDC** per winning contract |

**The venue's series are not fixed, and the console does not assume they are.**
Shannon ran 1-minute windows for months — the docs describe only 15m and 1h —
and then stopped rolling them; the 5-minute series stopped shortly after, while
new venues appeared running their own cadences (including 31s, 115s and 507s
one-offs). So every game asks for **the shortest live window with enough
runway** rather than naming a duration. A minute is the ideal and the round is
designed around it, but a game pinned to `60` simply stops finding a market the
day the venue moves on.

---

## The games

All eight trade live windows. None of them are reskins of a house model.

| Game | What it actually does |
|---|---|
| **Lucky** | The Round. One window is one round — the shortest live one; the knob is a limit price shown as its multiple |
| **Moonshot** | Same instrument in the deep tail. Late in a window one side really does trade at 2–12 ¢ |
| **Snipe** | The wall is the underdog's real offer sliding toward zero. Wait too long and the maker pulls its quotes |
| **Rush** | The banker is the book — the live bid on your position is the deal. Take it or hold to settlement |
| **Press** | A roll ladder: a win's payout stakes the next window. Press or fold |
| **Breakout** | The same ladder with the side locked — a call on the move continuing |
| **Pin** | **Maker.** Rests a bid at your called price; playing it *is* providing liquidity |
| **Duel** | **Co-op.** Your challenge is a resting order. Whoever takes it buys the opposite side and the pool **mints a pair** — two buyers, no seller, no market maker |

Plus two free minigames, which were always real; only their global leaderboard
was fake, and that is gone.

**Range was retired.** A band needs two strikes at one expiry and this venue has
one. It is not hidden behind a flag — it is deleted.

### Duel, and why it is the interesting one

A challenge is not a database row. It is a real bid inside the spread, tagged on
chain in the order's `userData`, listed publicly at `/menu/duels` for anyone to
take. Mint-a-pair means the two of you trade with each other on a book nobody
else is standing in — verified on chain as `kind = MINT_A_PAIR`, two buyers,
0.500 each, one pair minted.

It also taught the sharpest lesson in the project: **a resting order cannot be
addressed.** The pool matches by price-time priority, so whoever accepts crosses
the *best* bid on that side, not the one your link names. A challenge is only a
duel if it is at the front of the book — which means posting one is posting the
best bid, and playing the game is providing liquidity, not merely adjacent to it.

---

## Demo Mode

The one place this app is allowed to be hypothetical, and it exists so someone
can hold the console before they have a wallet.

**Real:** the live order book at real depth, real windows and countdowns, the
real oracle feed, and **real settlement** — a paper position wins or loses on the
same oracle result as everyone else's.

**Hypothetical:** only your own fills, and they are priced by walking the
*actual* book level by level, exactly as an IOC would. They pay real depth's
prices, get worse as they eat through levels, partially fill when depth runs out,
and fail when nobody is there. A paper fill can never beat the book. A demo that
flatters you teaches expectations the real product then breaks.

It is labelled on every screen, never claims anything happened on chain, and
ends the moment you fund a wallet. Anything that genuinely cannot be demoed —
Duel, and anything reading your own chain state — says so and offers setup
rather than faking it.

---

## Funding

- **Gas is sponsored.** There is no paymaster on Somnia and session transactions
  need a pre-funded account anyway, so the treasury tops up the embedded wallet
  directly. We know the address because we generated it.
- **500 tUSDC at signup, 100 a week after**, minted by the collateral contract's
  own faucet from your wallet. The cadence is a **schedule, not a lock** — that
  faucet will mint anyone any amount, so nothing here could enforce scarcity on
  a testnet. It shapes how starting out feels; it is not a security boundary.

---

## Layout

Everything below is under `web/`.

```
app/
  page.tsx                attract mode
  games/                  8 trading games + 2 minigames
  menu/                   wallet, positions, markets, duels, history, …
  c/[code]/               taking a duel challenge
  api/topup/              gas sponsorship (server-side treasury key)
  api/activity/           explorer proxy for the transactions screen

lib/dreamdex/             the integration
  config      chain, contracts, gas ceilings, grant sizes
  wallet      the Wallet seam + embedded browser key
  markets     live windows, on-chain status, rollover
  book        the four ladders, implied probability, multiples
  orders      buy / sell / rest / cancel, grid snapping, ns expiry
  positions portfolio redeem      ERC-6909 holdings, classification, claims
  coop        challenges: the public board, keep-alive, accepting
  execution   the Executor seam — the one object Demo Mode swaps
  stats achievements leaderboard activity

lib/games/                useRound, useRollLadder
lib/demo.ts               the paper ledger
components/console/       the three.js device
```

### Two architectural facts worth knowing before editing

**The screen is DOM under a transparent canvas.** A React subtree sits
*underneath* the canvas; each frame the canvas projects the screen cutout to
screen space and writes its rect onto the surface element. Missed taps are
forwarded down with `elementFromPoint`. Anything solid behind the shell would
show through the screen hole, which is why the back shell is hidden and the metal
side band is a frame rather than a plate.

**`ConsoleControls` is the contract.** Routes do not draw buttons; they call
`useProgramConsole({ main, action1, action2, knob, numberWheel, status,
lightShow })` and the 3D console reflects it. Handlers route through a ref so a
control can never fire a stale closure. MENU and HOME are hardware — they always
navigate, whatever the page asks.

```tsx
useProgramConsole({
  main: { label: "CASH OUT", pulse: true, onPress: round.sell },
  action1: { label: "LONG", onPress: () => round.buy("up", price, 1) },
  knob: { min: 0, max: 4, step: 1, value: i,
          format: (v) => `${(1 / PRICES[v]).toFixed(1)}x`, onChange: setI },
  status: { left: "LUCKY", right: `$${formatCollateral(balance)}` },
  lightShow: settled,
});
```

---

## Verifying it yourself

Everything claimed above was measured, and the scripts are here. They import the
app's **own modules** rather than reimplementing the calls, so they exercise the
code the console runs.

All of these run from `web/`.

```bash
# Read-only recon: live windows, grids, books, oracle, settlement stats
node --experimental-strip-types scripts/doctor.mts

# A full round: buy, hold to expiry, redeem
node --env-file=.env --import ./scripts/ts-imports.mjs \
     --experimental-strip-types scripts/probe-settle.mts

# A fresh wallet's first trade — the path a reused key hides
node --env-file=.env --import ./scripts/ts-imports.mjs \
     --experimental-strip-types scripts/probe-first-trade.mts

# Co-op: post a challenge, then take it from a second account (ACCEPT_KEY)
MODE=post   ... scripts/probe-coop.mts
MODE=accept ... scripts/probe-coop.mts
```

Checks:

```bash
npm run build
npx tsc --noEmit                    # needs one build first, for .next/types
npx tsc -p scripts/tsconfig.json
npx eslint .                        # `next build` does NOT run eslint
```

---

## Known limits

Stated plainly, because a README that only lists strengths is not much use.

- **Testnet only.** The wallet is a burner generated in the browser and kept in
  `localStorage`; it is fine for testnet STT and tUSDC and unacceptable for
  anything else. `wallet.ts` is the seam a managed wallet drops into.
- **We cannot run our own venue, and the reason is not what it first looked
  like.** `createMarketCreator` on the factory the SDK ships does revert for our
  key. But that factory is **legacy**: it holds 6 creators, none of which produce
  a single live market. Every creator actually running markets was **deployed
  directly** by one of two Somnia-side addresses, never minted through a
  factory — and Somnia's own `getSystemInfo` reports `factoryMismatch: true`.
  So this is not a permission check we failed; there is no public creation path
  in the live system at all. A venue is an ask, not a code change.
- **Duels compete with that maker.** A challenge rests inside a ~3 ¢ spread while
  the maker re-quotes far faster, so many are taken quickly or priced out. The
  keep-alive re-posts to the front within a budget and then stops.
- **Depth is thin and moves between venues.** The maker that quoted the 1m book
  is not necessarily quoting whichever series is live now, so a press can come
  back "nobody on the other side" — an IOC that finds nothing *reverts* here, and
  the console reports that as the normal outcome it is. It remembers which
  windows turned it away and prefers others, but it cannot conjure a
  counterparty.
- **Referral counts are wallets, not revenue.** The number is real: we pay for
  every new player's first gas, so the sponsorship route records the code they
  arrived with and counts the wallets it funded. There is no earnings figure,
  because there are no referral earnings.

More detail lives in `claude-docs/` — `TESTNET_FACTS.md` for every measurement
and the traps behind it, `INTEGRATION_PLAN.md` for why each decision went the way
it did, `ERRORS.md` for the bugs that are easy to reintroduce.
