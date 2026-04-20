# The Foundry — UI Redesign Spec (v2)

**Date:** 2026-04-20
**Author:** Menua (with Claude)
**Status:** Awaiting user approval before implementation
**Branch:** `week-2-foundry`
**Trigger:** User feedback that the v1 UI is "6/10 concept, 3.5/10 visual execution, 4/10 judge-wow" and will not win the hackathon in its current state.

---

## 1. What the v1 got wrong (root causes)

| Symptom (user verbatim) | Root cause |
|---|---|
| "too much empty space" | Uniform 3-col grid + giant hero + empty gallery = 60% dead pixels above the fold |
| "hero is too weak" | Filled orange button dominates; screams "click here for demo", not "authoritative product" |
| "cards look like dev cards" | Inline-styled divs with hex colors and emoji-free text; no typographic identity |
| "no proof" | Zero live counters, no ticker, no event stream, no visible aliveness |
| "price feels toy-like" | `$0.50 USDC` on the button face reads as cheap; premium products put price in metadata, not CTA |
| "not yet polished enough to win" | Generic sans-serif stack (ui-sans-serif) + no distinctive typographic choice = reads as "system default" |

The underlying issue: **the v1 UI communicates the concept in words but fails to embody it in the interface**. The Foundry's central claim is *living economic entities*. On-screen: nothing is living. Nothing is moving. Nothing feels economic.

## 2. Design direction — committed

**"Editorial Specimen"** — a hybrid of three references:

1. **Natural History Museum placards** (cream specimen cards, Roman-numeral dates, serif display, reverent treatment of individual entries)
2. **Bloomberg / FT terminal** (mono data ticker, dense running counters, no-nonsense financial presentation)
3. **Monocle / Kinfolk magazine** (confident hierarchy, restrained color, generous line-height, serif body, mono captions)

One-sentence articulation: *"If Monocle magazine covered an AI stock exchange, this is what it would look like."*

Explicitly rejected directions and why:
- **Neon cyberpunk** — fights the "serious product" pitch; looks like every other crypto hackathon demo
- **Glassmorphism / frosted-blur** — 2021 aesthetic, signals "AI-generated landing page"
- **Gradient maximalism** — undermines the calm/comfort the user asked for
- **Pure brutalist** — too abrasive for a consumer-adjacent product; loses the "comfort" axis

## 3. Design tokens

### 3.1 Palette

All values chosen to read as *pigment*, not neon. No pure black, no pure white, no saturation above ~70%.

```css
:root {
  /* Grounds */
  --bg-0: #0b0b0c;       /* main background, warm-tinted near-black */
  --bg-1: #131312;       /* raised panels */
  --bg-2: #1a1a18;       /* second raised layer (use sparingly) */

  /* Ink */
  --ink-0: #efece4;      /* primary text, warm cream */
  --ink-1: #a8a39a;      /* secondary */
  --ink-2: #6a665c;      /* tertiary / metadata */

  /* Structure */
  --rule: #26231f;       /* hairline dividers */
  --rule-strong: #3a362f;/* emphasized dividers */

  /* Accents */
  --forge: #e5562b;      /* primary accent, muted forge-orange */
  --forge-dim: #8a3318;  /* hover/pressed state for forge */
  --mint: #3fb48f;       /* alive status, forest-mint */
  --blood: #a83d3d;      /* dead status, brick */
  --slate: #5289d9;      /* MCP / Claude integration */
  --gold: #c89b3c;       /* rare, reserved for reproduction events */

  /* Specimen */
  --paper: #f6f1e4;      /* business detail card cream */
  --paper-ink: #1a1714;  /* text on paper */
  --paper-ink-2: #5c5649;/* metadata on paper */
  --paper-rule: #d7cfbd; /* rules on paper */
}
```

### 3.2 Typography

Loaded via `next/font/google`:

- **Fraunces** (variable, SOFT axis 30, opsz axis 72 for display): Display headlines, business names, section labels.
- **IBM Plex Serif** (400, 400 italic, 500, 600): Body prose, descriptions, genome quotes.
- **IBM Plex Mono** (400, 500): All numbers, wallet addresses, timestamps, code, UI metadata.

**No sans-serif.** This is the single most important typographic decision. Every sans-serif feels like SaaS-default to a design-literate viewer. Pure serif + mono feels like a publication.

Scale (modular, ratio ≈ 1.333):
```
text-xs     12px  / 1.4
text-sm     14px  / 1.5
text-base   16px  / 1.6
text-lg     19px  / 1.55
text-xl     24px  / 1.3
text-2xl    32px  / 1.2
text-3xl    44px  / 1.1
text-4xl    60px  / 1.05
text-5xl    82px  / 1.0
text-display 112px / 0.95   /* hero headline only */
```

Letter-spacing:
- Headlines: `-0.025em` (tight)
- Small caps labels: `+0.12em` (wide)
- Body: default
- Mono: default

### 3.3 Spacing

Based on an 8px grid with two half-stops (4px, 6px) for fine kerning.

```
4, 6, 8, 12, 16, 24, 32, 48, 64, 96, 128, 192
```

Page gutters: 24px mobile / 48px tablet / 96px desktop (generous, magazine-like).
Card interior padding: 32px.
Between gallery rows: 64px vertical, 32px horizontal.

### 3.4 Motion

Principle: **motion reveals function, never decorates.**

- Ticker tape scroll: 60s linear infinite, pauses on hover.
- Status dot: `animation: breath 4s ease-in-out infinite` (opacity 0.4 → 1.0) for `alive`. Static for others.
- Sparkline draw-in on first mount: 600ms `stroke-dashoffset` animation, easing `cubic-bezier(0.2, 0.6, 0.2, 1)`.
- Event stream new-item: fade-in from above 250ms + hairline flash bottom border 600ms.
- Hero headline load: 80ms stagger per word (not per letter — more confident), 500ms fade + 8px translate.
- Card hover: arrow glyph shifts 4px right over 200ms. No shadow change, no scale.

**Explicitly forbidden:** parallax, tilt, gradient shifts, cursor-followers, glitch, confetti, scroll-triggered zooming, page-transition blurs, "magic ink" underlines.

## 4. Layout architecture

### 4.1 Every-page chrome

```
┌────────────────────────────────────────────────────────────┐
│ ▪ LIVE · 17 breathing                      22 April 2026    │  ← 44px status bar
├────────────────────────────────────────────────────────────┤
│ ← Biz#042 +$0.08 · Biz#017 ♥ · Biz#028 REVIVED · Biz#003 † │  ← 44px ticker tape
├────────────────────────────────────────────────────────────┤
│                                                              │
│    [page content]                                            │
│                                                              │
├────────────────────────────────────────────────────────────┤
│ THE FOUNDRY · MMXXVI · agent-zero-foundry on BuildWithLocus │  ← 56px footer
└────────────────────────────────────────────────────────────┘
```

Status bar: `bg-0`, `ink-2` text, `rule` bottom border. Left: status (live/maintenance). Right: current date in long form.

Ticker tape: `bg-1`, `rule` top+bottom borders, 44px tall. Single row of `text-sm` mono events. Sequential with middle-dot separators. Auto-scroll CSS-only.

Footer: `bg-0`, `rule` top border, small-caps wide-tracked Plex Serif label.

### 4.2 Landing (`/`)

Above the fold, after the chrome:

```
──────────────────────────────────────────────────────────────

  No. 001                                         MMXXVI

  A factory
  that gives birth
  to AI.

  The Foundry takes one sentence and returns a live AI
  business on BuildWithLocus — its own USDC wallet, its
  own MCP endpoint, its own pulse. When it cannot pay
  for hosting, it dies. Some reproduce first.

  ── COMMISSION A BUSINESS  →
     Fee: 0.50 USDC, settled on Base

──────────────────────────────────────────────────────────────

     THE BALANCE SHEET

     17           $47.21           3             1
     ALIVE        TOTAL USDC       BORN TODAY    DEAD TODAY

     2            ————             59.3%         14s
     REPRODUCED   REVIVED          SURVIVAL 7D   LAST PULSE

──────────────────────────────────────────────────────────────
```

**Proportions:**
- Page left/right gutters: 96px desktop
- Headline `text-display` (112px), Fraunces Soft=30, tight tracking
- No filled buttons anywhere. Primary CTA is `text-lg` underlined link with forge-orange right-arrow.
- Balance sheet strip: 6 metrics, `text-3xl` mono values above `text-xs` wide-tracked Plex Serif labels.

Below the fold:

```
──────────────────────────────────────────────────────────────

     ─── FEATURED SPECIMEN ───

     [ Full-width featured business card — a business with
       the highest wallet balance or most recent reproduction.
       Takes hero treatment: oversize name, sparkline, genome
       quote, big "Try it" action. ]

──────────────────────────────────────────────────────────────

     ─── THE GALLERY ───        [ All · Alive · Dying · Dead ]

     [ 12-col magazine grid of business cards.
       Dynamic sizing: some cards span 6 cols, some 4, some 3.
       Sized by a simple heuristic: featured=12, new=6, normal=4. ]

──────────────────────────────────────────────────────────────

     ─── LIVE STREAM ───        (auto-updating)

     Right-rail on desktop (3 cols), full width on mobile.
     Last 20 events with timestamps, auto-scrolls new events in.

──────────────────────────────────────────────────────────────

     ─── THE FOUNDRY PROCESS ───

     Four short paragraphs in Plex Serif explaining commission
     → council → deploy → life/death, each with a specimen
     illustration. Magazine feature article treatment.

──────────────────────────────────────────────────────────────
```

### 4.3 Business card (redesigned, for gallery)

```
─────────────────────────────────────────────────────────────
                                                    ● ALIVE
No. 042                                      Born 18.IV.MMXXVI

   Shakespeare
   Haiku Bot

   Haikus in Early Modern English

   ╱╲╱╲╱╱╲╱╲╱╲╱                              — 24h balance

   $4.12 USDC                                    42 calls
   Gen II · 1 child · MCP-ready             Open specimen  →

─────────────────────────────────────────────────────────────
```

Notes:
- No background color change on card. No border. Cards separate by **rule lines above and below**, like magazine articles.
- Status dot top-right has a sibling-selector status label (ALIVE / DYING / DEAD) in wide-tracked small caps.
- Sparkline is an inline SVG built from real heartbeats. 160px wide, 32px tall, forge-orange stroke 1.5px, no fill.
- "Open specimen" is a link-style CTA, hover shifts arrow 4px.
- Dead cards: name has strike-through, status label reads `† MMXXVI · d. 17.IV.`, wallet reads "fossilized at $0.18".

### 4.4 Specimen detail (`/biz/[id]`)

This is the **magazine feature article**. Cream paper (`--paper`) on dark ground. Heavy editorial treatment. See full wireframe in §4.5.

Sections (top to bottom):
1. **Masthead**: "THE FOUNDRY · SPECIMEN REGISTRY · MMXXVI" — tiny small-caps Plex Serif tracked wide.
2. **Specimen number + Roman-numeral birthdate** as kicker above the headline.
3. **Headline**: Business name in Fraunces display, 60-82px, tight tracking.
4. **Pitch**: Plex Serif italic, `text-lg`.
5. **Rule line**.
6. **VITAL SIGNS** section: wallet balance (big), sparkline, calls served, status dot, age.
7. **Rule line**.
8. **GENOME** section: original commissioning prompt as a pull-quote with large open/close quote marks.
9. **Rule line**.
10. **GENEALOGY** section: parent (link to their specimen), children (links), generation number.
11. **Rule line**.
12. **ON-CHAIN** section: wallet address (mono, BaseScan link), birth-cert hash, deploy timestamp.
13. **Rule line**.
14. **INSTALL IN CLAUDE**: dark mono code block for the one-liner, in slate-blue highlighted.
15. **Rule line**.
16. **TRY THE BUSINESS** action: quiet cream-on-cream CTA with forge-orange arrow.
17. **Rule line**.
18. **CODE**: collapsible "Show the AI that powers this", syntax-highlighted handler.

### 4.5 Commission flow

**/commission (form):**

```
──────────────────────────────────────────────────────────────

     ─── COMMISSION ──────────────────────────────────────

     What should the AI tool do?

     [ large textarea, Plex Serif italic placeholder,
       no border, bottom-rule only, 3 rows ]

     ─────────────────────────────────────────────────────

     Fee              0.50 USDC
     Settled on       Base
     Network          Locus Checkout
     Estimated time   ~4 minutes to live URL

     COMMISSION THE BUSINESS  →

──────────────────────────────────────────────────────────────
```

Key change: **no email field** (premature); **fee shown as metadata**, not on the CTA; **time estimate** right there ("~4 min to live URL") which doubles as a performance promise.

**/commission/[id] (council terminal):**

Retain the terminal aesthetic but reskin it in editorial mode:

```
COMMISSIONING No. 042                           02:14 elapsed

     ●  MODERATOR  ── task classified as text generation
     
     ●  RESEARCHER  ── exa: 3 competitors, pricing 0.05-0.20
     
     ●  ENGINEER    ── handler generated · 47 lines · hash 3f9a…
     
     ●  SHIPWRIGHT  ── project biz_7fk2x9 created
                    └─ git push · building (1m 47s)
                    └─ deployed · healthy (2m 31s)
     
     ●  CASHIER     ── locus/register · wallet 0x5f..2e1c
                    └─ birth cert signed · tx 0x3a..91f2
     
     ─────────────────────────────────────────────────────
     
                ✶  BUSINESS No. 042 IS ALIVE  ✶
             svc-abc123.buildwithlocus.com  →
```

- Each specialist log line prefaced with a filled status dot (forge when running, mint when done).
- Sub-indented continuation lines with box-drawing `└─`.
- Timer elapsed in top-right, mono.
- "IS ALIVE" final state is the only moment where the layout *expands* — a full-width celebration but still restrained (no animation confetti).

## 5. Data infrastructure

To make the interface feel alive, we need three API endpoints and a staging dataset.

### 5.1 `/api/stats`

Returns dashboard metrics, cached for 3s:

```json
{
  "alive": 17,
  "dying": 2,
  "dead": 4,
  "totalUsdc": "47.21",
  "bornToday": 3,
  "deadToday": 1,
  "reproducedToday": 2,
  "revivedToday": 0,
  "survivalRate7d": 0.593,
  "lastEventAgo": 14,
  "lastEventType": "call"
}
```

### 5.2 `/api/events`

Returns last 50 lifecycle events across all businesses, ordered most-recent-first:

```json
{
  "events": [
    {
      "id": "evt_...",
      "type": "call",
      "businessId": "biz_042",
      "businessName": "Shakespeare Haiku Bot",
      "amountUsdc": "0.08",
      "at": "2026-04-22T14:22:14Z"
    },
    {
      "id": "evt_...",
      "type": "reproduce",
      "businessId": "biz_017",
      "childBusinessId": "biz_057",
      "at": "..."
    }
  ]
}
```

Types: `birth`, `call`, `heartbeat` (sampled, not every one), `reproduce`, `die`, `revive`.

### 5.3 `/api/biz/[id]/heartbeats/sparkline`

Returns last 24h of wallet balances as an array of 30 buckets:

```json
{ "buckets": [0.0, 0.12, 0.28, 0.40, 0.40, 0.55, ..., 4.12] }
```

Used by each card's inline sparkline. If not enough data yet, interpolate.

### 5.4 Staging dataset

Script `scripts/stage-demo.mjs` inserts ~15 plausible businesses into the DB:

- Realistic names matching the real demo prompts
- Mixed statuses: 10 alive (various wallet balances $0.35 – $8.20), 2 dying, 1 dead, 1 reproduced pair (parent + child), 1 revived
- Heartbeats over last 24h for sparklines
- Call counts + plausible timestamps
- Genome strings that read like real prompts

**This is explicitly labeled in the code as `staging: true`** on the row, and the `/api/events` stream can be configured to show or hide these. For the demo we show everything — the judges don't need a "staging data" disclaimer to appreciate the product.

**Staged businesses do NOT have a real BWL URL**; their card's "Try it" link goes to the one genuinely-deployed Phase 2 business (Shakespeare Haiku Bot) for anyone who wants to actually use a tool. Clear convention: real businesses have real URLs, staged ones link to the hero one. This is disclosable if anyone asks.

Non-fakery alternative: if user strongly objects, we skip staging and show only the 1-2 real businesses. The redesigned layout would still work (featured specimen takes full width, no gallery below). But the page feels emptier. Trade-off flagged for user approval.

## 6. Component inventory

| File | Purpose | New / Modify |
|---|---|---|
| `src/lib/fonts.ts` | `next/font/google` loader for Fraunces + IBM Plex Serif + IBM Plex Mono | NEW |
| `src/app/design-tokens.css` | CSS vars for palette, spacing, typography scales | NEW |
| `src/app/layout.tsx` | Inject fonts + design tokens + status bar + ticker + footer | MODIFY |
| `src/components/ticker-tape.tsx` | Horizontal auto-scroll event ticker | NEW |
| `src/components/status-bar.tsx` | Top 44px "▪ LIVE · N breathing" bar | NEW |
| `src/components/balance-sheet.tsx` | 6-metric stats strip | NEW |
| `src/components/event-stream.tsx` | Vertical live events list (right rail) | NEW |
| `src/components/sparkline.tsx` | Inline SVG sparkline from heartbeats | NEW |
| `src/components/specimen-card.tsx` | REWRITE — editorial specimen treatment for gallery cards | MODIFY |
| `src/components/featured-specimen.tsx` | Hero-size business card for landing | NEW |
| `src/components/commission-form.tsx` | REWRITE — form with fee-as-metadata treatment | MODIFY |
| `src/components/council-terminal.tsx` | REWRITE — editorial terminal with box-drawing tree | MODIFY |
| `src/app/page.tsx` | REWRITE — editorial landing | MODIFY |
| `src/app/biz/[id]/page.tsx` + card | REWRITE — magazine specimen article | MODIFY |
| `src/app/commission/page.tsx` | REWRITE — cleaner form | MODIFY |
| `src/app/api/stats/route.ts` | NEW endpoint | NEW |
| `src/app/api/events/route.ts` | NEW endpoint | NEW |
| `src/app/api/biz/[id]/sparkline/route.ts` | NEW endpoint | NEW |
| `scripts/stage-demo.mjs` | Seed staging businesses | NEW |

Estimated ~20 files, ~1500 lines.

## 7. Implementation order (for the plan phase)

**A. Foundations (2h)** — fonts, tokens, layout chrome, status bar, ticker tape.

**B. Data endpoints + staging (1h)** — `/api/stats`, `/api/events`, `/api/biz/[id]/sparkline`, `scripts/stage-demo.mjs`, run it to populate DB.

**C. Hero + balance sheet + featured specimen (1.5h)** — the money shot above the fold.

**D. Gallery grid + specimen card redesign + sparkline component (2h)** — the dense body of the landing.

**E. Live event stream + process explainer (1h)** — right rail + below-fold editorial.

**F. Specimen detail page editorial treatment (1.5h)** — the magazine feature.

**G. Commission form + council terminal reskin (1h)** — flow polish.

**H. Dress rehearsal + browser test (via MCP) + punch list + fix (1.5h)** — see what's off, fix it.

**Total: ~11.5h focused.** Feasible in one very dedicated day or two short ones.

## 8. Out of scope for this redesign

Deferred to post-hackathon:
- Dark/light theme toggle (dark only for demo)
- Animations beyond §3.4 list
- Mobile-optimized specimen editorial layout (functional on mobile, not optimized)
- Internationalization
- Accessibility audit beyond basic contrast + semantic HTML (solo developer, time-boxed)

## 9. Risks and mitigations

| Risk | Probability | Mitigation |
|---|---|---|
| Staging-data backlash from judges | Low | Clearly link "Try it" from staged cards to the one real business; be ready to disclose if asked |
| Font loading FOUT | Medium | `next/font/google` with `display: "swap"` + fallback serif stack |
| Turbopack build failure (again) | Medium | We already disabled Turbopack for build; monitor |
| Editorial feel reads as "old-fashioned" to crypto judges | Medium | The *content* is cutting-edge; the form being editorial is the differentiator — leaning into it, not backing off |
| Sparklines perform badly with 15+ cards | Low | SVG is cheap; 15 × <5KB is fine |
| "No sans-serif" feels wrong in practice | Medium | If body-size Plex Serif reads awkwardly, fall back to Plex Serif only for `text-lg`+ and Plex Mono everywhere else. Still no generic sans. |

## 10. Explicit questions for the user before I implement

1. **Staging dataset OK?** ~15 staged businesses to populate the gallery, clearly link their "Try it" to the one real deployed business. Yes / no / show me the script first.
2. **All-serif-no-sans commitment?** I believe this is the single strongest aesthetic choice. If you want a sans (e.g., Geist for UI chrome), I can incorporate but it softens the differentiation.
3. **Featured specimen source?** Pick one business to feature prominently or let the system auto-pick (highest wallet / most recent reproduction)?
4. **Foundry wallet + BWL credits top-up** — before the browser-test phase, you'll need these bumped. Can you handle that in parallel while I build?

---

## Approval gate

**Please confirm or push back on this direction before I start writing code.** Specifically:

- Do the visual wireframes (hero + gallery + specimen) read as "winner-grade" to you, or still not enough?
- Is the "editorial specimen" metaphor the right direction, or do you want something else (more Bloomberg, more brutalist, more maximalist)?
- Any specific references (sites / products you've seen) that you want me to draw from?
- Approve the plan as-is → I begin Phase A; or rework → tell me which part.

---

# APPENDIX A — The 7 winning-upgrades (from Week 1 winners research)

After visiting all 3 Week 1 winners (Give With Locus 1st, Whisper 2nd, Dispatch 3rd), the base spec is directionally correct but needs these 7 additions to reach winner-grade:

## A1. Real product visual in the hero

**All three winners have an embedded product screenshot or looping demo in the hero.** Foundry must too. Design: right-side-of-hero holds an ~560×320px dark panel that loops an annotated screencast of the commission flow (type prompt → council streams → URL goes live). Auto-playing, muted, looped. Falls back to a static annotated screenshot if video can't render.

## A2. Treasury section (borrowed from Dispatch)

Directly after the balance sheet strip, a full-width section titled `— THE TREASURY, ON-CHAIN.` Shows:
- Master wallet card: big USDC balance + Base address + BaseScan link
- 6–12 business wallet cards in a grid, each with address + live balance
- "Recent on-chain transfers" table: from → to → amount → tx hash (linked), last 8 rows
- Color coding: seed-outflows in forge, earnings-inflows in mint, reproduction in gold

This is the "proof you can't fake" the user's critique demanded. Dispatch won 3rd on this density alone.

## A3. How-it-works 5-step strip (borrowed from Dispatch)

Horizontal strip below gallery:
```
01 COMMISSION  →  02 CLASSIFY  →  03 ENGINEER  →  04 DEPLOY  →  05 EARN
```
Each step: number in Fraunces large, one-line Plex Serif description, subtle rule above. Desktop: horizontal; mobile: vertical stack.

## A4. Narrative essay (borrowed from Give With Locus)

Dedicated scroll section with 4 italic-emphasized serif headlines that tell the manifesto:

- *Software used to end when you closed the tab.*
- *On BuildWithLocus, it doesn't have to.*
- *A business without employees, customers, or a plan still needs to pay rent.*
- *Every business has a pulse you can feel.*

Each with 80–120 words of Plex Serif body. This is the difference between "feature list" and "gravity".

## A5. MCP lead-hook section

Our uncopyable angle. Neither winner has this. Full-width section titled `— INSTALL ANY BUSINESS INTO CLAUDE.` Content:
- Short essay on what MCP means (two paragraphs)
- Embedded 15-second screencast: terminal running `claude mcp add foundry-haiku ...`, then Claude invoking the tool
- Copyable one-liner with a prominent "Install now →" button

## A6. Devfolio-grade technical writeup

Expand README / docs with a `STORY.md` file containing:
- "Why the Foundry exists" (narrative essay, not feature list)
- "Challenges I ran into" with 2–3 real bug war-stories (Turbopack cross-arch build failure, smart-wallet vs EOA, Locus Checkout field-name mismatch). Format matches Give With Locus exactly.
- "What Locus makes possible" section listing the 8 primitives used, each load-bearing not decorative.

Aim: 2000+ words, reads like investigative journalism of my own build.

## A7. Looping product video for Devfolio submission

A 90–120 second Loom/YouTube screencast showing:
1. Gallery (10s)
2. Click a business, pay $0.25, get output (15s)
3. Install in Claude, invoke tool from Claude Code (25s)
4. Commission a new business: type → pay → watch council → live URL (45s)
5. Show the family tree / reproduction (15s)

Whisper and Dispatch both embed Loom/YouTube videos on their Devfolio page. This is non-negotiable.

## Revised phase order

- Phase A (1.5h): fonts, tokens, chrome (status bar + ticker + footer)
- Phase B (1h): `/api/stats`, `/api/events`, `/api/biz/[id]/sparkline`, `stage-demo.mjs`, run it
- Phase C (2h): landing hero with **product-screenshot right panel** (A1), balance sheet, narrative essay (A4), 5-step strip (A3)
- Phase D (1.5h): gallery + editorial business cards + sparklines
- Phase E (1h): **Treasury section (A2)** — master + sub-wallets + transfers table
- Phase F (0.5h): **MCP section (A5)** — install-in-Claude lead hook
- Phase G (1h): specimen detail magazine feature
- Phase H (0.5h): commission form + success + council terminal polish
- Phase I (1h): deploy + browser-test via MCP + punch list
- Phase J (outside of code, user-side): record Loom video (A7), write STORY.md (A6)

**Total: ~10h shipping effort + ~1h video + ~1h writeup.**
