# Feedback on `@somnia-chain/markets-sdk` and the Event Contracts docs

Notes from building **TOKO**, a consumer trading client on DreamDEX Event
Contracts, for the Somnia × DreamDEX hackathon. Everything below was measured on
Shannon testnet (chain 50312) rather than inferred, and each item says how to
reproduce it.

| | |
|---|---|
| SDK | `@somnia-chain/markets-sdk@0.28.1` |
| viem | `2.56.0` |
| Chain | `somniaShannon`, 50312 |
| Indexer | `https://dev.smk.somnia.host/v1/graphql` |
| Period | 2026-08-28 → 2026-08-31 |
| Exercised | real orders on all four order kinds, maker and taker, across three funded accounts — plus two-account mint-a-pair, redemption, and a keep-alive that requotes on being outbid |

The short version: **the protocol was consistently better than its
documentation.** Nothing on this list is a complaint about the contracts — the
oracle, the CLOB and the settlement path all did more than we expected. The
problems are in the address book, the defaults, and the places where a doc
describes a different product than the one you get.

Ordered by how much time each cost us. The appendix at the end carries the
reproductions — self-contained snippets that run against Shannon with nothing but
the SDK and viem, plus the transaction hashes behind each claim.

---

## 1. The shipped `marketCreatorFactory` is stale, and `getSystemInfo` knows it

**Impact: high.** This one sent us to a wrong conclusion and we published it
before catching it.

`SOMNIA_TESTNET_ADDRESSES.marketCreatorFactory` points at
`0xE6bEE93cE87c9E6e62aCb621caa7832EE47b4F6B`. We called `createMarketCreator` on
it three times from a funded key. All three reverted, consuming ~98 % of the gas
limit each time (7.88M of 8M, 29.5M of 30M, 2.95M of 3M) with no decodable
reason. We recorded "market creation is permissioned" and moved on.

That was wrong. **The factory is legacy.** Re-verified 2026-08-31:

```
listMarketCreators()          -> 6 creators
listLiveBinaryMarkets()       -> 25 live markets across 7 creators
overlap between the two sets  -> 0
```

Not one creator in the factory produces a live market, and not one creator
producing a live market is in the factory. Tracing the live creators' first
transactions, they were **deployed directly** — contract-creation bytecode from
two Somnia-side addresses, never a factory call.

The SDK's own `getSystemInfo()` already reports the drift:

```
factoryMismatch     true
clobFactory         0x1a478019Ae4d24249a962934af0f129CE98B5e6f   (reported)
addresses.clobFactory  0xb2BE8EE02F96379DB75f01802384593EBa9bfF04 (shipped)
```

**What would have helped, in order:**

1. Update `SOMNIA_TESTNET_ADDRESSES`, or drop `marketCreatorFactory` from it if
   there is no live factory. A constant that exists implies a path that works.
2. Make `factoryMismatch: true` **loud** — a console warning on client
   construction would have saved us a day. Today you only see it if you go
   looking for it.
3. Say in the docs whether venue creation is open, closed, or by request. "You
   cannot do this yet, email us" is a completely fine answer and much better
   than a revert.

**Why we care beyond the address:** our co-op feature rests an order inside the
spread, which puts it in direct competition with your market maker. On a venue
with nobody quoting, any resting order is at the front by definition. Own-venue
creation is the difference between our headline feature being reliable and being
a race. We would use it the day it exists.

---

## 2. The default gas limit makes a fresh wallet's first write fail

**Impact: high — it breaks exactly the onboarding path you most want to work.**

The SDK signs with `maxFeePerGas` 60 gwei and a default `gas` of **10,000,000**.
The node rejects a transaction unless `balance >= gasLimit × maxFeePerGas`, so
signing *anything* requires **0.6 STT of balance** regardless of the ~0.0015 STT
the transaction actually burns.

A wallet we sponsored with 0.5 STT therefore failed its **first ever write**. The
error surfaced as:

```
approve reverted: Missing or invalid parameters.
```

The underlying RPC error was a bare `-32000 insufficient balance`. Nothing in
that message points at the gas limit, the balance, or the fee.

It gets worse: this **only reproduces on a fresh account**. An account that has
already approved its pools skips the approve leg, so every test with a reused key
passes. We shipped a broken first-run path and did not find it until we probed
with a brand-new key on purpose.

Observed real usage is **253k–421k gas** for a taker order.

**Suggestions:** lower the default (2,000,000 is already generous), or estimate
it, or — cheapest fix — check `balance >= gasLimit × maxFeePerGas` before signing
and throw a message that names the actual requirement.

---

## 3. Maker orders cost ~3.4× taker orders, and running out of gas looks like a contract error

**Impact: high, because the failure is disguised.**

| Action | Gas used |
|---|---|
| IOC taker order | 253k – 795k |
| Taking a quote that minted a pair | 826,781 |
| Crossing a resting order | 1,121,268 |
| **Resting an order (maker)** | **2,659,719** |

A 2,000,000 ceiling on a maker order reverted at **1,969,851 used**, with no
revert data. We read that as a contract rejection and went looking for a
permission problem.

Two things make it hard to diagnose:

- `eth_call` replays the identical transaction **successfully**, because a call
  gets a generous gas allowance. Simulation says fine; the chain says revert.
- The SDK surfaced one of these as *"the receipt carried no
  `MarketCreatorCreated` event"* rather than as a revert.

**The tell we eventually learned:** `gasUsed / gasLimit ≈ 0.98` and unmoved when
you raise the ceiling means a gate; near 1.0 and *rising* with the ceiling means
you are simply out of gas. That heuristic belongs in your gotchas page.

**Suggestion:** either scale the default gas by order kind, or document these
figures. Note that headroom matters and usage does not predict it — our
successful maker order used 1.12M yet failed under a 2M ceiling.

---

## 4. `price` is always the YES price, on all four order kinds

**Impact: high — getting it backwards silently inverts every short.**

This is not in the docs and we found it in `writer.ts`:

```
BUY_YES    escrow = quantity × price
BUY_NO     escrow = quantity × (1 − price)
SELL_YES   escrow = quantity of the YES outcome token
SELL_NO    escrow = quantity of the NO  outcome token
```

So buying NO more aggressively means passing a **lower** number. To buy NO at an
effective 0.348 you pass `652000`. Confirmed on chain: a `BUY_NO` at 0.911 filled
at 0.923, debited exactly `1 × (1 − 0.923) = 0.077` tUSDC, and credited the NO
token id.

Nothing rejects an inverted short. It fills, at a price that is wrong in a
plausible direction — the worst possible failure mode for money.

**Related:** the YES price must stay strictly inside `(0, 1)` and on the tick
grid or the pool reverts `PriceOutOfBounds()`. This bites precisely where a
consumer app wants to trade — crossing aggressively on a near-certain side. NO at
0.998 is a YES price of 0.002, and stepping two ticks further to guarantee the
cross goes **negative**. Clamping to `[tick, 1 − tick]` should be in the SDK, not
in every client.

**Suggestion:** one paragraph in the order-placement docs, and clamping inside
`placeOrder`.

---

## 5. `OrderFill.quantityFilled`, not `.quantity`

**Impact: medium, but it looks like a protocol failure.**

`.quantity` exists on the fill object and is not what you filled. Reading it made
every executed order look like a miss — our first probe reported "no fill" on
three orders that had demonstrably traded, while the tUSDC balance moved by
exactly the sum of the three fills.

A field named `quantity` next to a field named `quantityFilled` will be read
wrong by everyone at least once. Consider a doc note, or a clearer name.

---

## 6. Indexer aggregates read zero on markets that traded

**Impact: medium — silently wrong data.**

All **329** sampled 1m markets reported `tradeCount: "0"` and zero
`cumulativeQuoteVolume`, while `getFills` on the same pools returned real fills
with real tx hashes.

Anyone building a volume chart, a "hot markets" list or a leaderboard off those
fields gets zeros and has no reason to suspect them. We had to treat fills as the
only truth.

---

## 7. Docs describe series that do not exist, and the live ones stop without notice

**Impact: medium — but it is the one that can kill a deployed app.**

The docs describe BTC and ETH on **15m and 1h**. When we started, Shannon was
running **1m, 5m, 1h, 4h and 24h**, and the 1m series was the busiest thing on
the network — 329 of the last 400 indexed markets. It is a much better product
than the docs advertise, and we built our core round on the 1-minute window
because of it.

Then, mid-project, **the 1m series stopped rolling.** The 5m series stopped a few
hours later. Watched live:

```
15:32:39  {"5m":7,"15m":6,"4h":2,"1h":4,"55m":1,"24h":2}   shortest 298s
15:35:58  {         "15m":6,"4h":2,"1h":4,"55m":1,"24h":2} shortest 899s
```

Today the live set is `{"5m":8,"1h":6,"15m":7,"4h":2,"24h":2}` across seven
creators, including one-off cadences (31s, 115s, 507s, 710s) that read like
someone else's experiments.

Six of our games had the window length hardcoded and would have sat on "finding a
window" forever. We now ask for *the shortest live window with enough runway* and
never name a duration — which is the right way to write it, and we would not have
known to without being bitten.

**Suggestions:** document which series are supported vs. experimental; give some
signal before a series is retired; and say plainly in the quickstart that a
client must discover cadences rather than assume them.

**Related read bug:** `listLiveBinaryMarkets()` and `listBinaryMarkets({limit})`
disagree — the first returned 22 live markets where a filtered pass over the
second found 18. The second is a bounded page of recent markets, so long-dated
windows fall off it. Worth a doc note that `listLiveBinaryMarkets` is the one for
"what can I trade right now".

---

## 8. Pools recycle across assets, not just across windows

**Impact: medium.** The docs warn that pools are reused between windows. They are
also reused **between assets**.

Twelve minutes apart, pool `0xc33484d0…` served a **BTC** 1m market and then an
**ETH** 1m market. One sampled market had `nonce: "72"` — that pool had already
served 72 markets.

Any client keying state, positions or UI by pool address will show a user someone
else's market. **Key by `marketId`.** This deserves to be stated more strongly
than it is, with the cross-asset case spelled out.

---

## 9. Order-reading APIs: one mandatory argument, and one silent empty

**Impact: medium.** Both of these are in the SDK and neither is in the docs.

- **`getAllOpenOrdersOnchain(pool, { isBid, limit })`** returns every resting
  order with `orderId`, `owner`, `userData`, `price`, `quantityRemaining` and
  `expireTimestampNs`. `isBid` is **mandatory** — omitting it throws
  `Invalid boolean value`. You must also read **both** values: a `BUY_YES` rests
  as a bid, while a `BUY_NO` is economically a YES ask and rests on the other
  side. We shipped a book that showed only half the resting orders before working
  this out.
- **`getOpenOrders` / `getOrders` / `countOrders` are owner-scoped, not
  pool-scoped.** Passing a pool address returns an **empty array**, not an error.
  A silent `[]` for a wrong-shaped argument is worse than a throw — it reads as
  "no orders" and you go looking for the bug in your own code.

This whole family is the most useful undocumented surface in the SDK. Our public
challenge board is built entirely on it, with no backend at all.

---

## 10. `userData` is forwarded verbatim — please document it, it is a feature

**Impact: low, and this is a compliment.**

`placeOrder` passes `userData` through untouched (the source calls it "opaque MM
bookkeeping"; your own maker uses `0/1/2` for ladder levels). We write a 64-bit
tag there — an ASCII marker plus a challenge id — and read it back off the book.

Verified on chain: posted `0x544f4b4f`, read back `1414482767`.

That single field is what makes our co-op mode possible **with no server**. A
challenge is not "any order that is not the maker's" — it is an order that says
what it is, publicly, on chain, enumerable by anyone. Combined with
`getAllOpenOrdersOnchain` it turns the order book itself into a shared
application database.

It is currently discoverable only by reading the SDK source. It should be a
documented, guaranteed-stable field with a note on the width and the convention
for avoiding collisions.

---

## 11. Order expiry: mandatory, nanoseconds, and rejected rather than clamped

**Impact: low, but each one is a wasted debugging hour.**

- `expireTimestampNs` is **mandatory** and in **nanoseconds**. Passing `0`
  reverts.
- An expiry past the market's own expiry reverts with a named
  `OrderExpiryBeyondMarket()` — it is **not** clamped. Any client computing
  "now + 4 hours" must cap against the market.
- Usefully, an order's expiry may be *shorter* than its market's, and it ages off
  on its own. We rely on this for a protocol-enforced escrow lifetime: an
  unclaimed challenge returns its collateral even if the user closes the tab,
  with nothing of ours running. Worth advertising — it is a real primitive.

---

## 12. Two documentation-structure problems

**The REST/WS docs describe the spot API, not event contracts.** The
`orderbook` / `ohlcv` / `trades` / `order` channel list at `api.dreamdex.io/v0`
has no event-contract endpoints, and the SDK does not use that API at all — it
hydrates from your Envio/Hasura indexer and materialises blocks from chain logs
over one WebSocket, sending writes via `realtime_sendRawTransaction`. We spent
real time building against the documented channel list before realising it was a
different product. A banner on those pages would fix it.

**"Session keys" means two different things.** The bot kit advertises "session
keys (hot keys without withdrawal permissions)". Somnia's *session transactions*
(`@somnia-chain/markets-sdk/native`) are a **signing convenience with no scoping
at all** — a session is a 32-byte seed, `sessionPrivateKey(seed)` derives the key
locally by a public deterministic rule, and there is no spending cap, no
withdrawal restriction and no allowlist. The SDK's own comment says it ships that
function to make it *"unmissable that whoever holds the seed holds this key"* —
which is admirably honest, and exactly the opposite of what the name implies to
someone shopping for a permission primitive. The scoped thing is the **Operators**
layer on MarketsCore, documented separately.

Also worth documenting: session transactions share a nonce space with
`eth_sendRawTransaction` from the same address, and sending both ways at once
corrupts the sequence.

---

## 13. Smaller things

- **`order.receipt` is `undefined`.** The receipt is at
  `(order.info as PlaceOrderResult).receipt`. Reading the wrong one silently
  disables every validation you wrote.
- **The indexer returns bigints**, so `JSON.stringify` throws. Every logging path
  needs a replacer. A note in the quickstart would save everyone the same five
  minutes.
- **`strike` reads `"0"` on some markets with status `Trading`.**
- **Internal paths are not in the exports map.** `@somnia-chain/markets-sdk/dist/*.js`
  fails to resolve, so there is no way to import the ABIs the SDK already has. We
  re-declared them locally with `parseAbi`. Exporting the ABIs would be welcome.
- **Read the order grid per pool.** Most pools report `(tickSize, minQuantity,
  lotSize) = (1000, 1000, 1000)`, but one indexed creator stamps
  `(1000, 1_000_000, 1_000_000)` — a 1.0-contract minimum instead of 0.001.
- **A taker order needs real slippage.** The round trip is ~3 s and a first trade
  adds an approve leg; a binary price late in its window moves further than that
  in the time it takes to land. A 2-tick cross reverts
  `ImmediateOrCancelNoFill`. 0.02 works.
- **The fast path is undocumented.** `placeOrder` does up to three pre-send reads
  (`poolTokens`, `marketExpiryNs`, an ERC-20 `allowance`). Pass `outcomeToken`,
  `yesId`, `noId`, `collateral` **and** `expireTimestampNs` explicitly and the hot
  path has zero pre-send round-trips. That is most of the measured 2.5–3.0 s.

---

## What worked, and is worth knowing you got right

We would not have built this product on another venue, so it is worth being
specific about why.

- **The oracle is instant.** Across 327 resolved 1-minute markets, resolve
  latency after expiry was **0 s at min, p50, p90 and max**, with a **0 % void
  rate**. The answer lands in the expiry block. No keeper, no cron, nothing to
  operate. Our entire core loop — a whole window is one round, entered any time,
  settled for real at the end — exists *because* of this. On any other chain we
  would have had to invent a settlement story.
  (Polling `getMarketOnchain` observes `isResolved` ~3.3 s after expiry, which is
  what a UI actually feels. Both numbers are true and both are worth publishing.)
- **Redemption pays exactly `1.000000` per winning contract**, verified twice on
  chain, via a single `trader.redeem({ marketId, amount, outcomeIdx })` that
  finalizes if needed.
- **Mint-a-pair is the best primitive here and it is underexplained.** Two
  opposite *buyers* crossing produces `kind = MINT_A_PAIR` — no seller, no market
  maker, no inventory. Verified: two accounts, 0.500 each, one pair minted,
  tx `0x89714738…`. This is the answer to cold-start liquidity and it should be
  on the front page of the docs, not discovered in a fill enum. Our entire
  player-versus-player mode is built on it.
- **`getPortfolio(address)` is exactly the right shape.** Positions with their
  full market context, open orders and trades with `fillPrice`, `txHash`, `side`,
  `asMaker` and the counterparty — history, open positions and realized P&L from
  one call.
- **Zero fees, no rate limits, and bots explicitly welcome.** Rare, and it made
  measuring all of the above possible.
- **Entry works far later than we expected** — a fill confirmed **2.16 s** before
  a window closed, with no timing revert at any offset. The real cutoff is a
  liquidity effect (the maker withdraws quotes in the last ~2 s), not a protocol
  limit.
- **Gas is a non-issue.** ~0.004 STT per transaction: 1 STT ≈ 250 trades.

---

## The one ask

Everything above is fixable in docs or defaults except **§1**. A public path to
create a venue — or a documented request process — is the single change that
would most improve what we can build. Our co-op mode competes with your market
maker for front-of-book because it has to rest inside the spread on your venue;
on a venue of our own, every challenge reaches the person it was sent to.

Happy to walk through any of this with you.

---

# Appendix — reproducing everything above

Self-contained. Every snippet below runs on its own against Shannon with nothing
but the SDK and viem installed; none of them depend on our application code.

```bash
npm i @somnia-chain/markets-sdk@0.28.1 viem@2.56.0
node --experimental-strip-types <file>     # Node 22
```

## A. The client

Worth stating because two of these are easy to get wrong: `priceFeed` is **not**
defaulted, and the addresses constant carries more than the public docs list
(`binaryPoolImpl`, `clobFactory`, `marketCreator`, `marketCreatorFactory`,
`testUsdc`, and a `lend` bundle).

```js
import {
  SomniaMarkets,
  SOMNIA_TESTNET_ADDRESSES,
  SOMNIA_TESTNET_PRICE_FEED,
} from "@somnia-chain/markets-sdk";
import { somniaShannon } from "@somnia-chain/markets-sdk/chains";

const ex = new SomniaMarkets({
  indexerUrl: "https://dev.smk.somnia.host/v1/graphql",
  chain: somniaShannon,                      // id 50312
  wsRpcUrl: "wss://api.infra.testnet.somnia.network/ws",
  addresses: SOMNIA_TESTNET_ADDRESSES,
  priceFeed: SOMNIA_TESTNET_PRICE_FEED,
  privateKey,                                // omit for read-only
});
```

Collateral on Shannon is **tUSDC at `0x70a86D8842FB63C4Ad2b7cdddF530eBf1BB25d8E`,
6 decimals** — 10^12 away from mainnet USDso, so read `decimals()` rather than
hardcoding.

## B. §1 — the factory has no live creators

This is the whole finding, in fifteen lines. It printed the numbers quoted in §1
on 2026-08-31:

```js
const info = await ex.client.getSystemInfo();
console.log("factoryMismatch", info.factoryMismatch);           // true
console.log("reported clobFactory", info.clobFactory);          // 0x1a478019…
console.log("shipped  clobFactory", SOMNIA_TESTNET_ADDRESSES.clobFactory); // 0xb2BE8EE0…

const inFactory = await ex.client.listMarketCreators();          // 6
const live = await ex.client.listLiveBinaryMarkets();            // 25

const facSet  = new Set(inFactory.map((c) => c.id.toLowerCase()));
const liveSet = new Set(live.map((m) => m.creator.toLowerCase())); // 7 distinct

console.log("overlap", [...liveSet].filter((a) => facSet.has(a)).length); // 0
```

Note `c.id`, not `c.address` — the creator object has no `address` field.

The three reverting writes were `createMarketCreator` against
`SOMNIA_TESTNET_ADDRESSES.marketCreatorFactory`
(`0xE6bEE93cE87c9E6e62aCb621caa7832EE47b4F6B`) from a funded key, at gas ceilings
of 8M, 30M and 3M — consuming 7.88M, 29.5M and 2.95M respectively.

To confirm the live creators were deployed directly rather than through any
factory, take any address from `liveSet` and fetch its first transaction from the
explorer: each is a contract creation (`to: null`) sent by one of two Somnia-side
EOAs, `0xe7eb5d2b…` or `0xf685c124…`. The second of those is also what
`getSystemInfo().marketCreator.owner` reports.

## C. §2 — the balance a signature requires

The arithmetic, which is the entire bug:

```
default gas         10,000,000
maxFeePerGas        60 gwei
required balance    10,000,000 × 60e-9 STT = 0.6 STT
actual burn         ~0.0015 STT
```

To reproduce, fund a **brand-new** address with 0.5 STT and place any order. It
fails on the approve leg with `approve reverted: Missing or invalid parameters.`
(underlying: `-32000 insufficient balance`). Fund a second new address with 1 STT
and the identical code succeeds. Reusing a key that has already approved its
pools hides the bug completely, which is why it survives normal testing.

The fix on our side was one option:

```js
const trader = ex.client.createTrader({
  privateKey,
  decimals: 6,
  gas: 2_000_000n,   // without this the 10M default demands 0.6 STT to sign
});
```

## D. §3 — telling out-of-gas from a revert

Read the ratio off the receipt before believing anything:

```js
const { receipt } = order.info;                 // NOT order.receipt — see §13
console.log(Number(receipt.gasUsed) / Number(gasLimit));
```

- `≈0.98`, and **unchanged** when you raise the ceiling → a gate inside the
  contract.
- `≈0.98`, and it **rises** with the ceiling → you are out of gas.

The maker order that failed reported `gasUsed 1,969,851` against a 2,000,000
ceiling; at 8,000,000 the same order succeeded using 2,659,719. `eth_call`
replayed both successfully throughout, because a call gets its own allowance.

## E. §4 — the YES-price convention

Both sides quote one book, so a NO bid of `q` is a YES ask of `1 − q`. Place a
`BUY_NO` and check what is actually debited:

```js
await trader.placeOrder({
  pool,
  side: "BUY_NO",
  price: 652_000n,       // YES terms → an effective NO price of 0.348
  quantity: 1_000_000n,  // 1.000 contract, 6-decimal grid
  orderType: "IOC",
  expireTimestampNs,
});
```

Observed: a `BUY_NO` sent at YES `0.911` filled at YES `0.923`, debited exactly
`1 × (1 − 0.923) = 0.077000` tUSDC, and credited `+1.000000` on the **NO** token
id. Sending a *higher* number makes a short **less** aggressive.

Outcome token ids encode as `(pool << 72) | (nonce << 8) | idx`, with idx 0 = YES
and 1 = NO, on the ERC-6909 singleton
`0xB52c5934113Af5c0Bb20eb3C72290C8215f755b9`.

## F. §7 — watching the series change

Poll the live set and print it by interval. Ours ran for hours; the transition
quoted in §7 took three minutes:

```js
setInterval(async () => {
  const live = await ex.client.listLiveBinaryMarkets();
  const byInterval = {};
  for (const m of live) byInterval[m.interval] = (byInterval[m.interval] ?? 0) + 1;
  const shortest = Math.min(...live.map((m) => Number(m.expiry) - Date.now() / 1000));
  console.log(new Date().toISOString(), JSON.stringify(byInterval), Math.round(shortest));
}, 30_000);
```

The same loop shows the read discrepancy: compare `live.length` against a
filtered pass over `listBinaryMarkets({ limit: 300 })` and the second comes up
short, because it is a bounded page of *recent* markets and long-dated windows
fall off the end.

## G. §9 — reading the whole book of resting orders

```js
for (const isBid of [true, false]) {
  const orders = await ex.client.getAllOpenOrdersOnchain(pool, { isBid, limit: 100 });
  for (const o of orders)
    console.log(isBid ? "bid" : "ask", o.orderId, o.owner, o.price,
                o.quantityRemaining, o.userData, o.expireTimestampNs);
}
```

Omitting `isBid` throws `Invalid boolean value`. Reading only `true` shows you
every `BUY_YES` and no `BUY_NO`, which is half the resting interest — this is how
we shipped a half-empty book.

By contrast `getOpenOrders(pool)` returns `[]` rather than throwing, because that
family is owner-scoped. Nothing tells you the argument was the wrong kind of
address.

## H. §10 — the `userData` round trip

```js
const TAG = 0x544f4b4fn;                      // "TOKO"
await trader.placeOrder({ /* … */ userData: (TAG << 32n) | BigInt(id) });
```

Read back through the call in §G: posted `0x544f4b4f`, returned as
`1414482767`. On that pool there were 4 resting bids, of which 1 carried the tag
— which is exactly what makes a public challenge board possible with no server.
The venue's own maker writes `0`, `1` and `2` here for its ladder levels.

## I. §11 — order expiry

```js
const marketExpiryNs = BigInt(market.expiry) * 1_000_000_000n;
const wanted = BigInt(Date.now()) * 1_000_000n + 30n * 60n * 1_000_000_000n; // +30 min
const expireTimestampNs = wanted > marketExpiryNs ? marketExpiryNs : wanted;  // must cap
```

Uncapped, the pool reverts `OrderExpiryBeyondMarket()`. Passing `0` also reverts.
A *shorter* expiry works and is genuinely useful: an order posted with a
60-second lifetime inside a window with 286 seconds left read back as `expires in
58s` and aged off on its own, returning its escrow with nothing of ours running.

## J. §6 and the settlement numbers

The latency and void figures come from a sweep over resolved markets, comparing
each market's own timestamps — no wall clock involved:

```js
const past = await ex.client.listBinaryMarkets({ status: "Finalized", limit: 400 });
const oneMin = past.filter((m) => Number(m.intervalSec) === 60);
// 329 markets. For each: resolvedAt − expiry === 0 across all of them,
// min = p50 = p90 = max = 0s, voided = 0.
```

Two caveats we would publish if we were you, because both are true:

- That 0 s is a **block-timestamp** delta — the resolution lands in the expiry
  block. Polling `getMarketOnchain(marketId)` observes `isResolved` about **3.3 s**
  after expiry, which is what a user actually feels.
- Every one of those 329 markets also reports `tradeCount: "0"` and zero
  `cumulativeQuoteVolume`, while `getFills(pool, { limit })` on the same pools
  returns real fills with real tx hashes (§6). Use fills.

## K. Transactions

Full hashes for the claims that assert one. All on Shannon (50312):

| What | Hash |
|---|---|
| Entry: 1.000000 YES @ 0.649 on an ETH 1m window, 8.4 s before expiry | `0xecf14b36117107f1b8e0e65255cd9e5524fd2184a604241a4fad30e1adcf2660` |
| Redemption of that position, paid exactly `+1.000000` tUSDC | `0x3f21fe9fde0aa1fd55cc43f200047b88fa20ed444df2d14328674dc1cfe89d03` |
| Second redemption — a BTC position bought at 0.341, also exactly `+1.000000` | `0x877e0fe203a7772f0addf3a9d4a349c294f5856b9407bb5958d832081e571d8d` |

The mint-a-pair fill in *What worked* was produced from two funded accounts and
read back through `getFills(pool, { limit })` as:

```
kind   MINT_A_PAIR        price  0.500
maker  BUY_YES  1.000     taker  BUY_NO  1.000
after: maker holds 1.000 YES / 0 NO;  taker holds 0 YES / 1.000 NO
```

To reproduce it: rest a `BUY_YES` at 0.500 from one key, then send a `BUY_NO` at
a YES price of 0.497 or lower from a second key. Both escrow exactly 0.500000
tUSDC, the pool mints the pair, and no seller or market maker is involved in the
trade at all.

One caution if you rebuild that test: a resting order **cannot be addressed**.
The pool matches by price-time priority, so the second order crosses the best bid
on that side, not necessarily the one you just posted. Measured twice — a
challenge rested at 0.500 while the maker bid 0.781/0.772/0.763 was untouched and
the accepter crossed the maker at 0.649; another rested at 0.697 was outbid at
0.699 within three minutes. Post inside the spread and check you are at the front
immediately before the second order goes out.
