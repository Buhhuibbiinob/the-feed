import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { guardBuiltinPage } from "@/lib/pages";
import { isMissingSchema } from "@/lib/dbError";
import { acceptTrade, settleTrade, withdrawOffer } from "@/app/actions/trades";
import { OfferPicker } from "@/components/OfferPicker";
import { ProposeTrade } from "@/components/ProposeTrade";
import { describeTrade, myOffers, myTrades, openOffers, theirOffers } from "@/lib/trades";
import { formatForKey } from "@/lib/physicalMedia";

export const metadata = { title: "The trading table on Feedback" };

/**
 * The trading table.
 *
 * A record fair rather than a marketplace. Nothing is for sale, there is
 * no currency, and you cannot ask for something without putting one of
 * your own up against it, which is the rule that makes it a trade.
 *
 * Your shelf stays private throughout. Only what you deliberately put on
 * the table is visible to anybody, and taking it back is one press.
 */
export default async function TradesPage() {
  const supabase = await createClient();
  await guardBuiltinPage(supabase, "trades");
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Asked as a plain count first, purely so a missing table gives an
  // answer somebody can act on instead of an empty room.
  const { error: probe } = await supabase.from("crate_offers").select("id").limit(1);
  if (probe && isMissingSchema(probe.message)) {
    return (
      <div className="panel">
        <div className="panel-head">The trading table</div>
        <div className="panel-body">
          <p>
            Trading needs two tables that are not in the database yet. Whoever runs the site needs
            to apply <code>supabase/migrations/014-crate-trades.sql</code>.
          </p>
        </div>
      </div>
    );
  }

  const offers = await openOffers(supabase);
  const mine = myOffers(offers, user?.id ?? null);
  const theirs = theirOffers(offers, user?.id ?? null);
  const { incoming, outgoing } = user
    ? await myTrades(supabase, user.id)
    : { incoming: [], outgoing: [] };
  const openIncoming = incoming.filter((t) => t.status === "open");
  const openOutgoing = outgoing.filter((t) => t.status === "open");
  const settled = [...incoming, ...outgoing].filter((t) => t.status !== "open").slice(0, 8);

  return (
    <>
      {openIncoming.length > 0 && (
        <div className="panel">
          <div className="panel-head">Somebody wants one of yours</div>
          <div className="panel-body">
            {openIncoming.map((trade) => (
              <div className="trade-ask" key={trade.id}>
                <div className="trade-pair">
                  <div className="trade-side">
                    <span className="trade-role">They want</span>
                    <b>{trade.wants?.title}</b>
                    <span>{trade.wants?.artist}</span>
                  </div>
                  <span className="trade-swap" aria-hidden="true">
                    &harr;
                  </span>
                  <div className="trade-side">
                    <span className="trade-role">You get</span>
                    <b>{trade.gives?.title}</b>
                    <span>{trade.gives?.artist}</span>
                  </div>
                </div>
                {trade.note && <p className="trade-note">&ldquo;{trade.note}&rdquo;</p>}
                <div className="trade-actions">
                  <form action={acceptTrade} className="inline-form">
                    <input type="hidden" name="trade_id" value={trade.id} />
                    <button type="submit" className="btn">
                      Do the swap
                    </button>
                  </form>
                  <form action={settleTrade} className="inline-form">
                    <input type="hidden" name="trade_id" value={trade.id} />
                    <button type="submit" className="btn btn-ghost">
                      Keep mine
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="panel">
        <div className="panel-head">The trading table</div>
        <div className="panel-body">
          <p className="shelf-intro" style={{ marginTop: 0 }}>
            Records people are willing to part with. You cannot ask for one without putting one of
            yours up against it, which is the whole idea. Your shelf stays private, and only what
            you put on the table here is visible to anybody.
          </p>

          {theirs.length === 0 ? (
            <p className="shelf-pick">
              Nothing on the table yet. Put one of yours up and see who bites.
            </p>
          ) : (
            <div className="woodwall">
              <div className="woodgrid">
                {theirs.map((offer) => (
                  <article className="woodslot" key={offer.id}>
                    <div className={`wooditem fmt-${formatForKey(offer.id)}`}>
                      {offer.imageUrl ? (
                        <img src={offer.imageUrl} alt="" loading="lazy" />
                      ) : (
                        <div className="wood-blank" aria-hidden="true" />
                      )}
                    </div>
                    <div className="woodlabel">
                      <b title={offer.title}>{offer.title}</b>
                      <span title={offer.artist ?? ""}>{offer.artist ?? offer.username}</span>
                    </div>
                    <div className="woodactions">
                      {user ? (
                        <ProposeTrade offer={offer} mine={mine} />
                      ) : (
                        <Link href="/sign-in" className="wood-link">
                          Sign in to ask
                        </Link>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {user && (
        <div className="panel">
          <div className="panel-head">What you have out</div>
          <div className="panel-body">
            {mine.length === 0 ? (
              <p className="shelf-pick">
                Nothing of yours on the table. Put something up and you can start asking.
              </p>
            ) : (
              <ul className="offer-list">
                {mine.map((offer) => (
                  <li key={offer.id}>
                    <b>{offer.title}</b>
                    {offer.artist && <span> {offer.artist}</span>}
                    {offer.note && <em>&ldquo;{offer.note}&rdquo;</em>}
                    <form action={withdrawOffer} className="inline-form">
                      <input type="hidden" name="offer_id" value={offer.id} />
                      <button type="submit">Take it back</button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
            <OfferPicker />
          </div>
        </div>
      )}

      {(openOutgoing.length > 0 || settled.length > 0) && user && (
        <div className="panel">
          <div className="panel-head">What you have asked for</div>
          <div className="panel-body">
            <ul className="offer-list">
              {openOutgoing.map((trade) => (
                <li key={trade.id}>
                  <b>{describeTrade(trade, user.id)}</b>
                  <form action={settleTrade} className="inline-form">
                    <input type="hidden" name="trade_id" value={trade.id} />
                    <button type="submit">Never mind</button>
                  </form>
                </li>
              ))}
              {settled.map((trade) => (
                <li key={trade.id} className="settled">
                  <span>{describeTrade(trade, user.id)}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
