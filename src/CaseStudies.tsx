import { caseStudies, type CaseStudy } from "./data/caseStudies";
import { profile } from "./data/portfolio";

/** The case studies, written to be read in about a minute each: the problem, what was built, the evidence, and the
 * limits the repository itself states. Used inline in the simple version and inside a dialog in the 3D room. */
function Study({ study, Heading }: { study: CaseStudy; Heading: "h3" | "h4" }) {
  const repoUrl = `${profile.github}/${study.repo}`;
  return <article className="case-study" id={`case-${study.slug}`}>
    <Heading>{study.title}</Heading>
    <p className="case-status">{study.status}</p>
    <p className="case-tagline">{study.tagline}</p>
    <dl className="case-facts">
      <div><dt>Problem</dt><dd>{study.problem}</dd></div>
      <div><dt>What it does</dt><dd><ul>{study.approach.map(item => <li key={item}>{item}</li>)}</ul></dd></div>
      <div><dt>Evidence</dt><dd><ul>{study.evidence.map(item => <li key={item}>{item}</li>)}</ul></dd></div>
      <div><dt>Limits</dt><dd>{study.limits}</dd></div>
      {study.role && <div><dt>My role</dt><dd>{study.role}</dd></div>}
    </dl>
    <ul className="project-stack" aria-label={`${study.title} is built with`}>{study.stack.map(item => <li key={item}>{item}</li>)}</ul>
    <div className="project-links">
      {study.demo && <a className="project-link is-primary" href={study.demo} target="_blank" rel="noreferrer">Live demo <span aria-hidden="true">↗</span></a>}
      <a className="project-link" href={repoUrl} target="_blank" rel="noreferrer">Repository and README <span aria-hidden="true">↗</span></a>
    </div>
  </article>;
}

export function CaseStudyList({ level }: { level: "h3" | "h4" }) {
  return <div className="case-list">{caseStudies.map(study => <Study key={study.slug} study={study} Heading={level} />)}</div>;
}

/** Quick read: one line per study, each linking to its full text. */
export function CaseStudyIndex({ onPick }: { onPick?: (slug: string) => void }) {
  return <ul className="case-index" aria-label="Case studies at a glance">{caseStudies.map(study => <li key={study.slug}>
    <a href={`#case-${study.slug}`} onClick={onPick ? event => { event.preventDefault(); onPick(study.slug); } : undefined}><b>{study.title}</b><span>{study.tagline}</span></a>
  </li>)}</ul>;
}
