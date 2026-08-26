import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";
import { LAYOUT_EXPERIMENT } from "@/lib/experiments";
import {
  computeExperiment,
  computeEditFrequency,
  computeEditToReview,
  computeRetention,
  type EventRow,
  type MemberRow,
  type PostStamp,
} from "@/lib/retention";

export const metadata = { title: "Retention" };

function percent(part: number, whole: number): string {
  if (whole === 0) return "-";
  return `${Math.round((part / whole) * 100)}%`;
}

export default async function RetentionPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !(await isAdmin(supabase, user.id))) redirect("/");

  const [{ data: eventRows }, { data: memberRows }, { data: postRows }] = await Promise.all([
    supabase
      .from("activity_events")
      .select("user_id, kind, meta, created_at")
      .order("created_at", { ascending: true })
      .returns<EventRow[]>(),
    supabase
      .from("profiles")
      .select("id, username, created_at")
      .eq("is_bot", false)
      .returns<MemberRow[]>(),
    supabase.from("posts").select("user_id, created_at").returns<PostStamp[]>(),
  ]);

  const events = eventRows ?? [];
  const members = memberRows ?? [];
  const posts = postRows ?? [];

  const edits = computeEditFrequency(events);
  const conversion = computeEditToReview(events, posts);
  const retention = computeRetention(members, events, posts);
  const experiment = computeExperiment(events, posts, LAYOUT_EXPERIMENT);

  return (
    <>
      <div className="panel">
        <div className="panel-head">Profile edits</div>
        <div className="panel-body">
          {edits.editors === 0 ? (
            <div className="empty-state">
              No profile edits logged yet. Events only exist from the day logging shipped, so this
              stays empty until members start editing.
            </div>
          ) : (
            <>
              <div className="metric-row">
                <span className="metric">
                  <b>{edits.editors}</b>editors
                </span>
                <span className="metric">
                  <b>{edits.totalEdits}</b>total edits
                </span>
                <span className="metric">
                  <b>{edits.repeat}</b>came back on another day
                </span>
                <span className="metric">
                  <b>{percent(edits.repeat, edits.editors)}</b>repeat rate
                </span>
              </div>
              <p className="field-hint">
                One-time setup: {edits.oneTime}. Repeat tweaking is the number that matters - it is
                the behaviour the whole profile bet rests on.
              </p>
              <div className="metric-bars">
                {edits.byControl.map((control) => (
                  <div className="metric-bar-row" key={control.detail}>
                    <span className="metric-bar-label">{control.detail}</span>
                    <span
                      className="metric-bar"
                      style={{
                        width: `${Math.round((control.count / edits.byControl[0].count) * 100)}%`,
                      }}
                    />
                    <span className="metric-bar-value">{control.count}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">Does editing lead to reviewing?</div>
        <div className="panel-body">
          <div className="metric-row">
            <span className="metric">
              <b>{conversion.editors}</b>members who edited
            </span>
            <span className="metric">
              <b>{percent(conversion.sameSession, conversion.editors)}</b>posted within 30 min
            </span>
            <span className="metric">
              <b>{percent(conversion.sameWeek, conversion.editors)}</b>posted within a week
            </span>
          </div>
          <p className="field-hint">
            Measured forward from each member&apos;s first edit, so someone who was already posting
            before they ever touched their profile does not count as converted.
          </p>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">Homepage layout test</div>
        <div className="panel-body">
          {experiment.length === 0 ? (
            <div className="empty-state">
              Nobody bucketed yet. Members are assigned on their first homepage visit.
            </div>
          ) : (
            <table className="metric-table">
              <thead>
                <tr>
                  <th>Layout</th>
                  <th>Members</th>
                  <th>Posted a review</th>
                  <th>Edited profile</th>
                  <th>Reviews each</th>
                </tr>
              </thead>
              <tbody>
                {experiment.map((row) => (
                  <tr key={row.variant}>
                    <td>{row.variant === "paired" ? "Paired (test)" : "Stack (current)"}</td>
                    <td>{row.members}</td>
                    <td>{percent(row.posted, row.members)}</td>
                    <td>{percent(row.edited, row.members)}</td>
                    <td>{row.reviewsPerMember.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="field-hint">
            Only activity after a member was bucketed counts - comparing lifetime totals would just
            say which bucket caught the older accounts. Members are split by a hash of their id, so
            each person always sees the same layout. Signed-out visitors all get the current one.
          </p>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">Return rate by first-week behaviour</div>
        <div className="panel-body">
          <table className="metric-table">
            <thead>
              <tr>
                <th>Segment</th>
                <th>Members</th>
                <th>Day 7</th>
                <th>Day 30</th>
              </tr>
            </thead>
            <tbody>
              {retention.map((segment) => (
                <tr key={segment.label}>
                  <td>{segment.label}</td>
                  <td>{segment.cohortSize}</td>
                  <td>{segment.day7}%</td>
                  <td>{segment.day30}%</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="field-hint">
            Members too new to have had a day 7 or day 30 are left out of that column rather than
            counted as having not returned. &quot;Returned&quot; means a logged event or a review -
            passive reading is not recorded, so these are floors, not exact figures.
          </p>
        </div>
      </div>
    </>
  );
}
