# How to play TOKO

Eight trading games and two arcade ones, all on the same handheld console. This
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

| Control | What it does |
|---|---|
| **Big key** (bottom right) | the main action — PLAY, TAKE, PRESS, CASH OUT. The label always says |
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
2. **Knob** — `MKT`, `2x`, `3x`, `5x`, `10x`. `MKT` takes whatever the market is
   offering right now; the others say "only fill me at this price or better".
3. **Number wheel** — 1, 2, 5, 10 or 25 contracts.
4. **PLAY**.

Then wait. When the window closes the oracle settles it, and a winning contract
pays $1 each, straight to your balance.

While the round is live the big key becomes **CASH OUT** — sell back at whatever
the book is bidding, instead of waiting. Usually worth less than holding; occasionally
worth taking.

> **"Nobody on the other side"** means your order found no seller at your price.
> Not an error — thin markets are normal here. Try `MKT`, or wait for the next
> window.

## Moonshot — Lucky's deep end

The same game with a different knob: `5x`, `10x`, `25x`, `50x`, `100x`.

You are buying the side the market has nearly written off. Most of these expire
worthless. That is the deal — a few cents for a real shot at a hundred times it,
priced by the market rather than invented by us.

Best late in a window, when one side is trading at two or three cents because the
outcome looks decided. It occasionally is not.

## Snipe — one button, one moment

No side to choose, no size to set. The screen shows a **wall**: the underdog's
real offer, sliding toward zero as the window runs down. The longer you wait, the
bigger the multiple.

Press **TAKE** to buy it.

The catch is real. In the last couple of seconds the market maker withdraws its
quotes entirely, and there is nothing left to take. Wait too long and the screen
says so. This is the one game that is purely about timing.

## Rush — deal or no deal

Press **ANTE UP** to buy in. Now you hold a position, and the screen shows **the
deal**: what the order book will actually pay you for it right now.

- **TAKE THE DEAL** — sell now, bank whatever it is worth.
- **Do nothing** — hold to the buzzer and collect the full $1 if you are right.

There is no PUSH button, deliberately. Pushing *is* declining the deal, so a key
for it would be a control that does nothing.

The deal moves as the market does. Early on it is close to what you paid; if the
price runs your way it climbs toward $1, and if it runs against you it drains
toward nothing.

## Press — the ladder

A rung is one round. Win it and the payout becomes the stake for the next one, so
the multiple compounds. Lose a rung and the ladder ends there.

1. **LONG** or **SHORT**, then **START**.
2. Win the rung and the console offers **PRESS** or **FOLD**.
   - **PRESS** — roll everything into the next window.
   - **FOLD** — stop and keep it.

You choose a side fresh on every rung. It never rolls by itself, because every
rung spends real money.

## Breakout — the ladder, one direction

Press with the side locked to whatever you chose at the start. You are calling a
move to keep going, window after window, rather than betting each one
independently.

Same PRESS / FOLD, same compounding, less choice — which is the point.

## Pin — name your price and wait

The first game where you are the one making the offer.

1. **Knob** — how far from the market you are calling: `0.40`, `0.30`, `0.20`,
   `0.10`, `0.05`. Further out pays more.
2. **LONG** or **SHORT**, then **PIN IT**.

Your bid goes **onto the real order book** and sits there. It fills only if the
market comes to your price. The screen shows how far it still has to travel.

If it fills, you are in the round at your price. If the window closes first,
nothing happens and your money comes straight back.

> Playing Pin *is* providing liquidity. Your resting bid is real depth that
> anyone can trade against — which is exactly what this venue is short of.

## Duel — play against a person

A challenge that is a real order, not a message.

1. **Knob** — the odds you are offering, priced inside the live spread.
2. **Number wheel** — how long the offer stands: `5m`, `30m`, `1h`, `4h`.
3. **LONG** or **SHORT**, then **CHALLENGE**.
4. **SHARE** — send the link to anyone.

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
| *Nobody on the other side* | no seller at your price — normal on a thin book |
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
