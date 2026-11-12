// Copyright (c) 2026 Vassel Goleyu. All rights reserved.
import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { filterRepos, languageStats, parseRepos, rankRepos, timeAgo } from "../../src/lib/github";
import { rankCommands, scoreCommand } from "../../src/lib/palette";
import { overlayHash, parseOverlay } from "../../src/lib/deeplink";
import { journeyAt, scrollAt } from "../../src/scene/journey";
import { achievements, cameraStops, experiences, projectShowcase, resolveChapterId } from "../../src/data/portfolio";

const api = [
  { name: "sellebeww", html_url: "https://github.com/sellebeww/sellebeww" },
  { name: "old", html_url: "https://github.com/sellebeww/old", language: "PHP", pushed_at: "2025-01-01T00:00:00Z", topics: ["laravel", 5] },
  { name: "fork", html_url: "https://github.com/sellebeww/fork", fork: true },
  { name: "bad", html_url: "https://github.com/sellebeww/bad", homepage: "javascript:alert(1)", language: "TypeScript", pushed_at: "2026-10-09T00:00:00Z" },
  { html_url: "https://github.com/x/y" },
];

describe("github", () => {
  const repos = parseRepos(api, "sellebeww");
  it("drops profile repo, forks and malformed rows, and refuses non-https links", () => {
    expect(repos.map(repo => repo.name)).toEqual(["old", "bad"]);
    expect(repos[1].homepage).toBeNull();
    expect(repos[0].topics).toEqual(["laravel"]);
  });
  it("rejects a rate-limit error object", () => expect(() => parseRepos({ message: "rate limited" }, "u")).toThrow());
  it("ranks pinned first, then by latest push, without mutating", () => {
    expect(rankRepos(repos, ["OLD"]).map(repo => repo.name)).toEqual(["old", "bad"]);
    expect(rankRepos(repos).map(repo => repo.name)).toEqual(["bad", "old"]);
    expect(repos.map(repo => repo.name)).toEqual(["old", "bad"]);
  });
  it("counts languages and filters case-insensitively", () => {
    expect(languageStats(repos)).toEqual([{ language: "PHP", count: 1 }, { language: "TypeScript", count: 1 }]);
    expect(filterRepos(repos, "LARAVEL", null)).toHaveLength(1);
  });
  it("labels time with an injectable clock", () => {
    const now = Date.parse("2026-10-10T00:00:00Z");
    expect(timeAgo("2026-10-10T00:00:00Z", now)).toBe("today");
    expect(timeAgo("2026-10-07T00:00:00Z", now)).toBe("3 days ago");
    expect(timeAgo("nonsense", now)).toBe("");
  });
});

describe("command palette", () => {
  const commands = [
    { id: "a", group: "Go to", label: "Projects", run() {} },
    { id: "b", group: "Open", label: "Résumé", keywords: "cv", run() {} },
  ];
  it("scores exact over prefix over loose matches and drops non-matches", () => {
    expect(scoreCommand("projects", commands[0])).toBeGreaterThan(scoreCommand("proj", commands[0]));
    expect(scoreCommand("zzz", commands[0])).toBe(0);
  });
  it("finds a command through its keywords", () => expect(rankCommands("cv", commands).map(command => command.id)).toEqual(["b"]));
});

describe("deep links", () => {
  const roleIds = experiences.map(role => role.id);
  it("round-trips every role photo and certificate", () => {
    for (const role of experiences) for (let photo = 0; photo < role.photos.length; photo++) {
      const overlay = { kind: "role", id: role.id, photo } as const;
      expect(parseOverlay(overlayHash(overlay), roleIds, achievements.length, { [role.id]: role.photos.length })).toEqual(overlay);
    }
    for (let index = 0; index < achievements.length; index++) {
      const overlay = { kind: "certificates", initial: index } as const;
      expect(parseOverlay(overlayHash(overlay), roleIds, achievements.length)).toEqual(overlay);
    }
  });
  it("ignores unknown hashes and out-of-range numbers", () => {
    expect(parseOverlay("#nope", roleIds, 9)).toBeNull();
    expect(parseOverlay("#certificate/99", roleIds, 9)).toBeNull();
    expect(parseOverlay("#role/missing", roleIds, 9)).toBeNull();
  });
  it("keeps old chapter bookmarks working", () => {
    expect(resolveChapterId("profile")).toBe("intro");
    expect(resolveChapterId("tech-stack")).toBe("stack");
    expect(resolveChapterId("unknown")).toBeUndefined();
  });
});

describe("journey", () => {
  it("scroll and journey positions are inverse at every camera stop", () => {
    for (const stop of cameraStops) expect(journeyAt(scrollAt(stop.start))).toBeCloseTo(stop.start, 3);
  });
});

describe("portfolio data", () => {
  it("has unique ids and repositories", () => {
    expect(new Set(experiences.map(role => role.id)).size).toBe(experiences.length);
    expect(new Set(projectShowcase.map(project => project.repo.toLowerCase())).size).toBe(projectShowcase.length);
  });
  it("only references images that exist in public/", () => {
    const files = [
      ...experiences.flatMap(role => role.photos.map(photo => `public/images/experience/${role.id}/${photo}`)),
      ...projectShowcase.flatMap(project => project.shots.map(shot => `public${shot}`)),
    ];
    expect(files.filter(file => !existsSync(file))).toEqual([]);
  });
});
