// iTunes-style rating stars: a gold gradient clipped to the glyphs with a
// dark drop shadow underneath, so they read as lit 3D objects rather than
// flat text characters. Deliberately plain markup with no client JS - these
// render inside server components all over the site.
export function Stars({ rating, className }: { rating: number | null; className?: string }) {
  if (!rating) return null;
  const filled = Math.max(0, Math.min(5, rating));
  return (
    <span
      className={`sk-stars${className ? ` ${className}` : ""}`}
      role="img"
      aria-label={`${filled} out of 5 stars`}
    >
      <span className="sk-stars-on" aria-hidden="true">
        {"★".repeat(filled)}
      </span>
      <span className="sk-stars-off" aria-hidden="true">
        {"★".repeat(5 - filled)}
      </span>
    </span>
  );
}
