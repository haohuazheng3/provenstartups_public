export function Dots({ n, max = 5 }: { n?: number | null; max?: number }) {
  if (n == null) return null;
  return (
    <span className="inline-flex items-center gap-[3px]" title={`Difficulty ${n}/${max}`}>
      {Array.from({ length: max }, (_, i) => (
        <span
          key={i}
          className={`h-[5px] w-[5px] rounded-full ${
            i < n ? "bg-t3" : "bg-line-2"
          }`}
        />
      ))}
    </span>
  );
}

export function Stars({ n, max = 5 }: { n?: number | null; max?: number }) {
  if (n == null) return null;
  return (
    <span className="inline-flex items-center gap-[2.5px]" title={`Upside ${n}/${max}`}>
      {Array.from({ length: max }, (_, i) => (
        <span
          key={i}
          className={`h-[6px] w-[6px] rotate-45 rounded-[1.5px] ${
            i < n ? "bg-t1" : "bg-line-2"
          }`}
        />
      ))}
    </span>
  );
}

const SCORE_META: { key: string; label: string; hint: string }[] = [
  { key: "tech", label: "Build", hint: "How hard to build with AI assistance" },
  { key: "acquisition", label: "Acquire", hint: "How hard the first paying customers are" },
  { key: "capital", label: "Capital", hint: "Upfront money needed before it works" },
  { key: "competition", label: "Compete", hint: "How crowded this space is in 2026" },
  { key: "validation", label: "Validate", hint: "How long until you know it works" },
];

export function ScoreBars({ scores }: { scores?: { [k: string]: number | undefined } | null }) {
  if (!scores) return null;
  return (
    <div className="grid grid-cols-5 gap-3">
      {SCORE_META.map(({ key, label, hint }) => {
        const v = scores[key] ?? 0;
        return (
          <div key={key} className="flex flex-col items-center gap-2.5" title={hint}>
            <div className="flex flex-col-reverse gap-[3px]">
              {Array.from({ length: 5 }, (_, i) => (
                <span
                  key={i}
                  className={`h-[11px] w-[9px] rounded-[3px] ${
                    i < v ? "bg-t1" : "bg-line-2"
                  }`}
                />
              ))}
            </div>
            <span className="text-[0.6rem] font-semibold uppercase tracking-wide text-t4">
              {label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
