export type MetricType = "binary" | "number" | "scale_1_10";
export type SystemStatus = "done" | "floor" | "skip";

export interface System {
  id: string;
  user_id: string;
  name: string;
  domain: string | null;
  rule: string | null;
  floor: string | null;
  ceiling: string | null;
  metric_type: MetricType;
  anchor: string | null;
  schedule_block: string | null;
  active: boolean;
  sort_order: number;
  // Flexible tracking (R3): weekly systems are judged over the week, and
  // counted systems (metric_type 'number') bump a +1 counter on Today.
  cadence: "daily" | "weekly";
  target_per_week: number | null;
  unit: string | null;
  created_at: string;
  updated_at: string;
}

export interface Entry {
  id: string;
  user_id: string;
  date: string;
  energy_1_10: number | null;
  system_statuses: Record<string, SystemStatus>;
  meals: unknown[];
  one_line: string | null;
  reflection: string | null;
  tomorrow_next_action: string | null;
  is_private: boolean;
  created_at: string;
  updated_at: string;
}
