import { Palette } from "lucide-react";
import { useMemo } from "react";
import type { ThemeMode } from "../lib/filters/filterStore";
import { colorSchemes, getColorScheme, type ColorSchemeId } from "../lib/viz/colorSchemes";

export function ColorSchemeSelect({
  value,
  onChange
}: {
  value: ThemeMode;
  onChange: (scheme: ThemeMode) => void;
}) {
  const activeScheme = getColorScheme(value);
  const groupedSchemes = useMemo(() => {
    const groups = new Map<string, Array<(typeof colorSchemes)[number]>>();
    colorSchemes.forEach((scheme) => {
      const current = groups.get(scheme.category) ?? [];
      groups.set(scheme.category, [...current, scheme]);
    });
    return [...groups.entries()].map(([category, items]) => ({
      category,
      items: [...items].sort((a, b) => a.name.localeCompare(b.name))
    }));
  }, []);
  const orderedIds = useMemo(() => colorSchemes.map((scheme) => scheme.id), []);
  const shiftScheme = (direction: -1 | 1) => {
    const currentIndex = Math.max(0, orderedIds.indexOf(value));
    const nextId = orderedIds[(currentIndex + direction + orderedIds.length) % orderedIds.length];
    onChange(nextId);
  };

  return (
    <label className="color-scheme-select" data-tooltip={activeScheme.summary}>
      <span><Palette size={13} /> Color scheme</span>
      <div className="color-scheme-select__control">
        <i aria-hidden="true" style={{ background: activeScheme.colors.accent }} />
        <select
          value={value}
          onChange={(event) => onChange(event.target.value as ColorSchemeId)}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              shiftScheme(1);
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              shiftScheme(-1);
            }
          }}
          aria-label="Color scheme"
          data-tooltip={`${activeScheme.name}: ${activeScheme.summary}`}
        >
          {groupedSchemes.map((group) => (
            <optgroup key={group.category} label={group.category}>
              {group.items.map((scheme) => (
                <option key={scheme.id} value={scheme.id}>{scheme.name}</option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>
    </label>
  );
}
