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

  return (
    <div className="feed-filter">
      {tabs.map((tab) => (
        <Link
          key={tab.label}
          href={tab.href}
          className={(filter ?? null) === tab.key ? "active" : ""}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
