# SUBSCRIPTIONS — design for sign-off (v1.2.0, #11)

> Status: **DESIGN, not built.** This is the plan for Centry Premium. Nothing here is
> implemented yet — it needs your decisions (marked ⟶ **DECISION**) and App Store
> Connect setup you own. Once you approve, implementation is a self-contained slice.

## 1. Products & pricing (from owner)

| Product id (proposed)     | Type                       | Price  | Notes                   |
| ------------------------- | -------------------------- | ------ | ----------------------- |
| `centry.premium.monthly`  | Auto-renewing subscription | $2.99  | base                    |
| `centry.premium.sixmonth` | Auto-renewing subscription | $12.99 | ~$2.16/mo (−27%)        |
| `centry.premium.yearly`   | Auto-renewing subscription | $19.99 | ~$1.66/mo (−44%)        |
| `centry.premium.lifetime` | **Non-consuming** purchase | $49.99 | pays off at ~16+ months |

The three renewing ones live in **one Subscription Group** (`Centry Premium`) so iOS
offers upgrade/downgrade/crossgrade automatically. Lifetime is a **separate
non-consumable** (not part of the group — it never renews).

There is **one entitlement**: `premium`. A user has it if ANY of the four is active
(or lifetime is owned, or a free grant is present — §5).

## 2. What's gated (free vs premium)

Centry stays **fully usable offline and privacy-first** even free — the gate is about
_breadth_, never about holding data hostage. Free tier:

| Area                                                                    | Free                                | Premium         |
| ----------------------------------------------------------------------- | ----------------------------------- | --------------- |
| Logging expenses/income/transfers                                       | ✅ full                             | ✅              |
| "Можно сегодня", budget plan, spend accounts                            | ✅                                  | ✅              |
| **Accounts**                                                            | up to **3** active                  | unlimited       |
| **Categories**                                                          | default (system) only — no add/edit | add/edit/delete |
| **Statistics** (wallet-total sheet, History charts, goals rings detail) | **blurred** behind a paywall veil   | ✅              |
| **Goals**                                                               | ⟶ **DECISION** (see below)          | ✅              |
| **Widgets** (home, lock-screen, quick-add)                              | show "Buy Premium" placeholder      | ✅              |
| **Apple Watch app + complications**                                     | "Buy Premium" screen                | ✅              |
| **CSV export / import**                                                 | premium only                        | ✅              |
| **Siri / App Intents**                                                  | ⟶ **DECISION** (see below)          | likely premium  |

Owner's list said "нельзя использовать мобильную версию" without a sub — but a hard
lock of the whole app hurts App Review (Apple dislikes apps that are unusable without
purchase and can reject) and kills word-of-mouth. **Recommendation:** keep core
logging free, gate the _value-adds_ above. This is the standard freemium shape (a la
things like "Money Manager"/"Spendee") and reviews cleanly.

⟶ **DECISION 1:** Hard-lock the whole app (risky for review, simpler) **or** freemium
as tabled above (**recommended**)?
⟶ **DECISION 2:** Are **goals** free (nice hook, encourages saving) or premium?
⟶ **DECISION 3:** Is **Siri** free or premium? (It's a small feature; I'd leave it free.)

### Gating mechanics per surface

- **Account cap:** `createAccount` funnel checks `!premium && activeSpendAccounts >= 3`
  → throws a friendly error that opens the paywall. Existing accounts over the cap when
  a sub lapses stay **readable** (never delete data) but you can't add more.
- **Categories:** the "＋ Add category" / edit affordances open the paywall when free.
- **Statistics veil:** the stats modals render normally but with an absolutely-positioned
  `expo-blur` overlay (`intensity` ~30, tinted) + "Разблокировать статистику" button.
  Blur counts toward rule 9's "≤5 blurred views" — it's one overlay, fine.
- **Widgets/Watch:** the snapshot carries a `premium: boolean`; Swift renders the
  placeholder when false.
- **Export/Import rows:** open the paywall when free.

## 3. Entitlement architecture (code)

New, isolated slice — mirrors the existing layering (rule: side-effects in services,
state in stores, orchestration in controllers):

```
src/services/iap/            # the ONLY module that talks to StoreKit / RevenueCat
  index.ts                   # init, getOfferings, purchase(id), restore(), listen for updates
src/stores/entitlement.store.ts   # { premium: boolean, source: 'sub'|'lifetime'|'grant'|null, products }
src/controllers/purchase.controller.ts  # buy(), restore(), refresh() → writes the store
src/views/paywall/PaywallSheet.tsx      # the paywall (global sheet, like the others)
src/views/settings/SubscriptionScreen.tsx  # manage/see status, restore, redeem grant
@utils/entitlement.ts        # pure helpers: isPremium(state), accountCapReached(...)
```

- **Network note (rule 5):** StoreKit/RevenueCat talk to **Apple/RevenueCat only**,
  never send financial data, and are a _purchase_ channel — this is a deliberate,
  disclosed exception to "network lives only in rates/". Document it in DECISIONS.md as
  a new decision (B-series). No personal/transaction data leaves the device.
- The entitlement is **cached** (MMKV) so the app knows premium offline; re-verified on
  launch and on foreground.

⟶ **DECISION 4 (biggest):** **StoreKit 2 direct** vs **RevenueCat**.

- **RevenueCat (recommended):** free < $2.5k/mo revenue, gives you the free-grant/
  "promotional entitlements" dashboard **for free** (§5), cross-device entitlement,
  receipt validation, and analytics — saves a lot of fiddly StoreKit receipt code.
  One SDK (`react-native-purchases`), native rebuild.
- **StoreKit 2 direct:** no third party, but you build receipt handling, the
  free-grant mechanism, and restore logic yourself. More code, more edge cases.
  My strong recommendation is **RevenueCat** — specifically because of your free-grant
  requirement (§5), which it solves out of the box.

## 4. Paywall & entry points (UX)

1. **Persistent corner label** (owner's ask): a small pill fixed **bottom-right above the
   tab bar** on every screen — "✨ Premium" (hidden once premium). Tapping opens the
   paywall. Implemented as a root-level overlay (like the FAB), gated on `!premium`.
2. **Settings → a highlighted "Centry Premium" row** (accent-tinted, top of the list)
   → opens `SubscriptionScreen`.
3. **Contextual:** any gated action (add 4th account, edit category, open stats, export)
   opens the paywall with a one-line reason ("Unlimited accounts is a Premium feature").
4. **Paywall sheet contents:** value bullets, the 4 plans as selectable cards (yearly
   pre-selected + "BEST VALUE" badge; lifetime as "Pay once"), a big "Continue" CTA,
   "Restore purchases", and links to Terms/Privacy (Apple **requires** these on the
   paywall). Prices come from StoreKit localized `displayPrice` (never hardcode — App
   Review rejects hardcoded prices).
5. **SubscriptionScreen:** current status ("Premium · renews 12 Mar" / "Lifetime" /
   "Free"), Manage (opens iOS-managed subscriptions), Restore, and the **Redeem grant**
   field (§5).

## 5. Free grants (owner must be able to give Premium to anyone / self)

This is the load-bearing requirement. Three viable mechanisms — you can have more than one:

- **A. RevenueCat Promotional Entitlements (recommended):** in the RC dashboard you grant
  the `premium` entitlement to a specific **App User ID** for any duration (a week →
  lifetime) with two clicks. Requires the person's app to use a stable/shareable user id.
  Simplest for "give it to a friend/yourself" and needs **zero code** beyond RC being
  wired. Zero cost.
- **B. Redeem codes:** Centry generates/accepts codes (e.g. `CENTRY-XXXX`). A code you
  hand out flips a local `grant` entitlement (optionally time-boxed). Fully offline,
  under your control, but you manage codes yourself. Small code surface (validate a
  signed code → set entitlement source `grant`). Good for gifting without accounts.
- **C. App Store Offer Codes / Promo Codes:** Apple-native, but limited quantity and
  tied to real products (they still show "free for N months" then may charge). Less
  flexible for "give lifetime to my friend forever."

⟶ **DECISION 5:** Which grant mechanism(s)? My rec: **A (RevenueCat promo entitlements)**
for personal/simple gifting **+ B (redeem codes)** if you want offline, account-free
gifting. Both are cheap to support.

- **Owner self-grant:** trivial with A (grant your own user id) or B (a master code only
  you know). Also add a hidden dev toggle in a debug build.

## 6. App Store Connect setup (owner tasks)

1. Create the **Subscription Group** "Centry Premium" and the 3 renewing products +
   1 non-consumable, each with the ids above, localized names/descriptions, prices.
2. Fill **subscription metadata** (Apple requires: title, duration, price, and a
   review screenshot of the paywall) or the build gets rejected.
3. Add **Terms of Use (EULA)** + reuse the existing Privacy Policy URL — link both on the
   paywall (required).
4. (If RevenueCat) create the RC project, add the products, set the `premium` entitlement,
   paste the RC public API key into the app config.
5. Create a **Sandbox tester** to test purchases before release.
6. Bump to the paid **Apple Developer Program** (already have) and enable
   **In-App Purchase** capability (config plugin / entitlement).

## 7. Rollout / edge cases

- **Grace period & billing retry:** enable in ASC so a failed renewal doesn't instantly
  revoke premium.
- **Lapse behaviour:** on expiry, `premium=false`; data is untouched; accounts over the
  cap become read-only-add (can't create more), categories revert to default-picker.
- **Restore:** mandatory (Apple requires a Restore button); RC/StoreKit both support it.
- **Family Sharing:** ⟶ **DECISION 6** — enable for the subs/lifetime? (nice, optional.)
- **Refunds/chargebacks:** RC webhooks or StoreKit transaction updates flip the entitlement.
- **Offline:** cached entitlement means premium keeps working with no network.

## 8. Implementation order (once approved)

1. `iap` service + `entitlement.store` + `purchase.controller` (wire RC/StoreKit, no UI).
2. `@utils/entitlement` + gate the account cap, categories, export/import (pure checks).
3. Stats blur veil + widget/watch `premium` flag in the snapshot.
4. `PaywallSheet` + `SubscriptionScreen` + the corner label.
5. Grant mechanism (A and/or B) + Redeem UI.
6. i18n (RU/EN), tests for the pure `@utils/entitlement` gating logic.
7. ASC products + sandbox test + review-notes screenshot.

---

### Open decisions summary (need owner)

1. Hard-lock vs freemium (rec: **freemium**).
2. Goals free or premium?
3. Siri free or premium? (rec: free)
4. **RevenueCat vs StoreKit 2** (rec: **RevenueCat**).
5. Grant mechanism: A / B / both (rec: **A + optionally B**).
6. Family Sharing on the products?
