"use client";

import { useEffect } from "react";

/**
 * Custom React hook for triggering on-scroll element animations via IntersectionObserver.
 * Configured specifically for the public landing page.
 *
 * @param selector CSS selector for animated elements (defaults to ".animate-on-scroll")
 * @param once Whether the animation should only run once upon entering the viewport (default: true)
 */
export function useAnimationOnScroll(selector: string = ".animate-on-scroll", once: boolean = true) {
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Fallback for environments lacking IntersectionObserver (or headless test runs)
    if (!("IntersectionObserver" in window)) {
      document.querySelectorAll(selector).forEach((el) => {
        el.classList.add("animate");
      });
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("animate");
            if (once) {
              observer.unobserve(entry.target);
            }
          } else if (!once) {
            entry.target.classList.remove("animate");
          }
        });
      },
      {
        threshold: 0.15,
        rootMargin: "0px 0px -8% 0px",
      }
    );

    const elements = document.querySelectorAll(selector);
    elements.forEach((el) => observer.observe(el));

    // Expose init helper globally for dynamic DOM elements if needed
    (window as any).initInViewAnimations = (customSelector: string = selector) => {
      document.querySelectorAll(customSelector).forEach((el) => observer.observe(el));
    };

    return () => {
      observer.disconnect();
    };
  }, [selector, once]);
}
