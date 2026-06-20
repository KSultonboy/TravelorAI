import type { ReactNode } from "react";
import Reveal from "./Reveal";

/* eslint-disable @next/next/no-img-element */
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
      <div className="mkt-phero__bg">
        <img src={image} alt="" aria-hidden="true" />
      </div>
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
