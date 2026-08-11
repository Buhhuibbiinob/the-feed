import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";
import {
  adminDeleteMessage,
  adminDismissReport,
  adminDeleteDirectMessage,
  adminDismissDmReport,
  adminBanUser,
  adminUnbanUser,
  adminRemoveUser,
  adminApproveClub,
  adminBanClub,
  adminDeleteClub,
  adminDismissClubReport,
  adminVerifyArtist,
  adminUnverifyArtist,
  adminSetVerified,
  adminUnsetVerified,
  adminSetBonusStats,
  adminBanArtistPost,
  adminUnbanArtistPost,
  adminDeleteArtistPost,
  adminDismissArtistReport,
  adminApproveBanner,
  adminRejectBanner,
  adminDeleteBanner,
} from "@/app/actions/admin";
import { MEDIA_LABELS, type MediaType } from "@/lib/media";
import { ARTIST_PLATFORM_LABELS, type ArtistPlatform } from "@/lib/artistPlatforms";
import { SITE_CONTENT_FIELDS, getAllSiteText } from "@/lib/siteContent";
import { SiteContentForm } from "@/components/SiteContentForm";
import { HouseAdForm } from "@/components/HouseAdForm";
import { SendSignInLinksButton } from "@/components/SendSignInLinksButton";
import { BotAdminPanel } from "@/components/BotAdminPanel";
import { listBots } from "@/app/actions/bots";
import { getSiteFlags } from "@/lib/siteFlags";

type ReportRow = {
  id: string;
  created_at: string;
  chat_messages: { id: string; body: string; user_id: string; profiles: { username: string } | null } | null;
  profiles: { username: string } | null;
};

type DmReportRow = {
  id: string;
  created_at: string;
  direct_messages: { id: string; body: string; sender_id: string; profiles: { username: string } | null } | null;
  profiles: { username: string } | null;
};

type ProfileRow = {
  id: string;
  username: string;
  is_admin: boolean;
  banned: boolean;
  is_verified_artist: boolean;
  is_verified: boolean;
  bonus_followers: number;
  bonus_likes: number;
  name_color: string | null;
};

type ArtistPostRow = {
  id: string;
  artist_name: string;
  platform: ArtistPlatform;
  status: "active" | "banned";
  profiles: { username: string } | null;
};

type ArtistPostReportRow = {
  id: string;
  reason: string | null;
  created_at: string;
  artist_posts: { id: string; artist_name: string } | null;
  profiles: { username: string } | null;
};

type ClubRow = {
  id: string;
  media_type: MediaType;
  name: string;
  status: "pending" | "approved" | "banned";
};

type ClubReportRow = {
  id: string;
  reason: string | null;
  created_at: string;
  clubs: { id: string; name: string } | null;
  profiles: { username: string } | null;
};

type BannerRow = {
  id: string;
  artist_name: string;
  link_url: string | null;
  image_url: string | null;
  message: string | null;
  slot_type: string;
  status: "pending" | "approved" | "rejected";
  expires_at: string | null;
  profiles: { username: string } | null;
};

export const metadata = { title: "Admin - Feedback" };

export default async function AdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !(await isAdmin(supabase, user.id))) {
    notFound();
  }

  const [
    { data: reportRows },
    { data: dmReportRows },
    { data: profileRows },
    { data: pendingClubRows },
    { data: clubReportRows },
    { data: artistPostRows },
    { data: artistReportRows },
    { data: bannerRows },
    siteText,
  ] = await Promise.all([
    supabase
      .from("message_reports")
      .select(
        "id, created_at, chat_messages(id, body, user_id, profiles(username)), profiles!message_reports_reporter_id_fkey(username)"
      )
      .order("created_at", { ascending: false })
      .returns<ReportRow[]>(),
    supabase
      .from("dm_reports")
      .select(
        "id, created_at, direct_messages(id, body, sender_id, profiles(username)), profiles!dm_reports_reporter_id_fkey(username)"
      )
      .order("created_at", { ascending: false })
      .returns<DmReportRow[]>(),
    supabase
      .from("profiles")
      .select("id, username, is_admin, banned, is_verified_artist, is_verified, bonus_followers, bonus_likes, name_color")
      .order("username", { ascending: true })
      .returns<ProfileRow[]>(),
    supabase
      .from("clubs")
      .select("id, media_type, name, status")
      .eq("status", "pending")
      .order("name", { ascending: true })
      .returns<ClubRow[]>(),
    supabase
      .from("club_reports")
      .select("id, reason, created_at, clubs(id, name), profiles!club_reports_reporter_id_fkey(username)")
      .order("created_at", { ascending: false })
      .returns<ClubReportRow[]>(),
    supabase
      .from("artist_posts")
      .select("id, artist_name, platform, status, profiles(username)")
      .order("created_at", { ascending: false })
      .returns<ArtistPostRow[]>(),
    supabase
      .from("artist_post_reports")
      .select(
        "id, reason, created_at, artist_posts(id, artist_name), profiles!artist_post_reports_reporter_id_fkey(username)"
      )
      .order("created_at", { ascending: false })
      .returns<ArtistPostReportRow[]>(),
    supabase
      .from("banner_ads")
      .select("id, artist_name, link_url, image_url, message, slot_type, status, expires_at, profiles(username)")
      .order("created_at", { ascending: false })
      .returns<BannerRow[]>(),
    getAllSiteText(supabase),
  ]);

  const reports = reportRows ?? [];
  const dmReports = dmReportRows ?? [];
  const profiles = profileRows ?? [];
  const pendingClubs = pendingClubRows ?? [];
  const clubReports = clubReportRows ?? [];
  const artistPosts = artistPostRows ?? [];
  const artistReports = artistReportRows ?? [];
  const banners = bannerRows ?? [];
  const pendingBanners = banners.filter((b) => b.status === "pending");
  const approvedBanners = banners.filter((b) => b.status === "approved");

  const [bots, siteFlags] = await Promise.all([listBots(), getSiteFlags(supabase)]);

  return (
    <>
      <div className="page-header">
        <h1>Admin</h1>
        <div className="tagline">Moderation tools - reported messages, users, bans.</div>
      </div>

      <div className="panel">
        <div className="panel-body form-actions">
          <Link href="/admin/newsletter" className="btn">
            Manage Weekly Newsletter
          </Link>
          <Link href="/admin/pages" className="btn btn-ghost">
            Manage Pages
          </Link>
          <Link href="/admin/themes" className="btn btn-ghost">
            Edit Themes
          </Link>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">Reported Messages</div>
        <div className="panel-body flush">
          {reports.length === 0 ? (
            <div className="empty-state" style={{ padding: 16 }}>No reports right now.</div>
          ) : (
            reports.map((r) => (
              <div className="chat-row" key={r.id}>
                {r.chat_messages ? (
                  <>
                    <b>{r.chat_messages.profiles?.username ?? "unknown"}:</b> {r.chat_messages.body}
                  </>
                ) : (
                  <i>message deleted</i>
                )}
                <span className="chat-msg-actions">
                  <span className="comment-action">reported by {r.profiles?.username ?? "unknown"}</span>
                  {r.chat_messages && (
                    <form action={adminDeleteMessage} className="inline-form">
                      <input type="hidden" name="message_id" value={r.chat_messages.id} />
                      <button type="submit" className="comment-action danger">
                        Remove message
                      </button>
                    </form>
                  )}
                  <form action={adminDismissReport} className="inline-form">
                    <input type="hidden" name="report_id" value={r.id} />
                    <button type="submit" className="comment-action">
                      Dismiss
                    </button>
                  </form>
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">Reported Direct Messages</div>
        <div className="panel-body flush">
          {dmReports.length === 0 ? (
            <div className="empty-state" style={{ padding: 16 }}>No reports right now.</div>
          ) : (
            dmReports.map((r) => (
              <div className="chat-row" key={r.id}>
                {r.direct_messages ? (
                  <>
                    <b>{r.direct_messages.profiles?.username ?? "unknown"}:</b> {r.direct_messages.body}
                  </>
                ) : (
                  <i>message deleted</i>
                )}
                <span className="chat-msg-actions">
                  <span className="comment-action">reported by {r.profiles?.username ?? "unknown"}</span>
                  {r.direct_messages && (
                    <form action={adminDeleteDirectMessage} className="inline-form">
                      <input type="hidden" name="message_id" value={r.direct_messages.id} />
                      <button type="submit" className="comment-action danger">
                        Remove message
                      </button>
                    </form>
                  )}
                  <form action={adminDismissDmReport} className="inline-form">
                    <input type="hidden" name="report_id" value={r.id} />
                    <button type="submit" className="comment-action">
                      Dismiss
                    </button>
                  </form>
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">Users</div>
        <div className="panel-body flush">
          {profiles.map((p) => (
            <div className="chat-row" key={p.id}>
              <b style={p.name_color ? { color: p.name_color } : undefined}>{p.username}</b>
              {p.is_admin && <span> · admin</span>}
              {p.banned && <span> · banned</span>}
              {p.is_verified_artist && (
                <span className="verified-check" title="Verified creator">
                  ✓
                </span>
              )}
              {p.is_verified && (
                <span className="verified-check" title="Verified">
                  ✓
                </span>
              )}
              <span className="chat-msg-actions">
                {p.is_verified ? (
                  <form action={adminUnsetVerified} className="inline-form">
                    <input type="hidden" name="user_id" value={p.id} />
                    <button type="submit" className="comment-action">
                      Remove verified badge
                    </button>
                  </form>
                ) : (
                  <form action={adminSetVerified} className="inline-form">
                    <input type="hidden" name="user_id" value={p.id} />
                    <button type="submit" className="comment-action">
                      Grant verified badge
                    </button>
                  </form>
                )}
              </span>
              <form action={adminSetBonusStats} className="inline-form" style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 4 }}>
                <input type="hidden" name="user_id" value={p.id} />
                <input
                  type="number"
                  name="bonus_followers"
                  defaultValue={p.bonus_followers}
                  min={0}
                  placeholder="Bonus followers"
                  style={{ width: 90, fontSize: 11 }}
                />
                <input
                  type="number"
                  name="bonus_likes"
                  defaultValue={p.bonus_likes}
                  min={0}
                  placeholder="Bonus likes"
                  style={{ width: 90, fontSize: 11 }}
                />
                <input
                  type="text"
                  name="name_color"
                  defaultValue={p.name_color ?? ""}
                  placeholder="Name color (#hex)"
                  style={{ width: 110, fontSize: 11 }}
                />
                <button type="submit" className="comment-action">
                  Save
                </button>
              </form>
              {!p.is_admin && (
                <span className="chat-msg-actions">
                  {p.is_verified_artist ? (
                    <form action={adminUnverifyArtist} className="inline-form">
                      <input type="hidden" name="user_id" value={p.id} />
                      <button type="submit" className="comment-action">
                        Remove blue check
                      </button>
                    </form>
                  ) : (
                    <form action={adminVerifyArtist} className="inline-form">
                      <input type="hidden" name="user_id" value={p.id} />
                      <button type="submit" className="comment-action">
                        Verify as creator
                      </button>
                    </form>
                  )}
                  {p.banned ? (
                    <form action={adminUnbanUser} className="inline-form">
                      <input type="hidden" name="user_id" value={p.id} />
                      <button type="submit" className="comment-action">
                        Unban
                      </button>
                    </form>
                  ) : (
                    <form action={adminBanUser} className="inline-form">
                      <input type="hidden" name="user_id" value={p.id} />
                      <button type="submit" className="comment-action danger">
                        Ban
                      </button>
                    </form>
                  )}
                  <form action={adminRemoveUser} className="inline-form">
                    <input type="hidden" name="user_id" value={p.id} />
                    <button type="submit" className="comment-action danger">
                      Remove account
                    </button>
                  </form>
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">Clubs Pending Review</div>
        <div className="panel-body flush">
          {pendingClubs.length === 0 ? (
            <div className="empty-state" style={{ padding: 16 }}>No clubs waiting on review.</div>
          ) : (
            pendingClubs.map((c) => (
              <div className="chat-row" key={c.id}>
                <span className={`badge ${c.media_type}`}>{MEDIA_LABELS[c.media_type]}</span>{" "}
                <Link href={`/clubs/${c.id}`}>{c.name}</Link>
                <span className="chat-msg-actions">
                  <form action={adminApproveClub} className="inline-form">
                    <input type="hidden" name="club_id" value={c.id} />
                    <button type="submit" className="comment-action">
                      Approve
                    </button>
                  </form>
                  <form action={adminBanClub} className="inline-form">
                    <input type="hidden" name="club_id" value={c.id} />
                    <button type="submit" className="comment-action danger">
                      Ban
                    </button>
                  </form>
                  <form action={adminDeleteClub} className="inline-form">
                    <input type="hidden" name="club_id" value={c.id} />
                    <button type="submit" className="comment-action danger">
                      Delete
                    </button>
                  </form>
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">Reported Clubs</div>
        <div className="panel-body flush">
          {clubReports.length === 0 ? (
            <div className="empty-state" style={{ padding: 16 }}>No club reports right now.</div>
          ) : (
            clubReports.map((r) => (
              <div className="chat-row" key={r.id}>
                {r.clubs ? (
                  <Link href={`/clubs/${r.clubs.id}`}>{r.clubs.name}</Link>
                ) : (
                  <i>club deleted</i>
                )}
                {r.reason && <span> - {r.reason}</span>}
                <span className="chat-msg-actions">
                  <span className="comment-action">reported by {r.profiles?.username ?? "unknown"}</span>
                  {r.clubs && (
                    <form action={adminBanClub} className="inline-form">
                      <input type="hidden" name="club_id" value={r.clubs.id} />
                      <button type="submit" className="comment-action danger">
                        Ban club
                      </button>
                    </form>
                  )}
                  <form action={adminDismissClubReport} className="inline-form">
                    <input type="hidden" name="report_id" value={r.id} />
                    <button type="submit" className="comment-action">
                      Dismiss
                    </button>
                  </form>
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">Reported Creator Posts</div>
        <div className="panel-body flush">
          {artistReports.length === 0 ? (
            <div className="empty-state" style={{ padding: 16 }}>No artist post reports right now.</div>
          ) : (
            artistReports.map((r) => (
              <div className="chat-row" key={r.id}>
                {r.artist_posts ? (
                  <Link href={`/artists/${r.artist_posts.id}`}>{r.artist_posts.artist_name}</Link>
                ) : (
                  <i>post deleted</i>
                )}
                {r.reason && <span> - {r.reason}</span>}
                <span className="chat-msg-actions">
                  <span className="comment-action">reported by {r.profiles?.username ?? "unknown"}</span>
                  {r.artist_posts && (
                    <form action={adminBanArtistPost} className="inline-form">
                      <input type="hidden" name="post_id" value={r.artist_posts.id} />
                      <button type="submit" className="comment-action danger">
                        Ban post
                      </button>
                    </form>
                  )}
                  <form action={adminDismissArtistReport} className="inline-form">
                    <input type="hidden" name="report_id" value={r.id} />
                    <button type="submit" className="comment-action">
                      Dismiss
                    </button>
                  </form>
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">Site Text</div>
        <div className="panel-body">
          {SITE_CONTENT_FIELDS.map((field) => (
            <SiteContentForm
              key={field.key}
              fieldKey={field.key}
              label={field.label}
              value={siteText[field.key]}
            />
          ))}
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">Creator Posts</div>
        <div className="panel-body flush">
          {artistPosts.length === 0 ? (
            <div className="empty-state" style={{ padding: 16 }}>No artist posts yet.</div>
          ) : (
            artistPosts.map((post) => (
              <div className="chat-row" key={post.id}>
                <span className={`badge ${post.platform}`}>{ARTIST_PLATFORM_LABELS[post.platform]}</span>{" "}
                <Link href={`/artists/${post.id}`}>{post.artist_name}</Link>
                <span> by {post.profiles?.username ?? "unknown"}</span>
                {post.status === "banned" && <span> · banned</span>}
                <span className="chat-msg-actions">
                  {post.status === "banned" ? (
                    <form action={adminUnbanArtistPost} className="inline-form">
                      <input type="hidden" name="post_id" value={post.id} />
                      <button type="submit" className="comment-action">
                        Unban
                      </button>
                    </form>
                  ) : (
                    <form action={adminBanArtistPost} className="inline-form">
                      <input type="hidden" name="post_id" value={post.id} />
                      <button type="submit" className="comment-action danger">
                        Ban
                      </button>
                    </form>
                  )}
                  <form action={adminDeleteArtistPost} className="inline-form">
                    <input type="hidden" name="post_id" value={post.id} />
                    <button type="submit" className="comment-action danger">
                      Delete
                    </button>
                  </form>
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">Banner Requests Pending Review</div>
        <div className="panel-body flush">
          {pendingBanners.length === 0 ? (
            <div className="empty-state" style={{ padding: 16 }}>No banner requests waiting on review.</div>
          ) : (
            pendingBanners.map((b) => (
              <div className="chat-row" key={b.id}>
                {b.image_url && <img src={b.image_url} alt="" className="cover-thumb" style={{ marginRight: 8 }} />}
                <b>{b.artist_name}</b> <span className="field-hint">[{b.slot_type}]</span>
                {b.link_url && (
                  <>
                    {" "}
                    · <a href={b.link_url} target="_blank" rel="noreferrer">{b.link_url}</a>
                  </>
                )}
                {b.message && <span> - {b.message}</span>}
                <span> (submitted by {b.profiles?.username ?? "unknown"})</span>
                <span className="chat-msg-actions">
                  <form action={adminApproveBanner} className="inline-form">
                    <input type="hidden" name="banner_id" value={b.id} />
                    <input type="date" name="expires_at" className="field-hint" style={{ marginRight: 4 }} />
                    <button type="submit" className="comment-action">
                      Approve
                    </button>
                  </form>
                  <form action={adminRejectBanner} className="inline-form">
                    <input type="hidden" name="banner_id" value={b.id} />
                    <button type="submit" className="comment-action danger">
                      Reject
                    </button>
                  </form>
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">AI Bot Accounts</div>
        <div className="panel-body">
          <p className="field-hint" style={{ marginBottom: 12 }}>
            Personas that post reviews, chat, and like real members&apos; posts so the site isn&apos;t empty
            while the community is still small. They appear everywhere a normal account does - feed,
            leaderboard, chat - and are indistinguishable from real members to visitors. Only this
            panel shows which accounts are bots.
          </p>
          <BotAdminPanel bots={bots} enabled={siteFlags.bots_enabled} />
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">Email Everyone a Sign-In Link</div>
        <div className="panel-body">
          <p className="field-hint" style={{ marginBottom: 12 }}>
            One-off recovery send for after the confirmation and reset links were landing on the home
            page. Emails every account a fresh magic sign-in link. Each link is a live credential that
            signs that person straight in, expires in about an hour, and works once, so the email also
            points people at the forgot-password page in case theirs has expired by the time they read
            it. Test addresses are skipped.
          </p>
          <SendSignInLinksButton />
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">Add a House Ad</div>
        <div className="panel-body">
          <p className="field-hint" style={{ marginBottom: 12 }}>
            Your own ads - added here go live immediately (no review needed) and rotate
            automatically with whatever else is approved below, cycling every few hours.
          </p>
          <HouseAdForm />
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">Approved Banners</div>
        <div className="panel-body flush">
          {approvedBanners.length === 0 ? (
            <div className="empty-state" style={{ padding: 16 }}>No approved banners yet.</div>
          ) : (
            approvedBanners.map((b) => (
              <div className="chat-row" key={b.id}>
                {b.image_url && <img src={b.image_url} alt="" className="cover-thumb" style={{ marginRight: 8 }} />}
                <b>{b.artist_name}</b>
                {b.expires_at && <span> · expires {new Date(b.expires_at).toLocaleDateString()}</span>}
                <span className="chat-msg-actions">
                  <form action={adminDeleteBanner} className="inline-form">
                    <input type="hidden" name="banner_id" value={b.id} />
                    <button type="submit" className="comment-action danger">
                      Remove
                    </button>
                  </form>
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}
