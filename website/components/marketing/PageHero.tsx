import type { ReactNode } from "react";
import Reveal from "./Reveal";

export default function PageHero({
  eyebrow,
  title,
  subtitle,
  image,
  children,
}: {
  eyebrow?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  image: string;
  children?: ReactNode;
}) {
  return (
    <section className="mkt-phero">
      {/* CSS background (not <img>) so Next.js prefetch never link-preloads it. */}
      <div className="mkt-phero__bg" aria-hidden="true" style={image ? { backgroundImage: `url("${image}")` } : undefined} />
      <div className="mkt-phero__scrim" aria-hidden="true" />
      <div className="mkt-wrap">
        <Reveal>
          {eyebrow ? <span className="mkt-eyebrow mkt-hero__eyebrow">{eyebrow}</span> : null}
          <h1>{title}</h1>
          {subtitle ? <p>{subtitle}</p> : null}
          {children}
        </Reveal>
      </div>
    </section>
  );
}
