"use client";
import { useEffect, useState } from "react";

// Isolate timer updates from the desktop, file lists and application windows.
export function DesktopClock() {
  const [clock, setClock] = useState<Date | null>(null);
  useEffect(() => {
    setClock(new Date());
    const timer = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  return (
    <time className="topbar-date" dateTime={clock?.toISOString()}>
      {clock?.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      })}
      <span>
        {clock?.toLocaleTimeString("en-GB", {
          hour: "2-digit",
          minute: "2-digit",
        })}
      </span>
    </time>
  );
}
