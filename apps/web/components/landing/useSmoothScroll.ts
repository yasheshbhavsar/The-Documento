"use client";

/**
 * Native hardware-accelerated browser scrolling is used instead of main-thread
 * wheel interception (Lenis) to guarantee zero input lag and 60/120Hz responsiveness.
 */
export function useSmoothScroll(_active: boolean = true) {
  // Intentionally a lightweight no-op so native compositor scrolling runs unimpeded.
}
