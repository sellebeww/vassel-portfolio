import { useEffect, useId, useMemo, useRef, useState } from "react";
import { rankCommands, type PaletteCommand } from "./lib/palette";

export default function CommandPalette({ commands, onClose }: { commands: PaletteCommand[]; onClose: () => void }) {
  const [query, setQuery] = useState(""), [cursor, setCursor] = useState(0);
  const input = useRef<HTMLInputElement>(null), list = useRef<HTMLUListElement>(null);
  const id = useId(), listId = `${id}-list`;
  const results = useMemo(() => rankCommands(query, commands), [query, commands]);
  const active = Math.min(cursor, Math.max(0, results.length - 1));

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    input.current?.focus();
    const background = Array.from(document.querySelectorAll<HTMLElement>(".site > :not(.palette-shell)")).filter(element => !element.inert);
    background.forEach(element => { element.inert = true; });
    document.body.classList.add("modal-open");
    return () => { document.body.classList.remove("modal-open"); background.forEach(element => { element.inert = false; }); if (previous?.isConnected) previous.focus(); };
  }, []);
  useEffect(() => { list.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.scrollIntoView({ block: "nearest" }); }, [active, results]);

  const run = (command: PaletteCommand | undefined) => { if (!command) return; onClose(); window.setTimeout(command.run, 0); };
  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "ArrowDown") { event.preventDefault(); setCursor((active + 1) % Math.max(1, results.length)); }
    else if (event.key === "ArrowUp") { event.preventDefault(); setCursor((active - 1 + results.length) % Math.max(1, results.length)); }
    else if (event.key === "Home") { event.preventDefault(); setCursor(0); }
    else if (event.key === "End") { event.preventDefault(); setCursor(results.length - 1); }
    else if (event.key === "Enter") { event.preventDefault(); run(results[active]); }
    else if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); onClose(); }
    else if (event.key === "Tab") event.preventDefault();
  };

  let lastGroup = "";
  return (
    <div className="modal-shell palette-shell" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="palette" role="dialog" aria-modal="true" aria-label="Command palette">
        <div className="palette-input">
          <span aria-hidden="true">⌘</span>
          <input ref={input} value={query} onChange={event => { setQuery(event.target.value); setCursor(0); }} onKeyDown={onKeyDown}
            role="combobox" aria-expanded="true" aria-controls={listId} aria-autocomplete="list" aria-activedescendant={results.length ? `${id}-${active}` : undefined}
            placeholder="Jump to a chapter, open a role, change the room…" autoComplete="off" spellCheck={false} />
          <kbd>esc</kbd>
        </div>
        <ul ref={list} id={listId} role="listbox" aria-label="Commands">
          {results.map((command, index) => {
            const heading = !query && command.group !== lastGroup ? (lastGroup = command.group) : "";
            return <li key={command.id} role="presentation">
              {heading && <div className="palette-group" aria-hidden="true">{heading}</div>}
              <div id={`${id}-${index}`} role="option" aria-selected={index === active} className={index === active ? "is-active" : ""}
                onMouseMove={() => { if (index !== active) setCursor(index); }} onClick={() => run(command)}>
                <span>{command.label}{command.hint && <small>{command.hint}</small>}</span>
                {query && <em>{command.group}</em>}
                {command.shortcut && <kbd>{command.shortcut}</kbd>}
              </div>
            </li>;
          })}
          {!results.length && <li role="presentation" className="palette-empty">Nothing matches “{query}”.</li>}
        </ul>
        <footer><span><kbd>↑</kbd><kbd>↓</kbd> navigate</span><span><kbd>↵</kbd> run</span><span><kbd>1</kbd>–<kbd>6</kbd> chapters anywhere</span></footer>
      </section>
    </div>
  );
}
