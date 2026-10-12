import { useCallback, useRef, useState } from "react";
import { githubUser, pinnedRepos } from "./data/portfolio";
import { loadRepos, rankRepos, type Repo } from "./lib/github";

export type RepoState = { status: "idle" | "loading" | "ready" | "error"; repos: Repo[]; error: string };

/** Lazy: nothing is requested until `request()` is called (first visit to Projects, the
 * archive, the résumé or the palette), so visitors who stop at the intro cost no API calls. */
export function useRepos() {
  const [state, setState] = useState<RepoState>({ status: "idle", repos: [], error: "" });
  const started = useRef(false);
  const request = useCallback(() => {
    if (started.current) return;
    started.current = true;
    setState(value => ({ ...value, status: "loading" }));
    loadRepos(githubUser)
      .then(repos => setState({ status: "ready", repos: rankRepos(repos, pinnedRepos), error: "" }))
      .catch((error: unknown) => { started.current = false; setState({ status: "error", repos: [], error: error instanceof Error ? error.message : "network error" }); });
  }, []);
  return { ...state, request };
}
