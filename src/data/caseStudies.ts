/** Case studies for the repositories that carry the most engineering. Every statement below is taken from the
 * repository's own README (read 2026-11-12); nothing is added from memory. The READMEs of Hak Data and APEX GYM are in
 * Indonesian and are rendered here in English. Personal fields (`role`, team size, what was owned) are not in the
 * READMEs, so they are left as TODO(vassel) instead of being guessed; the card hides them until they are filled in. */
export interface CaseStudy {
  slug: string;
  repo: string;
  title: string;
  /** One line a recruiter can read in two seconds. */
  tagline: string;
  /** The status the README itself claims, kept next to the title so a claim never travels without its limit. */
  status: string;
  problem: string;
  approach: readonly string[];
  evidence: readonly string[];
  limits: string;
  stack: readonly string[];
  demo?: string;
  /** TODO(vassel): your role and what you personally owned in each project (not stated in the READMEs). */
  role?: string;
}

export const caseStudies: readonly CaseStudy[] = [
  {
    slug: "assay-evm", repo: "assay-evm", title: "Assay", status: "No release yet; install from a clone",
    tagline: "Checks whether a Solidity vulnerability patch really closes the hole, or only passes the tests that already existed.",
    problem: "A patch that makes the test suite pass is not necessarily a fix: it can stop the reported exploit and leave a close variant open, switch off behaviour the contract exists for, or change storage layout, ABI or events.",
    approach: [
      "Runs the exploit, a bounded search for variants, the benign tests and an interface comparison against the patched code, inside a Docker sandbox built on Foundry.",
      "Five deterministic oracles (integrity, exploit, variant, behavior, regression) decide the verdict; a model, if used, only proposes patches.",
      "Produces a replayable evidence bundle and a one-file HTML report with no JavaScript.",
    ],
    evidence: [
      "The overfit demo shows a patch that stops the original exploit and passes all benign tests being REJECTED because a variant is found.",
      "Untrusted code runs only in a container with no network; `make test-security` checks several of these properties against the real image.",
    ],
    limits: "A verdict is not a proof of correctness: a bounded search cannot show absence. It judges patches and does not look for new bugs. Measured results use small samples and are not an independent benchmark.",
    stack: ["Python", "Foundry", "Docker", "Slither"],
  },
  {
    slug: "paper-trail", repo: "paper-trail", title: "Paper Trail", status: "v0.1.0, pre-alpha",
    tagline: "A tamper-evident evidence notebook for small disputes: it makes edits, deletions and backdating detectable, and anyone can verify that without trusting the app.",
    problem: "People in small disputes (unpaid overtime, a withheld deposit, an unpaid freelance invoice) keep weak records that are easy to dismiss as \"you could have written that yesterday\".",
    approach: [
      "A hash chain: every entry includes the SHA-256 of the previous one, so changing, deleting, inserting or reordering breaks every later hash.",
      "Witness co-signs: a one-time link lets a co-worker sign a specific entry with a key generated on their own device, no account needed.",
      "External time anchors: a worker sends the newest hash to an RFC 3161 time-stamping authority, so neither owner nor server can quietly move dates.",
      "An exported evidence pack verifies offline with a CLI, an in-browser page, or just Python and OpenSSL.",
    ],
    evidence: [
      "Monorepo with an API, a RabbitMQ worker (retries and dead-letter queue) and a React + Vite web app.",
      "Tested with unit, property-based, integration, chaos and browser tests, per the README.",
    ],
    limits: "Not used for a real case, not independently audited, not deployed in production. It can show an entry existed by a time and has not changed since; it cannot show an entry is true or complete.",
    stack: ["TypeScript", "React", "Vite", "PostgreSQL", "RabbitMQ", "Docker"],
  },
  {
    slug: "falsify-guardrail", repo: "falsify-guardrail", title: "Falsify", status: "Proof of concept",
    tagline: "A guardrail for generated Solidity that accepts a repair only when previously successful exploits stop succeeding.",
    problem: "A repaired contract can silence a static-analysis warning while the exploit still works. Falsify makes executable exploits, not warnings, the acceptance test.",
    approach: [
      "Combines Slither findings, independent Foundry exploit harnesses, functional tests, line and function coverage, and gas measurements.",
      "A repair passes only if every previously successful exploit fails, functional tests pass and no supplied exploit newly succeeds; missing tests and tool failures block evaluation.",
      "Ships as a reusable composite GitHub Action with SARIF output for code scanning.",
    ],
    evidence: [
      "The demo catches a repair that hides an ETH transfer in assembly (the warning disappears, the exploit still drains the vault), then accepts a checks-effects-interactions fix.",
      "Eight curated tasks (reentrancy and access control), each with functional tests, a deterministic exploit and an Echidna property.",
    ],
    limits: "UNCONFIRMED means no supplied exploit succeeded; it never means secure. The eight tasks are case studies, not a representative sample, and the results are descriptive, not statistical.",
    stack: ["Solidity", "Foundry", "Slither", "Echidna", "GitHub Actions"],
  },
  {
    slug: "hakdata", repo: "HakData", title: "Hak Data", status: "Demo; legal research not yet reviewed by a lawyer",
    tagline: "Helps people in Indonesia use their personal-data rights under the PDP Law: find the right privacy channel, send the right letter, and chase the legal deadline automatically.",
    problem: "Residents do not know where to send a request, what the letter must say, when to follow up, or how to prove the request was sent and left unanswered.",
    approach: [
      "A directory of company privacy channels with verification status and sources, and a letter builder with a template per right.",
      "Deadlines computed only from rules with an explicit figure in the law; the rule version is frozen per request. Reminders run through RabbitMQ.",
      "An append-only evidence dossier with company replies, proof of sending (message ID and SHA-256) and a Markdown export.",
    ],
    evidence: [
      "182 unit tests, 82 integration tests (real Postgres, RabbitMQ and Mailpit), 7 Playwright end-to-end tests, and a Postman collection of 33 requests with 64 assertions.",
      "Mutation check: 9 of 9 reverted fixes were caught by a failing test.",
    ],
    limits: "Not legal advice. All companies in the sample data are fictional. Known technical gaps (a web dependency advisory, in-memory login lockout, no upload antivirus) are listed in the repository's security notes.",
    stack: ["TypeScript", "Next.js", "PostgreSQL", "Prisma", "RabbitMQ", "Docker"],
  },
  {
    slug: "apex-gym", repo: "APEX-GYM", title: "APEX GYM", status: "Ready for staging; not proven for real customers",
    tagline: "One web platform for a gym: public site, member area, coach area and an admin panel.",
    problem: "A gym needs members, coaches and admins to share one system for bookings, payments, classes, check-in and progress.",
    approach: [
      "React 19, TypeScript, Vite and Tailwind frontend with a Hono API on SQLite; shared pure business rules between server and frontend.",
      "Per-role authorisation on every endpoint, HMAC-signed single-use QR check-in valid for 60 seconds, server-side prices and idempotent payment webhooks.",
      "Optimistic versioning for concurrent edits, an audit log, and CSV exports protected against formula injection.",
    ],
    evidence: [
      "Server tests run through the API with an in-memory database; Playwright end-to-end tests include axe WCAG A/AA checks.",
    ],
    limits: "Payments use a simulator; the Midtrans integration has not been run against a real sandbox. Safari and iOS are untested on devices, and there is no independent penetration test.",
    stack: ["React", "TypeScript", "Vite", "Tailwind", "Hono", "SQLite"],
    demo: "https://sellebew-apex-gym.vercel.app",
  },
];
// TODO(vassel): "MALUMALU" was requested as a case study, but no public repository with that name (or malu*) exists
// under github.com/sellebeww, so there is no README to source it from. Add it here once the repository is public.
