/**
 * Thin progress line under the search box. The old results stay on screen while new ones load, and this line
 * is the only sign of work (M06-S09). The strip keeps its height when idle so nothing shifts.
 */
export function SearchProgress({ active }: { active: boolean }) {
  return (
    <div className="web-search-progress">
      {active ? (
        <div className="web-search-progress__rail" role="progressbar" aria-label="Loading results">
          <div className="web-search-progress__bar" />
        </div>
      ) : null}
    </div>
  );
}
