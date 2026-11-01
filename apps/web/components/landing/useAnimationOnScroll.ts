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

    if (reducedMotion) {
      document.querySelectorAll<HTMLElement>(selector).forEach((el) => {
        el.classList.add("animate");
      });
      return;
    }

    if (!("IntersectionObserver" in window)) {
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
        threshold: 0.03,
        rootMargin: "0px 0px -15px 0px",
      }
    );

    const scan = () => {
      document.querySelectorAll<HTMLElement>(selector).forEach((el) => {
        if (elements.has(el)) return;

        elements.add(el);

        const rect = el.getBoundingClientRect();

        if (rect.top < window.innerHeight * 0.96 && rect.bottom > 0) {
          el.classList.add("animate");
        } else {
          observer.observe(el);
        }
      });
    };

    scan();

    (window as any).initInViewAnimations = scan;

    let mutationObserver: MutationObserver | null = null;
    if ("MutationObserver" in window) {
      mutationObserver = new MutationObserver(scan);
      mutationObserver.observe(document.body, {
        childList: true,
        subtree: true,
      });
    }

    // 60fps Cursor-Tracking Border & Surface Spotlight across Bento Grids (.spotlight-card)
    let rafId: number | null = null;
    let lastClientX = -9999;
    let lastClientY = -9999;

    const updateSpotlightCards = () => {
      rafId = null;
      const cards = document.querySelectorAll<HTMLElement>(".spotlight-card");
      const vh = window.innerHeight || 900;
      cards.forEach((card) => {
        const rect = card.getBoundingClientRect();
        // Only update cards near or inside the viewport for 60fps efficiency
        if (rect.bottom < -120 || rect.top > vh + 120) return;
        const x = lastClientX - rect.left;
        const y = lastClientY - rect.top;
        card.style.setProperty("--mouse-x", `${x.toFixed(1)}px`);
        card.style.setProperty("--mouse-y", `${y.toFixed(1)}px`);
      });
    };

    const handlePointerMove = (e: PointerEvent) => {
      lastClientX = e.clientX;
      lastClientY = e.clientY;
      if (rafId === null) {
        rafId = requestAnimationFrame(updateSpotlightCards);
      }
    };

    const handleScroll = () => {
      if (lastClientX > -1000 && rafId === null) {
        rafId = requestAnimationFrame(updateSpotlightCards);
      }
    };

    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      observer.disconnect();
      if (mutationObserver) mutationObserver.disconnect();
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("scroll", handleScroll);
      if (rafId !== null) cancelAnimationFrame(rafId);
      elements.clear();
    };
  }, [selector, once, trigger]);
}
