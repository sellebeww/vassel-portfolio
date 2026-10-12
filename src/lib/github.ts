export interface Repo {
  name: string;
  description: string;
  language: string | null;
  url: string;
  homepage: string | null;
  pushedAt: string;
  stars: number;
  topics: string[];
}

type ApiRepo = {
  name?: unknown; description?: unknown; language?: unknown; html_url?: unknown; homepage?: unknown;
  pushed_at?: unknown; stargazers_count?: unknown; topics?: unknown; fork?: unknown; archived?: unknown; private?: unknown;
};

const text = (value: unknown) => typeof value === "string" ? value.trim() : "";
const link = (value: unknown) => { const raw = text(value); return /^https:\/\//i.test(raw) ? raw : null; };

/** Narrow the untyped API payload; forks, archived and private entries are not portfolio work. */
export function parseRepos(payload: unknown, user: string): Repo[] {
  if (!Array.isArray(payload)) throw new Error("Unexpected GitHub response");
  return (payload as ApiRepo[]).flatMap(item => {
    const name = text(item?.name), url = link(item?.html_url);
    if (!name || !url || item.fork || item.archived || item.private) return [];
    // The profile README repository (named after the user) is not a project.
    if (name.toLowerCase() === user.toLowerCase()) return [];
    return [{
      name, url, description: text(item.description), language: text(item.language) || null, homepage: link(item.homepage),
      pushedAt: text(item.pushed_at), stars: typeof item.stargazers_count === "number" ? item.stargazers_count : 0,
      topics: Array.isArray(item.topics) ? item.topics.filter((topic): topic is string => typeof topic === "string").slice(0, 8) : [],
    }];
  });
}

/** Pinned names lead, in the order given; everything else follows by most recent push. */
export function rankRepos(repos: Repo[], pinned: readonly string[] = []): Repo[] {
  const rank = (repo: Repo) => { const index = pinned.findIndex(name => name.toLowerCase() === repo.name.toLowerCase()); return index < 0 ? Infinity : index; };
  return [...repos].sort((a, b) => rank(a) - rank(b) || Date.parse(b.pushedAt || "0") - Date.parse(a.pushedAt || "0") || a.name.localeCompare(b.name));
}

export function languageStats(repos: Repo[]) {
  const counts = new Map<string, number>();
  for (const repo of repos) if (repo.language) counts.set(repo.language, (counts.get(repo.language) ?? 0) + 1);
  return [...counts].map(([language, count]) => ({ language, count })).sort((a, b) => b.count - a.count || a.language.localeCompare(b.language));
}

export function filterRepos(repos: Repo[], query: string, language: string | null) {
  const needle = query.trim().toLowerCase();
  return repos.filter(repo => (!language || repo.language === language)
    && (!needle || `${repo.name} ${repo.description} ${repo.language ?? ""} ${repo.topics.join(" ")}`.toLowerCase().includes(needle)));
}

/** "3 days ago" style label that is stable under test through the injectable clock. */
export function timeAgo(iso: string, now = Date.now()) {
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return "";
  const days = Math.floor(Math.max(0, now - then) / 86_400_000);
  if (days < 1) return "today";
  if (days < 31) return days === 1 ? "yesterday" : `${days} days ago`;
  const months = Math.floor(days / 30.44);
  if (months < 12) return months === 1 ? "1 month ago" : `${months} months ago`;
  const years = Math.floor(days / 365.25);
  return years === 1 ? "1 year ago" : `${years} years ago`;
}

const CACHE_KEY = "vg:repos:v1", CACHE_MS = 60 * 60 * 1000;

function readCache(user: string, now: number): Repo[] | null {
  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY) ?? "null") as { user: string; at: number; repos: Repo[] } | null;
    return cached && cached.user === user && now - cached.at < CACHE_MS && Array.isArray(cached.repos) ? cached.repos : null;
  } catch { return null; }
}

/** One request per hour per browser. Unauthenticated GitHub calls are rate-limited, so failures
 * fall back to the last cached copy (however old) before surfacing an error. */
export async function loadRepos(user: string, signal?: AbortSignal): Promise<Repo[]> {
  const now = Date.now(), fresh = readCache(user, now);
  if (fresh) return fresh;
  try {
    const response = await fetch(`https://api.github.com/users/${encodeURIComponent(user)}/repos?per_page=100&sort=pushed`, { signal, headers: { Accept: "application/vnd.github+json" } });
    if (!response.ok) throw new Error(response.status === 403 ? "GitHub rate limit reached" : `GitHub responded ${response.status}`);
    const repos = parseRepos(await response.json(), user);
    try { localStorage.setItem(CACHE_KEY, JSON.stringify({ user, at: now, repos })); } catch { /* storage is optional */ }
    return repos;
  } catch (error) {
    if (signal?.aborted) throw error;
    try {
      const stale = JSON.parse(localStorage.getItem(CACHE_KEY) ?? "null") as { user: string; repos: Repo[] } | null;
      if (stale?.user === user && Array.isArray(stale.repos) && stale.repos.length) return stale.repos;
    } catch { /* ignore */ }
    throw error;
  }
}
