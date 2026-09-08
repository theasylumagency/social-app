/** Shared SQL predicate; alias r is an owned weekly planning run. */
export const currentWeeklyOperation = `
  r.week_start=date_trunc('week',now() AT TIME ZONE 'Asia/Tbilisi')::date
  AND EXISTS(SELECT 1 FROM social_strategies s WHERE s.id::text=r.payload#>>'{socialStrategy,id}' AND s.brand_id=r.brand_id AND s.status='approved')
  AND EXISTS(SELECT 1 FROM workspaces w JOIN workspace_subscriptions sub ON sub.workspace_id=w.id WHERE w.owner_user_id=r.owner_user_id AND sub.paid_at<=now() AND sub.expires_at>now())
`
