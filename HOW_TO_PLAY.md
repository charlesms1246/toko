# How to play TOKO

Four trading games and two arcade ones, all on the same handheld console. This
explains the one idea behind all of them, then each game in turn.

If you want to start right now: open the app, tap **Try it first**, and go to
**Lucky**. Everything below will make more sense after one round.

---

## The one idea

Every trading game buys the same thing: a **binary contract** on whether an
asset finishes a time window **up or down** from where it started.

A contract pays exactly **$1 if you are right** and **$0 if you are wrong**. So
its price is just the market's estimate of your odds:

| You pay | The market thinks | You win | That is |
|---|---|---|---|
| $0.50 | coin flip | $1.00 | **2x** |
| $0.33 | you are the underdog | $1.00 | **3x** |
| $0.10 | you are a long shot | $1.00 | **10x** |
| $0.02 | almost certainly wrong | $1.00 | **50x** |

![Four contracts as bars. Pay $0.50 on a coin flip and win $1.00 — that is 2x.
Pay $0.33 as the underdog for 3x, $0.10 as a long shot for 10x, $0.02 when the
market thinks you are almost certainly wrong for 50x. Every one of them pays the
same $1.00 if you are right.](docs/diagrams/play-payout.svg)

**The payout knob is really a price.** Asking for 10x is asking to pay 10 cents.
That is why a big multiple is not generous — it is the market telling you it does
not fancy your chances. Nobody sets these numbers; they come off a live order
book, and if nobody is selling at your price, nothing happens.

Two consequences worth knowing before you press anything:

- **You cannot lose more than you paid.** There is no leverage and no
  liquidation. Buy a contract for $0.30 and $0.30 is the whole risk.
- **A round ends when the window ends.** The console always plays the shortest
  window on offer and a new one opens as the last closes. How long that is
  depends on what the venue is running — often a minute or five, sometimes
  longer — and the countdown on screen is always the real one.

---

## The console

You are holding a device, not filling in a form. Every game uses the same
hardware:

![The console, labelled: the screen and its status strip showing asset, seconds
left and balance; the big key bottom right for the main action; LONG and SHORT
below it; the ridged knob on the right for the payout you are asking for; the
number wheel for how many contracts; and MENU and HOME along the
bottom.](docs/diagrams/play-console.svg)

| Control | What it does |
|---|---|
| **Big key** (bottom right) | the main action — play, take, press, cash out. It carries the TOKO mark rather than a word; what it will do right now is on the screen above it |
| **LONG** (left key) | pick the **up** side |
| **SHORT** (right key) | pick the **down** side |
| **Knob** (gold dial) | the payout you are asking for — drag it up or down |
| **Number wheel** | how many contracts to buy |
| **MENU / HOME** | always navigate, whatever the game is doing |

On a keyboard: **Enter** or **Space** is the big key, **↑** is LONG, **↓** is
SHORT, **Esc** opens the menu.

The strip along the bottom is the asset, the seconds left in the window, and your
balance.

---

## Before you play

**Demo Mode** — tap *Try it first* on the opening screen. You get $100 of pretend
money and everything else is real: real markets, real prices, real settlement.
Your fills are priced against the actual order book, so a demo win is a win you
would really have had. It is labelled at the top of every screen and lasts as
long as you like.

**A real wallet** — tap *START* instead. One is created in your browser, we pay
the gas, and you get **500 tUSDC** to play with, plus **100 more each week** from
the wallet screen. It is testnet money; it costs nothing and is worth nothing.

---

# The trading games

## Lucky — the place to start

One window, one round. Pick a side, pick a payout, press.

1. **LONG** or **SHORT** — is the price going up or down by the end of the window?
2. **Knob** — `MKT`, `2x`, `3x`, `5x`, `10x`, `25x`, `50x`, `100x`. `MKT` takes
   whatever the market is offering right now; the others say "only fill me at
   this price or better".
3. **Number wheel** — 1, 2, 5, 10 or 25 contracts.
4. **Press the big key.**

Then wait. When the window closes the oracle settles it, and a winning contract
pays $1 each, straight to your balance.

The knob is one ladder from the market price out to the deep tail, and the far
end is a different game in feel. Ask for `50x` and you are buying the side the
market has nearly written off, for two cents. Most of those expire worthless.
That is the deal, and it is best late in a window, when one side is trading at
two or three cents because the outcome looks decided. It occasionally is not.

**While the round is live, the screen shows the deal** — what the order book
will actually pay for your position right now. Take it and bank whatever it is
worth, or ignore it and hold to the buzzer for the full $1 if you are right. The
deal moves as the market does. Early on it is close to what you paid; if the
price runs your way it climbs toward $1, and if it runs against you it drains
toward nothing. There is no separate key for holding, because holding *is*
declining the deal.

> **"Nobody on the other side"** means your order found no seller at your price.
> Not an error — thin markets are normal here. The console then offers to
> **rest** the same bid instead: it goes onto the real order book and sits
> there, and it fills only if the market comes to your price. If the window
> closes first, nothing happens and your money comes straight back. Resting a
> bid *is* providing liquidity, which is exactly what this venue is short of.
> `MKT` is the one rung that cannot rest, because it has no price of its own.

## Snipe — one button, one moment

No side to choose, no size to set. The screen shows a **wall**: the underdog's
real offer, sliding toward zero as the window runs down. The longer you wait, the
bigger the multiple.

Press **TAKE** to buy it.

![Snipe over one window: the underdog's offer starts around 34 cents and slides
toward zero as the window runs down, so the multiple grows from 3x to 6x to 20x
the longer you wait. In the last seconds the market maker pulls its quotes and
there is nothing left to take.](docs/diagrams/play-snipe.svg)

The catch is real. In the last couple of seconds the market maker withdraws its
quotes entirely, and there is nothing left to take. Wait too long and the screen
says so. This is the one game that is purely about timing.

## Press — the ladder

A rung is one round. Win it and the payout becomes the stake for the next one, so
the multiple compounds. Lose a rung and the ladder ends there.

1. **LONG** or **SHORT**, then **START**.
2. Win the rung and the console offers **PRESS** or **FOLD**.
   - **PRESS** — roll everything into the next window.
   - **FOLD** — stop and keep it.

![The ladder: $1 at stake on rung one, and pressing a win carries $2 to rung
two, $4 to rung three, $8 to rung four. Folding at any rung stops and keeps it.
Losing a rung ends the ladder there.](docs/diagrams/play-ladder.svg)

You choose a side fresh on every rung. It never rolls by itself, because every
rung spends real money — and a cleared rung waits for you rather than timing
out, so stepping away does not cost you what you have banked. When the ladder
ends, either way, the big key starts a new one.

## Duel — play against a person

A challenge that is a real order, not a message.

1. **Knob** — the odds you are offering, priced inside the live spread.
2. **Number wheel** — how long the offer stands: `5m`, `30m`, `1h`, `4h`.
3. **LONG** or **SHORT**, then **CHALLENGE**.
4. **SHARE** — send the link to anyone.

![A duel: you pick a side, the odds, and how long the offer stands — 5m, 30m, 1h
or 4h. Share the link or leave it on the board at Menu → Open duels, where anyone
can take it. When someone does, they take the opposite side at the odds you
offered, and you are on opposite sides of one window until it
closes.](docs/diagrams/play-duel.svg)

Whoever opens it takes the opposite side, and the two of you trade **with each
other**: the pool mints a fresh pair of contracts, one for each of you, with no
seller and no market maker involved.

Your challenge also appears on the public board at **Menu → Open duels**, where
anyone can take it. That is not a leak — a challenge is a real public order, and
being takeable is what makes it real.

While it waits, the console keeps it competitive: if someone outbids you it moves
your offer back to the front, up to a budget, and when the market runs past that
budget it stops and returns your money. When the window closes it carries the
offer into the next one, so a long offer does not mean a long wait to settle.

**Duel needs a real wallet.** It cannot be played in demo, because a pretend
order has nothing for a real person to trade against.

---

# The arcade games

Free, no wallet, no stakes. They exist because a console should have something to
do between rounds.

**Line Rider** — hold a line through the terrain. The big key is **DIVE**.

**Flappy Piper** — the big key is **FLAP**. You know this one.

Both keep a personal best on your own device. There is no global leaderboard —
there is no server to hold one, and a fake one would be worse than none.

---

# Reading the console

**Status strip** — asset, seconds left in the window, your balance.

**Common messages**

| It says | It means |
|---|---|
| *Finding a window* | between rounds; the next one opens shortly |
| *Nobody on the other side* | no seller at your price — normal on a thin book. Rest the bid instead, or take `MKT` |
| *Too late — quotes pulled* | inside the last seconds, the market maker has gone |
| *Window closed* | waiting on the oracle, a few seconds |
| *Voided* | no reliable settlement price; both sides get half back |

**Where things live**

- **Menu → Positions** — everything you hold, and a Claim button for anything
  settled and unclaimed.
- **Menu → Open duels** — every live challenge, from anyone.
- **Menu → Live windows** — the raw markets and their order books.
- **Menu → History** — your settled rounds.
- **Menu → Wallet** — balances, your weekly 100 tUSDC, and your private key.

---

## A few honest warnings

- **Markets here are thin.** Some presses will find nobody. The console says so
  rather than pretending.
- **Late in a window prices go extreme** — one side at 2¢, the other at 98¢ —
  because the outcome is nearly decided. Both prices are real.
- **Your wallet lives in this browser.** Clearing site data destroys it. Export
  the key from the wallet screen if you want to keep the address. It holds
  testnet funds only — never send anything real to it.
- **Nothing here is investment advice**, and none of it is real money.
