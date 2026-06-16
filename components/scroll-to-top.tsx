"use client";

import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";

export function ScrollToTop() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const toggleVisibility = () => {
      if (window.scrollY > 400) {
        setIsVisible(true);
      } else {
        setIsVisible(false);
      }
    };

    window.addEventListener("scroll", toggleVisibility, { passive: true });
    return () => window.removeEventListener("scroll", toggleVisibility);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  if (!isVisible) return null;

  return (
    <button
      type="button"
      onClick={scrollToTop}
      className="fixed bottom-6 right-6 z-40 bg-background/80 backdrop-blur-md border border-border/50 hover:border-foreground/30 text-muted-foreground hover:text-foreground w-9 h-9 rounded-full flex items-center justify-center transition-all duration-300 shadow-md focus:outline-none focus:ring-1 focus:ring-ring animate-fade-in cursor-pointer"
      aria-label="Scroll to top"
    >
      <ArrowUp className="h-4 w-4" />
    </button>
  );
}
