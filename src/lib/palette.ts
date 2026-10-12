export interface PaletteCommand {
  id: string;
  group: string;
  label: string;
  hint?: string;
  keywords?: string;
  shortcut?: string;
  run: () => void;
}

/** Score 0 means no match. Prefix and word-start hits outrank loose subsequences. */
export function scoreCommand(query: string, command: Pick<PaletteCommand, "label" | "group" | "keywords" | "hint">): number {
  const needle = query.trim().toLowerCase();
  if (!needle) return 1;
  const label = command.label.toLowerCase();
  const haystack = `${label} ${command.group} ${command.keywords ?? ""} ${command.hint ?? ""}`.toLowerCase();
  if (label === needle) return 100;
  if (label.startsWith(needle)) return 80;
  if (label.split(/[\s—·/-]+/).some(word => word.startsWith(needle))) return 60;
  if (haystack.includes(needle)) return 40;
  // Every word of a multi-word query must appear somewhere.
  const words = needle.split(/\s+/);
  if (words.length > 1 && words.every(word => haystack.includes(word))) return 30;
  // Ordered subsequence on the label ("exp" -> "Experiences", "tgl" -> "Toggle lamp").
  let at = 0;
  for (const character of needle) { at = label.indexOf(character, at) + 1; if (!at) return 0; }
  return 10;
}

/** Stable: equal scores keep the registration order so groups read naturally. */
export function rankCommands<T extends PaletteCommand>(query: string, commands: T[]): T[] {
  return commands.map((command, order) => ({ command, order, score: scoreCommand(query, command) }))
    .filter(entry => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.order - b.order)
    .map(entry => entry.command);
}
