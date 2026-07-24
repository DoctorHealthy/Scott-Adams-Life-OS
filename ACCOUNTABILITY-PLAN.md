# R6: Accountability System 2.0 (scoring, consequences, rewards)

Source: Mark's "Accountability System v2.0" doc (2026-07). This file is the
reviewed, adapted implementation plan. Build in a fresh Claude Code session:
read PROGRESS.md + CLAUDE.md + this file first. Use the established
Fable-orchestrator / Opus-worker split; all numbers in code, AI only narrates.

## STATUS: BUILT (2026-07-24, R6). Decisions Mark confirmed, which override the doc:
- Correction 1 KEPT: a system's Min counts as a full point (Done-or-Min = 1,
  Skip/no-log = 0). The floor doctrine wins over "no partial completion".
- Correction 2 REVERSED by Mark: running STAYS a punishment (his doc's
  distances: daily 3/5/8 km at 2/1/0, weekly 5/10 km at C/F, escalating). The
  only softening: a declared "bad-body day" waives that day's run only; the fine
  still applies (runsWaiverAllowed, default on).
- Corrections 3 (personal cutoff, default 03:00) and 4 (fines/runs are ledger
  obligations, lock is a declared state; the app never moves money or blocks
  apps) implemented as written.
- NEW (Mark's ask): the Gear/Trip Fund is a renamable goal with an optional
  target amount; it renders as a progress bar (balance / target) and he logs a
  payout when he spends it. Fine money fills it (opportunity-cost by design).
See PROGRESS.md (R6 entry) for the full build map and setup steps.

## Verdict on the doc

Strong: pre-decided consequences, binary judgment, partner verification,
money-to-fund (opportunity cost, not loss), escalation with reset, identity
framing, declared-in-advance exceptions. Keep all of that.

Four corrections before implementing (agreed direction, confirm with Mark):

1. KEEP THE MIN. "No partial completion" kills the floor doctrine and creates
   a death spiral (miss -> punishment run -> fatigue -> miss again). Rule:
   a system's Min counts as complete for scoring. The Min already exists per
   system; the doc's binary stays binary (Done-or-Min = 1 point, else 0).
2. NO RUNNING AS PUNISHMENT. Punishing with the behavior he must love makes
   him hate training (and double-taxes the body on bad days). Replace run
   penalties with: bigger fund transfers and longer entertainment locks.
   Escalation still applies. (If Mark insists on runs, make them a config
   option, default off.)
3. DAY CUTOFF IS PERSONAL, NOT MIDNIGHT. His day ends ~02:30. Config
   `cutoffHour` (default 3): a day is judged at cutoff, and logs before
   cutoff count for the previous calendar day only in the judgment engine
   (entries stay keyed to calendar dates; the judge simply runs at cutoff).
4. THE APP CANNOT MOVE MONEY OR BLOCK APPS. Fines become ledger entries the
   owner marks paid (partner sees status; unpaid entries nag via Telegram).
   Entertainment lock is a state the app declares, displays, and reports to
   the partner, enforcement is human.

## What is already in the app (reuse, do not rebuild)

- The four habits are systems (Sleep, Exercise, plus custom German/Reading);
  scoring sits ON TOP of systems. Config picks which systems are "scored"
  (coaching_prefs.scoring.systemIds), any count works, each = 1 point.
- Sleep success = in bed by target AND slept >= sleepHours: computable from
  module_logs.sleep (bed, wake) + sleepConfig.
- Weekly windows: weekStartOf() (Monday) in lib/commitments.
- Exactly-once sends: reminder_sends pattern. Telegram: sendTelegram +
  cron as single consumer. Partner linkage: friendships + chatByUser (cron).
- Grades/verdicts by cron; commitments (R4) stay as the separate contract
  layer, momentum rings stay.

## Data (migration 0011)

ledger table:
- id, user_id, date (the judged local date), source ('day'|'week'|'escalation'),
  kind ('fine'|'lock'|'reward'), amount_eur numeric null, label text,
  status ('pending'|'done'|'waived'), resolved_on date null, created_at.
- RLS own-all; partner reads via sanitized partner_ledger(friend) RPC
  (label, date, kind, amount, status only).
day/week grades: computed, not stored (recompute from entries + config), but
the judgment must be exactly-once -> reuse reminder_sends keys
('score:day:<date>', 'score:week:<monday>').
Exceptions: coaching_prefs.scoring.exceptions: [{date, reason}] declared
before cutoff via a small action; judged days with an exception score as
"excused" (no penalty, day excluded from week points, max shrinks by 4).

## Engine (lib/score/score.ts, pure code)

- dayScore(entries, scoredSystems, sleepConfig, config) -> {points, max,
  perSystem: [{id, name, done}]}. Sleep scored via bed<=target && duration>=
  sleepHours (tolerance config, default 15 min). Others: status done|floor,
  or counter>=1 that day (config per system later; v1: done|floor).
- dayGrade(points, max): Perfect/Green/Yellow/Red/Critical mapped
  proportionally when max != 4 (>=75% green etc. keep doc thresholds for 4).
- weekPoints (Mon-Sun sum), weekGrade S/A/B/C/D/F per doc thresholds scaled
  to max*7.
- consequencesFor(dayGrade|weekGrade, escalationLevel, config) -> ledger rows
  + lock changes, per the doc tables minus runs (see correction 2), amounts
  from config (dailyFine default 5, weekly 5/10/15/20).
- escalationLevel: count consecutive identical prior penalties from ledger;
  reset on A/S week.
- lockState(ledger, entries): locked when latest 'lock' entry unresolved;
  resolved automatically by the next Green day (>=75%).
- rewards: 3 consecutive Green days, S week, perfect month -> ledger 'reward'
  rows (labels from config.rewardCatalog), never funded by fines.

## Cron additions (single new block, same file)

At each run, for each user, if local time past cutoffHour and
'score:day:<yesterday>' not yet sent: judge yesterday, insert ledger rows,
apply/release lock, Telegram to owner ("Yesterday 2/4 Yellow. Auto: 5 EUR to
the Gear fund. Entertainment locked until a Green day.") and to partner
(verifier message, always on for scoring, it is the point of the doc; reuse
exposePartner? NO: scoring uses its own coaching_prefs.scoring.notifyPartner,
default true). Monday: judge last week the same way. Reply PAID <n> or a
button in-app marks fines done.

## UI

- Today: day-score chip in the header card (2/4 so far, color by grade band)
  + a red LOCKED banner when entertainment lock active.
- /weekly (or a new /score card above commitments): this week's day grades
  strip (Mon..Sun colored dots), week points so far, grade projection,
  ledger list (pending fines with Mark paid button, fund total to date),
  escalation level, settings (scored systems picker, cutoff, amounts,
  reward catalog, notifyPartner, exceptions declare-for-today).
- Partner page: partner's ledger summary via RPC (fund total, pending count,
  lock state).
- Coach DATA (daily+weekly): current grade, lock state, fund total, pending
  fines; rule: state consequences as facts already decided, never negotiate
  them, never invent amounts.

## Order

1. Migration 0011 + lib/score engine + config read/write (me/orchestrator).
2. Cron judgment block + Telegram texts (orchestrator; delicate).
3. UI packages (Opus): score card + settings on weekly; Today chip + banner;
   partner ledger line.
4. Coach DATA wiring + prompt rules (orchestrator).
5. Verify (tsc/build), commit per package, test steps for Mark.

Estimated: one focused session (R4-sized). Confirm corrections 1, 2 with
Mark before building; they change his doc.
