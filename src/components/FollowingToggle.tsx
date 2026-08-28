import Link from "next/link";

// The feed's three views. "For You" reorders the same posts by taste and
// "Following" narrows to people you follow, so only one of the three can
// ever show you less than "All" - worth knowing when reading an empty state.
export function FollowingToggle({ filter }: { filter: string | null }) {
  const tabs = [
    { key: null, label: "All", href: "/" },
    { key: "foryou", label: "For You", href: "/?filter=foryou" },
    { key: "following", label: "Following", href: "/?filter=following" },
  ];

  // The kit's segmented control. This was a bespoke pill strip and the
  // category row below it was a third style again - three ways of saying
  // "pick one of these" on one screen. One control now.
  return (
    <div className="feed-filter">
      <div className="seg">
        {tabs.map((tab) => (
          <Link
            key={tab.label}
            href={tab.href}
            className={`seg-item${(filter ?? null) === tab.key ? " active" : ""}`}
          >
            {tab.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
