"use client";

import { useEffect, useRef } from "react";

/**
 * Custom React hook for triggering on-scroll element animations via IntersectionObserver.
 * Configured specifically for the public landing page with automatic mutation detection,
 * viewport pre-check, and trigger change re-scans to prevent blank pages upon re-mount/sign-out.
 *
 * @param selector CSS selector for animated elements (defaults to ".animate-on-scroll")
 * @param once Whether the animation should only run once upon entering the viewport (default: true)
 * @param trigger Optional dependency value (e.g. currentUser) that causes re-scanning when changed
 */
export function useAnimationOnScroll(
  selector: string = ".animate-on-scroll",
  once: boolean = true,
  trigger?: any
) {
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Helper to reveal elements that are already in view or above the fold
    const scanAndReveal = () => {
      const elements = document.querySelectorAll<HTMLElement>(selector);
      if (elements.length === 0) return;

      // Fallback if IntersectionObserver is not supported
      if (!("IntersectionObserver" in window)) {
        elements.forEach((el) => {
          el.classList.add("animate");
        });
        return;
      }

      const windowHeight = window.innerHeight || document.documentElement.clientHeight;

      elements.forEach((el) => {
        if (el.classList.contains("animate")) return;

        const rect = el.getBoundingClientRect();
        // If element is already visible or above the viewport, reveal immediately
        if ((rect.top <= windowHeight * 0.96 && rect.bottom >= 0) || (rect.bottom < 0 && rect.top < 0)) {
          el.classList.add("animate");
          if (once && observerRef.current) {
            observerRef.current.unobserve(el);
          }
        } else if (observerRef.current) {
          observerRef.current.observe(el);
        }
      });
    };

    // Initialize IntersectionObserver if supported
    if ("IntersectionObserver" in window) {
      observerRef.current = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add("animate");
              if (once && observerRef.current) {
                observerRef.current.unobserve(entry.target);
              }
            } else if (!once) {
              entry.target.classList.remove("animate");
            }
          });
        },
        {
          threshold: 0.05,
          rootMargin: "0px 0px 50px 0px",
        }
      );
    }

    // Immediate initial scan
    scanAndReveal();

    // Debounced scan for DOM mutations and layout changes
    let debounceTimer: any = null;
    const scheduleScan = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        scanAndReveal();
      }, 40);
    };

    // Watch for DOM mutations (e.g. landing page remounting upon sign-out)
    let mutationObserver: MutationObserver | null = null;
    if ("MutationObserver" in window) {
      mutationObserver = new MutationObserver(() => {
        scheduleScan();
      });
      mutationObserver.observe(document.body, {
        childList: true,
        subtree: true,
      });
    }

    // Scroll and resize listener fallback
    window.addEventListener("scroll", scheduleScan, { passive: true });
    window.addEventListener("resize", scheduleScan, { passive: true });

    // Expose init helper globally for immediate external triggers (e.g. handleLogout)
    (window as any).initInViewAnimations = (customSelector: string = selector) => {
      scanAndReveal();
    };

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      window.removeEventListener("scroll", scheduleScan);
      window.removeEventListener("resize", scheduleScan);
      if (mutationObserver) {
        mutationObserver.disconnect();
      }
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }
    };
  }, [selector, once, trigger]);
}
