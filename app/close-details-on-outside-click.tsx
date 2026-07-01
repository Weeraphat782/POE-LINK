"use client";

import { useEffect } from "react";

// <details> only closes via its own <summary>. This closes any open one
// when you click elsewhere on the page.
export function CloseDetailsOnOutsideClick() {
  useEffect(() => {
    function handleClick(event: MouseEvent) {
      document.querySelectorAll("details[open]").forEach((el) => {
        if (!el.contains(event.target as Node)) el.removeAttribute("open");
      });
    }
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  return null;
}
