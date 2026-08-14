import type { Env } from "./types";

export const MAX_REPORTS_PER_USER_PER_DAY = 25;
export const MAX_ACTIVE_OFFERS_PER_REPORT = 50;
export const MAX_CHAT_MESSAGES_PER_OFFER = 500;
export const MAX_COMMENTS_PER_REPORT = 200;

export async function runRetentionCleanup(env: Env): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  const results = await env.DB.batch([
    env.DB.prepare("DELETE FROM sessions WHERE expires_at <= ?").bind(now),
    env.DB.prepare("DELETE FROM rate_limits WHERE expires_at <= ?").bind(now),
    env.DB.prepare(
      "DELETE FROM chat_messages WHERE created_at < datetime('now', '-30 days')"
    ),
    env.DB.prepare(
      "DELETE FROM report_comments WHERE created_at < datetime('now', '-30 days')"
    ),
    env.DB.prepare("DELETE FROM offers WHERE updated_at < datetime('now', '-90 days')"),
    env.DB.prepare(
      `DELETE FROM reports
        WHERE (status = 'resolved' AND updated_at < datetime('now', '-30 days'))
           OR (post_type IN ('offer', 'update') AND updated_at < datetime('now', '-30 days'))
           OR created_at < datetime('now', '-180 days')`
    )
  ]);

  console.log(
    "Storage retention cleanup",
    results.map((result) => result.meta.changes ?? 0)
  );
}
