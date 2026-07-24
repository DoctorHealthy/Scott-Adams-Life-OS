"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { saveProfile, type ProfileInput } from "@/app/profile/actions";
import { computeTargets } from "@/lib/diet/targets";
import NumberField from "@/components/NumberField";

const ACTIVITY_OPTIONS: { value: ProfileInput["activityLevel"]; label: string }[] = [
  { value: "sedentary", label: "Sedentary" },
  { value: "light", label: "Light (1-3 days/week)" },
  { value: "moderate", label: "Moderate (3-5 days/week)" },
  { value: "high", label: "High (most days)" },
  { value: "athlete", label: "Athlete (hard daily)" },
];

const STYLE_OPTIONS: { value: ProfileInput["coachingStyle"]; label: string }[] = [
  { value: "hardcore", label: "Hardcore. Orders, no cushioning." },
  { value: "firm", label: "Firm. Direct but warm." },
  { value: "gentle", label: "Gentle. Encouraging first." },
];

const COMMON_TZ = [
  "Europe/Vienna",
  "Europe/London",
  "Europe/Berlin",
  "Europe/Madrid",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "UTC",
];

function timezones(current: string): string[] {
  let all: string[] = [];
  try {
    const fn = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] })
      .supportedValuesOf;
    if (fn) all = fn("timeZone");
  } catch {
    all = [];
  }
  const base = all.length ? all : COMMON_TZ;
  return Array.from(new Set([current, ...base])).filter(Boolean);
}

export default function ProfileForm({ initial }: { initial: ProfileInput }) {
  const router = useRouter();
  const [form, setForm] = useState<ProfileInput>(initial);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tzList = useMemo(() => timezones(initial.timezone), [initial.timezone]);

  function set<K extends keyof ProfileInput>(key: K, value: ProfileInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setSaved(false);
  }

  // Live target preview: recomputed in code as the stats change, so the user
  // sees the effect of an edit before saving. The coach still reads these.
  const targets = computeTargets({
    age: form.age,
    height_cm: form.heightCm,
    weight_kg: form.weightKg,
    activity_level: form.activityLevel,
    coaching_prefs: { intake: { sex: form.sex } },
  });

  async function save() {
    setSaving(true);
    setError(null);
    const res = await saveProfile(form);
    setSaving(false);
    if ("error" in res) {
      setError(res.error);
      return;
    }
    setSaved(true);
    router.refresh();
  }

  return (
    <div className="stack">
      {/* Identity */}
      <div className="card">
        <div className="block-title">You</div>
        <div className="field">
          <label>Name</label>
          <input
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="What the coach calls you"
          />
        </div>
      </div>

      {/* Body stats */}
      <div className="card">
        <div className="block-title">Body</div>
        <p className="muted" style={{ margin: "6px 0 10px", fontSize: 13 }}>
          These drive your calorie and protein targets. This weight is your
          baseline stat, separate from the daily weigh-in you log in Diet.
        </p>
        <div className="form-row">
          <div className="field">
            <label>Age</label>
            <NumberField
              value={form.age}
              onValue={(n) => set("age", n)}
              allowEmpty
              min={0}
              max={120}
            />
          </div>
          <div className="field">
            <label>Sex (for calorie math)</label>
            <select
              value={form.sex}
              onChange={(e) => set("sex", e.target.value as ProfileInput["sex"])}
            >
              <option value="female">Female</option>
              <option value="male">Male</option>
            </select>
          </div>
        </div>
        <div className="form-row">
          <div className="field">
            <label>Height (cm)</label>
            <NumberField
              value={form.heightCm}
              onValue={(n) => set("heightCm", n)}
              allowEmpty
              min={0}
              max={260}
            />
          </div>
          <div className="field">
            <label>Weight (kg)</label>
            <NumberField
              value={form.weightKg}
              onValue={(n) => set("weightKg", n)}
              allowEmpty
              allowDecimal
              min={0}
              max={400}
            />
          </div>
        </div>
        <div className="field">
          <label>Activity level</label>
          <select
            value={form.activityLevel}
            onChange={(e) =>
              set("activityLevel", e.target.value as ProfileInput["activityLevel"])
            }
          >
            {ACTIVITY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Computed targets, live */}
      <div className="card">
        <div className="block-title">Your targets, computed</div>
        {targets.ok ? (
          <div className="review-rows">
            <div className="review-row">
              <span className="rk">Maintenance</span>
              <span className="rv">{targets.maintenance} kcal</span>
            </div>
            <div className="review-row">
              <span className="rk">Lean-gain target</span>
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
          <p className="muted" style={{ margin: "6px 0 0", fontSize: 13 }}>
            Fill in age, height, and weight to compute targets.
          </p>
        )}
        <p className="muted" style={{ margin: "10px 0 0", fontSize: 12 }}>
          Computed in code from your stats. Fine-tune the exact numbers in the
          Diet playbook if you want to override them.
        </p>
      </div>

      {/* Preferences */}
      <div className="card">
        <div className="block-title">Preferences</div>
        <div className="field">
          <label>Timezone</label>
          <select
            value={form.timezone}
            onChange={(e) => set("timezone", e.target.value)}
          >
            {tzList.map((tz) => (
              <option key={tz} value={tz}>
                {tz}
              </option>
            ))}
          </select>
          <p className="muted" style={{ margin: "4px 0 0", fontSize: 12 }}>
            Reminders fire at your local time using this.
          </p>
        </div>
        <div className="field">
          <label>Coaching style</label>
          <select
            value={form.coachingStyle}
            onChange={(e) =>
              set("coachingStyle", e.target.value as ProfileInput["coachingStyle"])
            }
          >
            {STYLE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error ? <div className="alert alert-error">{error}</div> : null}

      <div className="today-save-row">
        <button className="btn btn-primary btn-auto" onClick={save} disabled={saving}>
          {saving ? "Saving..." : "Save profile"}
        </button>
        <span className="save-status muted">{saved ? "Saved." : ""}</span>
      </div>
    </div>
  );
}
