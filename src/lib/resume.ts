import { achievements, experiences, developmentPractices, profile, techStack } from "../data/portfolio";
import type { Repo } from "./github";

/** Plain-text résumé built only from the portfolio data, for the "Copy as text" action. */
export function resumeText(repos: Repo[] = []): string {
  const lines: string[] = [profile.name.toUpperCase(), `${profile.role} · ${profile.location}`, `${profile.email} · ${profile.github} · ${profile.linkedin}`, "", "PROFILE", profile.bio, "", "UNIVERSITY EXPERIENCE"];
  for (const role of experiences) lines.push(`${role.title} — ${role.organization} (${role.period})`, `  ${role.description}`);
  lines.push("", "ACHIEVEMENTS");
  for (const [, placement, competition, year] of achievements) lines.push(`${year} · ${placement} — ${competition}`);
  lines.push("", "TECHNOLOGY", `${techStack.map(tool => tool.name).join(", ")} · ${developmentPractices.join(", ")}`);
  if (repos.length) {
    lines.push("", "SELECTED PROJECTS (GitHub)");
    for (const repo of repos) lines.push(`${repo.name}${repo.language ? ` [${repo.language}]` : ""} — ${repo.homepage ?? repo.url}`, ...(repo.description ? [`  ${repo.description}`] : []));
  }
  return lines.join("\n");
}
