import type { WeeklyChannelPlan } from "../../blueprints/social/weekly-planning/channel-plan"

export function WeeklyChannelPlanSummary({ plan }: { plan: WeeklyChannelPlan | undefined }) {
  if (!plan) return null
  return <section className="fp-channel-plan" aria-label="თითოეული არხის კვირის გეგმა">
    <h3>რას ვგეგმავთ თითოეულ არხზე</h3>
    <div className="fp-decisions">{plan.channels.map(item => <section key={item.channel}>
      <h4>{item.channel === "facebook" ? "Facebook" : "Instagram"} · {item.count} პოსტი</h4>
      <p>{item.role}</p>
      {item.count === 0 ? <p className="wp-notice"><strong>რატომ არ ვაქვეყნებთ:</strong> {item.omissionReason}</p> : <p>{item.reason}</p>}
    </section>)}</div>
  </section>
}
