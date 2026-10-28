"use client";
import dynamic from "next/dynamic";
import type { WindowState } from "@/lib/store";
const Files = dynamic(() => import("./apps/files"));
const Editor = dynamic(() => import("./apps/editor"));
const Terminal = dynamic(() => import("./apps/terminal"));
const Settings = dynamic(() => import("./apps/settings"));

export function Application({ win }: { win: WindowState }) {
  switch (win.app) {
    case "files":
      return <Files win={win} />;
    case "editor":
      return <Editor win={win} />;
    case "terminal":
      return <Terminal />;
    case "settings":
      return <Settings />;
  }
}
