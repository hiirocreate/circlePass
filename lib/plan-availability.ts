const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
const DAY_LABEL_JA: Record<(typeof DAY_KEYS)[number], string> = {
  sun: "日",
  mon: "月",
  tue: "火",
  wed: "水",
  thu: "木",
  fri: "金",
  sat: "土",
};

export type PlanAvailability = {
  available_days: string[] | null;
  available_time_start: string | null; // "HH:MM:SS" 形式
  available_time_end: string | null;
};

/**
 * 現在時刻(日本時間)がプランの利用可能曜日・時間帯に含まれるかを判定する。
 * available_days / available_time_start / available_time_end が未設定(null)の項目は
 * 「制限なし」として扱う。
 */
export function checkPlanAvailability(
  plan: PlanAvailability,
  now: Date = new Date()
): { ok: boolean; reason?: string } {
  // JSTでの曜日・時刻を取得(サーバーのタイムゾーンに依存しないようIntlで変換)
  const jstFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Tokyo",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = jstFormatter.formatToParts(now);
  const weekdayShort = parts.find((p) => p.type === "weekday")?.value ?? "";
  const hour = parts.find((p) => p.type === "hour")?.value ?? "00";
  const minute = parts.find((p) => p.type === "minute")?.value ?? "00";
  const second = parts.find((p) => p.type === "second")?.value ?? "00";

  const weekdayMap: Record<string, (typeof DAY_KEYS)[number]> = {
    Sun: "sun",
    Mon: "mon",
    Tue: "tue",
    Wed: "wed",
    Thu: "thu",
    Fri: "fri",
    Sat: "sat",
  };
  const todayKey = weekdayMap[weekdayShort];

  // 曜日チェック
  if (plan.available_days && plan.available_days.length > 0) {
    if (!todayKey || !plan.available_days.includes(todayKey)) {
      const label = plan.available_days.map((d) => DAY_LABEL_JA[d as (typeof DAY_KEYS)[number]] ?? d).join("・");
      return { ok: false, reason: `このプランは利用可能曜日(${label}曜日)外のため利用できません` };
    }
  }

  // 時間帯チェック
  if (plan.available_time_start && plan.available_time_end) {
    const currentTime = `${hour}:${minute}:${second}`;
    const start = plan.available_time_start.length === 5 ? `${plan.available_time_start}:00` : plan.available_time_start;
    const end = plan.available_time_end.length === 5 ? `${plan.available_time_end}:00` : plan.available_time_end;

    const inRange = start <= end
      ? currentTime >= start && currentTime <= end
      : // 例: 22:00-02:00のような日をまたぐ設定にも対応
        currentTime >= start || currentTime <= end;

    if (!inRange) {
      return {
        ok: false,
        reason: `このプランは利用可能時間(${plan.available_time_start.slice(0, 5)}〜${plan.available_time_end.slice(0, 5)})外のため利用できません`,
      };
    }
  }

  return { ok: true };
}
