"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  addFriend,
  respondFriend,
  removeFriend,
  setHiddenSystems,
} from "@/app/partner/actions";
import type { WeekPerson } from "@/lib/partner/partner";
import type { SystemStatus } from "@/lib/types";

export type FriendshipRow = {
  id: string;
  user_id: string;
  friend_id: string;
  status: "pending" | "accepted" | "blocked";
};

const DOT: Record<SystemStatus, { label: string; color: string }> = {
  done: { label: "done", color: "var(--good)" },
  floor: { label: "floor", color: "var(--warn)" },
  skip: { label: "skip", color: "var(--bad)" },
};

const DAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"];

function dayLetter(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return DAY_LETTERS[new Date(y, m - 1, d).getDay()];
}

function WeekCard({ person }: { person: WeekPerson }) {
  return (
    <div className="card" style={{ flex: 1, minWidth: 280 }}>
      <div className="card-head-row">
        <span className="block-title">{person.name}</span>
        <span className="muted" style={{ fontSize: 12 }}>
          streak {person.streak}d
        </span>
      </div>

      {/* Energy row */}
      <div style={{ marginTop: 10 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 11,
            color: "var(--muted)",
            marginBottom: 4,
          }}
        >
          <span>
            Energy{person.energyAvg != null ? ` (avg ${person.energyAvg})` : ""}
          </span>
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          {person.days.map((d, i) => (
            <div
              key={d}
              title={d}
              style={{
                flex: 1,
                textAlign: "center",
                padding: "5px 0",
                borderRadius: 6,
                border: "1px solid var(--border)",
                background: "var(--panel-2)",
                fontSize: 12,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              <div style={{ fontSize: 9, color: "var(--muted)" }}>{dayLetter(d)}</div>
              {person.energy[i] ?? "·"}
            </div>
          ))}
        </div>
      </div>

      {/* Systems grid */}
      <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>
        {person.systems.map((s) => (
          <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span
              style={{
                flex: "0 0 40%",
                fontSize: 13,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {s.name}
            </span>
            <span style={{ display: "flex", gap: 4, flex: 1 }}>
              {s.statuses.map((st, i) => (
                <span
                  key={i}
                  title={`${person.days[i]}: ${st ?? "not logged"}`}
                  style={{
                    flex: 1,
                    height: 10,
                    borderRadius: 3,
                    background: st ? DOT[st].color : "var(--panel-2)",
                    border: st ? "none" : "1px solid var(--border)",
                    opacity: st === "skip" ? 0.85 : 1,
                  }}
                />
              ))}
            </span>
            <span
              className="muted"
              style={{ fontSize: 11, width: 28, textAlign: "right" }}
            >
              {s.ran}/7
            </span>
          </div>
        ))}
        {person.systems.length === 0 ? (
          <p className="muted" style={{ margin: 0, fontSize: 13 }}>
            No shared systems.
          </p>
        ) : null}
      </div>

      {/* Goals */}
      {person.goals.length > 0 ? (
        <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>
          {person.goals.map((g) => (
            <div key={g.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span
                style={{
                  flex: "0 0 40%",
                  fontSize: 13,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {g.title}
              </span>
              {g.progress == null ? (
                <span className="muted" style={{ fontSize: 11 }}>
                  not shared
                </span>
              ) : (
                <>
                  <span
                    style={{
                      flex: 1,
                      height: 6,
                      borderRadius: 999,
                      background: "var(--panel-2)",
                      overflow: "hidden",
                    }}
                  >
                    <span
                      style={{
                        display: "block",
                        height: "100%",
                        width: `${g.progress}%`,
                        background: "var(--accent)",
                      }}
                    />
                  </span>
                  <span
                    className="muted"
                    style={{ fontSize: 11, width: 34, textAlign: "right" }}
                  >
                    {g.progress}%
                  </span>
                </>
              )}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function PartnerView({
  userId,
  friendships,
  me,
  friend,
  mySystems,
  hiddenSystems,
}: {
  userId: string;
  friendships: FriendshipRow[];
  me: WeekPerson;
  friend: WeekPerson | null;
  mySystems: { id: string; name: string }[];
  hiddenSystems: string[];
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [hidden, setHidden] = useState<string[]>(hiddenSystems);
  const [showSettings, setShowSettings] = useState(false);

  const accepted = friendships.find((f) => f.status === "accepted") ?? null;
  const incoming = friendships.filter(
    (f) => f.status === "pending" && f.friend_id === userId
  );
  const outgoing = friendships.filter(
    (f) => f.status === "pending" && f.user_id === userId
  );

  async function link() {
    setBusy(true);
    setError(null);
    setMsg(null);
    const res = await addFriend(email);
    setBusy(false);
    if ("error" in res) setError(res.error);
    else {
      setMsg(
        res.status === "accepted"
          ? "Linked. You can see each other's progress now."
          : "Request sent. They accept it on their Partner page."
      );
      setEmail("");
      router.refresh();
    }
  }

  async function toggleHidden(id: string) {
    const next = hidden.includes(id)
      ? hidden.filter((x) => x !== id)
      : [...hidden, id];
    setHidden(next);
    await setHiddenSystems(next);
    router.refresh();
  }

  return (
    <div className="stack">
      {/* Link management */}
      {!accepted ? (
        <div className="card">
          <div className="block-title">Link your partner</div>
          <p className="muted" style={{ margin: "6px 0 12px", fontSize: 13 }}>
            They sign up first, then you link by their account email.
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input
              type="email"
              placeholder="partner@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{ flex: 1, minWidth: 200 }}
            />
            <button
              className="btn btn-primary btn-auto"
              onClick={link}
              disabled={busy || !email.trim()}
            >
              {busy ? "Linking..." : "Send link request"}
            </button>
          </div>
          {msg ? (
            <p className="muted" style={{ marginTop: 10, marginBottom: 0, fontSize: 13 }}>
              {msg}
            </p>
          ) : null}
          {error ? (
            <div className="alert alert-error" style={{ marginTop: 10 }}>
              {error}
            </div>
          ) : null}

          {incoming.length > 0 ? (
            <div style={{ marginTop: 14 }}>
              {incoming.map((f) => (
                <div
                  key={f.id}
                  style={{ display: "flex", alignItems: "center", gap: 10 }}
                >
                  <span style={{ flex: 1, fontSize: 14 }}>
                    A link request is waiting.
                  </span>
                  <button
                    className="btn btn-primary btn-auto"
                    onClick={async () => {
                      await respondFriend(f.id, true);
                      router.refresh();
                    }}
                  >
                    Accept
                  </button>
                  <button
                    className="btn btn-auto"
                    onClick={async () => {
                      await respondFriend(f.id, false);
                      router.refresh();
                    }}
                  >
                    Decline
                  </button>
                </div>
              ))}
            </div>
          ) : null}

          {outgoing.length > 0 ? (
            <p className="muted" style={{ marginTop: 12, marginBottom: 0, fontSize: 13 }}>
              Request sent. Waiting for them to accept.
            </p>
          ) : null}
        </div>
      ) : null}

      {/* The shared week */}
      {accepted && friend ? (
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
          <WeekCard person={me} />
          <WeekCard person={friend} />
        </div>
      ) : null}

      {accepted ? (
        <div className="card">
          <div className="card-head-row">
            <span className="block-title">Sharing settings</span>
            <button
              className="btn btn-ghost btn-auto"
              onClick={() => setShowSettings((s) => !s)}
            >
              {showSettings ? "Hide" : "Edit"}
            </button>
          </div>
          {showSettings ? (
            <>
              <p className="muted" style={{ margin: "6px 0 10px", fontSize: 13 }}>
                Hidden systems are invisible to your partner. Journals and
                reflections are never shared either way.
              </p>
              {mySystems.map((s) => (
                <label className="check-row" key={s.id}>
                  <input
                    type="checkbox"
                    checked={!hidden.includes(s.id)}
                    onChange={() => toggleHidden(s.id)}
                  />
                  <span>{s.name}</span>
                </label>
              ))}
              <div className="btn-row" style={{ marginTop: 12 }}>
                <button
                  className="btn btn-ghost btn-auto btn-danger"
                  onClick={async () => {
                    if (!window.confirm("Unlink your partner?")) return;
                    await removeFriend(accepted.id);
                    router.refresh();
                  }}
                >
                  Unlink partner
                </button>
              </div>
            </>
          ) : (
            <p className="muted" style={{ margin: "6px 0 0", fontSize: 13 }}>
              {mySystems.length - hidden.length} of {mySystems.length} systems
              visible to your partner.
            </p>
          )}
        </div>
      ) : null}

      {/* Legend */}
      {accepted && friend ? (
        <p className="muted" style={{ margin: 0, fontSize: 12 }}>
          Green done, amber floor, red skip, empty not logged.
        </p>
      ) : null}
    </div>
  );
}
