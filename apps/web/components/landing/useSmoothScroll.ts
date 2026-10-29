"use client";

import { useEffect } from "react";

/**
 * Custom React hook for buttery-smooth inertia scrolling powered by Lenis.
 * Strictly active ONLY when on the landing page (active === true).
 * When the user logs in or leaves the landing page, Lenis is cleanly destroyed
 * and native scrolling behavior is immediately restored.
 *
 * @param active Whether smooth scrolling should be active (e.g. !currentUser)
 */
export function useSmoothScroll(active: boolean = true) {
  useEffect(() => {
    // Only run on client with window & matchMedia support
    if (!active || typeof window === "undefined" || !window.matchMedia) {
      return;
    }

    // Respect user's accessibility preference for reduced motion
    try {
      const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (prefersReducedMotion) {
        return;
      }
    } catch {
      // In non-standard environments, continue or fallback
    }

    let lenisInstance: any = null;
    let rafId: number | null = null;
    let isCancelled = false;

    // Dynamically import Lenis to prevent SSR overhead
    import("lenis")
      .then(({ default: Lenis }) => {
        if (isCancelled) return;

        try {
          lenisInstance = new Lenis({
            duration: 1.15,
            easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
            orientation: "vertical",
            gestureOrientation: "vertical",
            smoothWheel: true,
            touchMultiplier: 1.5,
          });

          const raf = (time: number) => {
            if (lenisInstance) {
              lenisInstance.raf(time);
              rafId = requestAnimationFrame(raf);
            }
          };

          rafId = requestAnimationFrame(raf);
        } catch {
          // Graceful fallback to native scrolling if unsupported
        }
      })
      .catch(() => {
        // Silently fallback if module cannot load
      });

    return () => {
      isCancelled = true;
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      if (lenisInstance) {
        try {
          lenisInstance.destroy();
        } catch {
          // ignore cleanup errors
        }
        lenisInstance = null;
      }
      // Ensure html/body classes are cleaned up
      if (typeof document !== "undefined") {
        document.documentElement.classList.remove(
          "lenis",
          "lenis-smooth",
          "lenis-scrolling",
          "lenis-stopped"
        );
        document.body.classList.remove(
          "lenis",
          "lenis-smooth",
          "lenis-scrolling",
          "lenis-stopped"
        );
      }
    };
  }, [active]);
}

