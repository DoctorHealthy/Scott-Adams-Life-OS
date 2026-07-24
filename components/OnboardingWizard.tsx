"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import NumberField from "@/components/NumberField";
import { completeOnboarding } from "@/app/onboarding/actions";
import { computeTargets } from "@/lib/diet/targets";
import {
  DEFAULT_INTAKE,
  type Intake,
  type Proposal,
} from "@/lib/onboarding/onboarding";

const STEPS = ["Basics", "Sleep", "Schedule", "Diet", "Fitness", "Mind"] as const;

const CONSTRAINT_OPTIONS = [
  "lactose-free",
  "gluten-free",
  "vegetarian",
  "vegan",
  "low added sugar",
  "no alcohol",
];

function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
      {hint ? (
        <p className="muted" style={{ margin: "4px 0 0", fontSize: 12 }}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export default function OnboardingWizard({ email }: { email: string }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [intake, setIntake] = useState<Intake>({ ...DEFAULT_INTAKE });
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [building, setBuilding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof Intake>(key: K, value: Intake[K]) {
    setIntake((prev) => ({ ...prev, [key]: value }));
  }

  const targets = computeTargets({
    age: intake.age,
    height_cm: intake.heightCm,
    weight_kg: intake.weightKg,
    activity_level: intake.activityLevel,
    coaching_prefs: { intake: { sex: intake.sex } },
  });

  async function build() {
    setBuilding(true);
    setError(null);
    try {
      const res = await fetch("/api/onboarding/propose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intake }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Could not build the proposal.");
      setProposal(json.proposal as Proposal);
    } catch (e) {
      setError((e as Error).message);
    }
    setBuilding(false);
  }

  async function save() {
    if (!proposal) return;
    setSaving(true);
    setError(null);
    const res = await completeOnboarding(intake, proposal);
    setSaving(false);
    if ("error" in res) {
      setError(res.error);
      return;
    }
    router.push("/today");
    router.refresh();
  }

  function patchSystem(domain: string, field: string, value: string) {
    if (!proposal) return;
    setProposal({
      ...proposal,
      systems: proposal.systems.map((s) =>
        s.domain === domain ? { ...s, [field]: value } : s
      ),
    });
  }

  // ---------- review screen ----------
  if (proposal) {
    return (
      <div className="stack">
        <div className="card">
          <div className="block-title">Your targets, computed</div>
          <p className="muted" style={{ margin: "6px 0 10px", fontSize: 13 }}>
            From your stats, in code. Editable later in the Diet playbook.
          </p>
          {targets.ok ? (
            <div className="review-rows">
              <div className="review-row">
                <span className="rk">Maintenance</span>
                <span className="rv">{targets.maintenance} kcal</span>
              </div>
              <div className="review-row">
                <span className="rk">
                  {intake.weightGoal === "gain"
                    ? "Lean-gain target"
                    : intake.weightGoal === "lose"
                      ? "Target (slight deficit shown as lean-gain slot)"
                      : "Daily target"}
                </span>
                <span className="rv">{targets.leanGain} kcal</span>
              </div>
              <div className="review-row">
                <span className="rk">Protein</span>
                <span className="rv">{targets.protein} g</span>
              </div>
              <div className="review-row">
                <span className="rk">Water</span>
                <span className="rv">{targets.waterMl} ml</span>
              </div>
            </div>
          ) : (
            <p className="muted" style={{ margin: 0, fontSize: 13 }}>
              Add age, height, and weight in Basics to compute targets.
            </p>
          )}
        </div>

        <div className="card">
          <div className="block-title">Your five systems</div>
          <p className="muted" style={{ margin: "6px 0 0", fontSize: 13 }}>
            Proposed from your answers. Edit anything; you can refine them
            later in each playbook too.
          </p>
        </div>

        {proposal.systems.map((s) => (
          <div className="card" key={s.domain}>
            <div className="eyebrow" style={{ marginBottom: 8 }}>
              {s.domain}
            </div>
            <Field label="Name">
              <input
                value={s.name}
                onChange={(e) => patchSystem(s.domain, "name", e.target.value)}
              />
            </Field>
            <Field label="The rule (what you repeat)">
              <textarea
                rows={2}
                value={s.rule}
                onChange={(e) => patchSystem(s.domain, "rule", e.target.value)}
              />
            </Field>
            <div className="form-row">
              <Field label="Min (worst day, still counts)">
                <textarea
                  rows={2}
                  value={s.floor}
                  onChange={(e) => patchSystem(s.domain, "floor", e.target.value)}
                />
              </Field>
              <Field label="Ceiling (full version)">
                <textarea
                  rows={2}
                  value={s.ceiling}
                  onChange={(e) => patchSystem(s.domain, "ceiling", e.target.value)}
                />
              </Field>
            </div>
            <Field label="Anchor (what it attaches to)">
              <input
                value={s.anchor}
                onChange={(e) => patchSystem(s.domain, "anchor", e.target.value)}
              />
            </Field>
          </div>
        ))}

        <div className="card">
          <div className="block-title">Seed goals</div>
          {proposal.goals.map((g, i) => (
            <div className="form-row" key={i} style={{ marginTop: 10 }}>
              <Field label={`Goal ${i + 1}`}>
                <input
                  value={g.title}
                  onChange={(e) =>
                    setProposal({
                      ...proposal,
                      goals: proposal.goals.map((x, j) =>
                        j === i ? { ...x, title: e.target.value } : x
                      ),
                    })
                  }
                />
              </Field>
              <Field label="Why (one word)">
                <input
                  value={g.why}
                  onChange={(e) =>
                    setProposal({
                      ...proposal,
                      goals: proposal.goals.map((x, j) =>
                        j === i ? { ...x, why: e.target.value } : x
                      ),
                    })
                  }
                />
              </Field>
            </div>
          ))}
          <p className="muted" style={{ margin: "8px 0 0", fontSize: 12 }}>
            Add more goals anytime on Today.
          </p>
        </div>

        {error ? <div className="alert alert-error">{error}</div> : null}

        <div className="btn-row">
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? "Building your Life OS..." : "Save and start"}
          </button>
          <button className="btn btn-auto" onClick={() => setProposal(null)} disabled={saving}>
            Back to answers
          </button>
        </div>
      </div>
    );
  }

  // ---------- intake steps ----------
  return (
    <div className="stack">
      <div style={{ display: "flex", gap: 6 }}>
        {STEPS.map((s, i) => (
          <span
            key={s}
            className="muted"
            style={{
              flex: 1,
              textAlign: "center",
              fontSize: 11,
              paddingBottom: 6,
              borderBottom:
                i === step
                  ? "2px solid var(--accent)"
                  : "2px solid var(--border)",
              color: i === step ? "var(--accent)" : undefined,
            }}
          >
            {s}
          </span>
        ))}
      </div>

      <div className="card">
        {step === 0 ? (
          <>
            <div className="block-title">Basics</div>
            <Field label="Name">
              <input
                value={intake.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="What the coach calls you"
              />
            </Field>
            <div className="form-row">
              <Field label="Age">
                <NumberField
                  value={intake.age}
                  onValue={(n) => set("age", n)}
                  allowEmpty
                />
              </Field>
              <Field label="Sex (for calorie math)">
                <select
                  value={intake.sex}
                  onChange={(e) => set("sex", e.target.value as Intake["sex"])}
                >
                  <option value="female">Female</option>
                  <option value="male">Male</option>
                </select>
              </Field>
            </div>
            <div className="form-row">
              <Field label="Height (cm)">
                <NumberField
                  value={intake.heightCm}
                  onValue={(n) => set("heightCm", n)}
                  allowEmpty
                  allowDecimal
                />
              </Field>
              <Field label="Weight (kg)">
                <NumberField
                  value={intake.weightKg}
                  onValue={(n) => set("weightKg", n)}
                  allowEmpty
                  allowDecimal
                />
              </Field>
            </div>
            <div className="form-row">
              <Field label="Activity level">
                <select
                  value={intake.activityLevel}
                  onChange={(e) =>
                    set("activityLevel", e.target.value as Intake["activityLevel"])
                  }
                >
                  <option value="sedentary">Sedentary</option>
                  <option value="light">Light (1-3 days/week)</option>
                  <option value="moderate">Moderate (3-5 days/week)</option>
                  <option value="high">High (most days)</option>
                  <option value="athlete">Athlete (hard daily)</option>
                </select>
              </Field>
              <Field label="Typical energy right now (1-10)">
                <NumberField
                  value={intake.energyBaseline}
                  onValue={(n) => set("energyBaseline", n)}
                  allowEmpty
                  min={1}
                  max={10}
                />
              </Field>
            </div>
          </>
        ) : null}

        {step === 1 ? (
          <>
            <div className="block-title">Sleep</div>
            <div className="form-row">
              <Field label="When do you usually wake now?">
                <input
                  type="time"
                  value={intake.currentWake}
                  onChange={(e) => set("currentWake", e.target.value)}
                />
              </Field>
              <Field label="When are you usually in bed?">
                <input
                  type="time"
                  value={intake.currentBed}
                  onChange={(e) => set("currentBed", e.target.value)}
                />
              </Field>
            </div>
            <div className="form-row">
              <Field
                label="Goal wake time"
                hint="The app shifts you there in 30-minute steps, held a few days each."
              >
                <input
                  type="time"
                  value={intake.goalWake}
                  onChange={(e) => set("goalWake", e.target.value)}
                />
              </Field>
              <Field label="Hours of sleep you want">
                <NumberField
                  value={intake.sleepHours}
                  onValue={(n) => set("sleepHours", n ?? 8)}
                  allowEmpty
                  min={6}
                  max={10}
                  allowDecimal
                />
              </Field>
            </div>
          </>
        ) : null}

        {step === 2 ? (
          <>
            <div className="block-title">Schedule</div>
            <Field label="Work hours" hint="e.g. 9 to 17, Monday to Friday">
              <input
                value={intake.workHours}
                onChange={(e) => set("workHours", e.target.value)}
              />
            </Field>
            <Field
              label="Fixed commitments"
              hint="Classes, standing appointments. Comma-separated."
            >
              <input
                value={intake.fixedCommitments}
                onChange={(e) => set("fixedCommitments", e.target.value)}
              />
            </Field>
            <Field label="Which hours do you actually control?">
              <input
                value={intake.freeHours}
                onChange={(e) => set("freeHours", e.target.value)}
                placeholder="e.g. early mornings, evenings after 19:00"
              />
            </Field>
          </>
        ) : null}

        {step === 3 ? (
          <>
            <div className="block-title">Diet</div>
            <Field label="Constraints">
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {CONSTRAINT_OPTIONS.map((c) => {
                  const on = intake.dietConstraints.includes(c);
                  return (
                    <button
                      key={c}
                      className={`btn btn-auto${on ? " btn-primary" : ""}`}
                      onClick={() =>
                        set(
                          "dietConstraints",
                          on
                            ? intake.dietConstraints.filter((x) => x !== c)
                            : [...intake.dietConstraints, c]
                        )
                      }
                    >
                      {c}
                    </button>
                  );
                })}
              </div>
            </Field>
            <Field label="Food likes, dislikes, habits" hint="Free text; the coach reads this.">
              <textarea
                rows={3}
                value={intake.dietNotes}
                onChange={(e) => set("dietNotes", e.target.value)}
              />
            </Field>
            <Field label="Weight direction">
              <select
                value={intake.weightGoal}
                onChange={(e) => set("weightGoal", e.target.value as Intake["weightGoal"])}
              >
                <option value="lose">Lose fat</option>
                <option value="hold">Hold, recomposition</option>
                <option value="gain">Gain muscle</option>
              </select>
            </Field>
          </>
        ) : null}

        {step === 4 ? (
          <>
            <div className="block-title">Fitness</div>
            <div className="form-row">
              <Field label="Level">
                <select
                  value={intake.fitnessLevel}
                  onChange={(e) =>
                    set("fitnessLevel", e.target.value as Intake["fitnessLevel"])
                  }
                >
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                </select>
              </Field>
              <Field label="Real sessions per week">
                <NumberField
                  value={intake.sessionsTarget}
                  onValue={(n) => set("sessionsTarget", n ?? 3)}
                  allowEmpty
                  min={1}
                  max={7}
                />
              </Field>
            </div>
            <Field label="What do you enjoy?" hint="Gym, running, climbing, dance, sports...">
              <input
                value={intake.fitnessLikes}
                onChange={(e) => set("fitnessLikes", e.target.value)}
              />
            </Field>
            <Field label="Injuries or limits">
              <input
                value={intake.injuries}
                onChange={(e) => set("injuries", e.target.value)}
              />
            </Field>
          </>
        ) : null}

        {step === 5 ? (
          <>
            <div className="block-title">Mind and coaching</div>
            <Field
              label="Your vision"
              hint="Where you are going. The coach ties your daily work to this."
            >
              <textarea
                rows={3}
                value={intake.vision}
                onChange={(e) => set("vision", e.target.value)}
              />
            </Field>
            <Field label="Coaching style">
              <select
                value={intake.coachingStyle}
                onChange={(e) =>
                  set("coachingStyle", e.target.value as Intake["coachingStyle"])
                }
              >
                <option value="hardcore">Hardcore. Orders, no cushioning.</option>
                <option value="firm">Firm. Direct but warm.</option>
                <option value="gentle">Gentle. Encouraging first.</option>
              </select>
            </Field>
            <Field
              label="What usually breaks your habits?"
              hint="Be honest. The systems get designed against this."
            >
              <textarea
                rows={2}
                value={intake.failureModes}
                onChange={(e) => set("failureModes", e.target.value)}
              />
            </Field>
            <p className="muted" style={{ fontSize: 12, margin: "4px 0 0" }}>
              Signed in as {email}.
            </p>
          </>
        ) : null}
      </div>

      {error ? <div className="alert alert-error">{error}</div> : null}

      <div className="btn-row">
        {step > 0 ? (
          <button className="btn btn-auto" onClick={() => setStep(step - 1)}>
            Back
          </button>
        ) : null}
        {step < STEPS.length - 1 ? (
          <button className="btn btn-primary btn-auto" onClick={() => setStep(step + 1)}>
            Next
          </button>
        ) : (
          <button className="btn btn-primary" onClick={build} disabled={building}>
            {building ? "Designing your Life OS..." : "Build my Life OS"}
          </button>
        )}
      </div>
    </div>
  );
}
