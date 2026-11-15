/**
 * HALO cover banner (Notion-style): full-bleed, scrolls away with the page.
 * The artwork is AI-generated (visible watermark bottom-right is kept as required
 * by the Space Apps SI rules); the page fades it into the app background.
 */
import React from 'react';

export const HaloCover: React.FC<{ className?: string }> = ({ className = '' }) => (
  <section
    aria-label="HALO cover"
    className={`halo-cover relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] w-screen overflow-hidden ${className}`}
  >
    <img
      src="/brand/halo-cover.jpg"
      alt="HALO: a health companion for deep space. AI-generated artwork."
      className="halo-cover-img"
      width={2048}
      height={768}
      decoding="async"
      fetchPriority="high"
    />
    <div className="halo-cover-fade" aria-hidden />
  </section>
);

export default HaloCover;
