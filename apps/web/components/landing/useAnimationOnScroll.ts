"use client";

import { useEffect } from "react";

export function useAnimationOnScroll(
  selector = ".animate-on-scroll",
  once = true,
  trigger?: unknown
) {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const elements = new Set<HTMLElement>();
    const reducedMotion =
      typeof window.matchMedia === "function"
        ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
        : false;

    if (reducedMotion || !("IntersectionObserver" in window)) {
      document.querySelectorAll<HTMLElement>(selector).forEach((el) => {
        el.classList.add("animate");
      });
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const el = entry.target as HTMLElement;

          if (entry.isIntersecting) {
            el.classList.add("animate");
            if (once) observer.unobserve(el);
          } else if (!once) {
            el.classList.remove("animate");
          }
        });
      },
      {
        threshold: 0.02,
        rootMargin: "40px 0px 0px 0px",
      }
    );

    const scan = () => {
      document.querySelectorAll<HTMLElement>(selector).forEach((el) => {
        if (elements.has(el)) return;
        elements.add(el);

        const rect = el.getBoundingClientRect();
        if (rect.top < window.innerHeight * 0.98 && rect.bottom > 0) {
          el.classList.add("animate");
        } else {
          observer.observe(el);
        }
      });
    };

    scan();
    (window as unknown as Record<string, unknown>).initInViewAnimations = scan;

    return () => {
      observer.disconnect();
      elements.clear();
    };
  }, [selector, once, trigger]);
}
