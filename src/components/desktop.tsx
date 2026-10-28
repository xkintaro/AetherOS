"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Bell, Monitor } from "lucide-react";
import { appIds, appNames, useOS, type AppId } from "@/lib/store";
import { OSWindow, requestClose } from "./os-window";
import { AppIcon, Brand } from "./icons";
import { StartMenu } from "./start-menu";
import { Wallpaper } from "./wallpaper";
import { DesktopFiles } from "./desktop-files";
import { themeAccent } from "@/lib/theme";
import { DesktopClock } from "./desktop-clock";
import { STORAGE_ERROR_EVENT } from "@/lib/storage";
import { constrainRect, windowMinimums } from "@/lib/window-geometry";

export function Desktop() {
  const [ready, setReady] = useState(false);
  const [panel, setPanel] = useState<"search" | "notifications" | null>(null);
  const startButton = useRef<HTMLButtonElement>(null);
  const windows = useOS((s) => s.windows);
  const activeId = useOS((s) => s.activeId);
  const workspace = useOS((s) => s.workspace);
  const theme = useOS((s) => s.theme);
  const accentColor = useOS((s) => s.accentColor);
  useLayoutEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = theme;
    root.classList.toggle("dark", theme === "dark");
    for (const [key, value] of Object.entries(
      themeAccent(accentColor, theme),
    )) {
      root.style.setProperty(key, value);
    }
  }, [theme, accentColor]);
  const notices = useOS((s) => s.notices);
  const active = windows.find((w) => w.id === activeId);
  const visible = windows.filter(
    (w) => w.workspace === workspace && !w.minimized,
  );

  useEffect(() => {
    let mounted = true;
    const boot = () => {
      if (!mounted) return;
      setReady(true);
    };
    if (useOS.persist.hasHydrated()) boot();
    else Promise.resolve(useOS.persist.rehydrate()).finally(boot);
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const report = () =>
      useOS
        .getState()
        .notify(
          "Workspace not saved",
          "Browser storage is unavailable or full. Export a backup before closing this page.",
        );
    window.addEventListener(STORAGE_ERROR_EVENT, report);
    return () => window.removeEventListener(STORAGE_ERROR_EVENT, report);
  }, []);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const state = useOS.getState();
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPanel((current) => (current === "search" ? null : "search"));
      }
      if (event.key === "Escape") setPanel(null);
      if (event.altKey && event.key === "`") {
        event.preventDefault();
        const windows = state.windows
          .filter((w) => w.workspace === state.workspace)
          .sort((a, b) => b.z - a.z);
        if (windows.length) state.focus(windows[1]?.id ?? windows[0].id);
      }
      if (event.altKey && event.key.toLowerCase() === "w" && state.activeId) {
        event.preventDefault();
        requestClose(state.activeId);
      }
      if (event.ctrlKey && event.altKey && ["1", "2"].includes(event.key)) {
        event.preventDefault();
        state.setWorkspace(Number(event.key) - 1);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    const constrainWindows = () => {
      for (const win of useOS.getState().windows) {
        const viewport = {
          width: window.innerWidth,
          height: window.innerHeight,
        };
        useOS.getState().updateWindow(win.id, {
          ...constrainRect(win, viewport, windowMinimums[win.app]),
          restore: win.restore
            ? constrainRect(win.restore, viewport, windowMinimums[win.app])
            : undefined,
        });
      }
    };
    window.addEventListener("resize", constrainWindows);
    if (ready) constrainWindows();
    return () => window.removeEventListener("resize", constrainWindows);
  }, [ready]);

  function launch(app: AppId, fileId?: string) {
    useOS.getState().openApp(app, fileId);
    setPanel(null);
  }
  if (!ready)
    return (
      <div className="boot-screen">
        <Brand size={42} />
        <span>AetherOS</span>
      </div>
    );

  return (
    <main className="desktop">
      <Wallpaper />
      <header className="topbar">
        <div className="topbar-left">
          <span className="desktop-brand" aria-label="AetherOS">
            <Brand size={21} />
          </span>
          <span className="topbar-app">
            {active?.title.replace(" •", "") ?? "AetherOS"}
          </span>
        </div>
        <div className="topbar-right">
          {notices.length > 0 && (
            <button
              className="topbar-icon notification-icon"
              aria-label={`Notifications (${notices.length})`}
              onClick={() =>
                setPanel(panel === "notifications" ? null : "notifications")
              }
            >
              <Bell size={16} />
              <i />
            </button>
          )}
          <DesktopClock />
        </div>
      </header>
      <DesktopFiles onInteract={() => setPanel(null)} />
      {windows.map((win) => (
        <OSWindow
          key={win.id}
          win={win}
          active={activeId === win.id}
          hidden={win.minimized || win.workspace !== workspace}
        />
      ))}
      <footer
        className={`dock-region ${panel === "search" ? "menu-open" : ""}`}
      >
        <nav className="workspace-switcher" aria-label="Workspaces">
          {[0, 1].map((number) => (
            <button
              key={number}
              className={workspace === number ? "current" : ""}
              aria-label={`Workspace ${number + 1}`}
              aria-pressed={workspace === number}
              onClick={() => useOS.getState().setWorkspace(number)}
            >
              <span>{String(number + 1).padStart(2, "0")}</span>
              {number === workspace && <i />}
            </button>
          ))}
        </nav>
        <nav className="dock" aria-label="Applications">
          <button
            ref={startButton}
            className={`dock-item start-button ${panel === "search" ? "start-active" : ""}`}
            aria-label="Start"
            aria-haspopup="dialog"
            aria-expanded={panel === "search"}
            aria-controls="start-menu"
            onClick={() => {
              setPanel(panel === "search" ? null : "search");
            }}
          >
            <span className="start-icon" aria-hidden="true">
              <span />
              <span />
              <span />
              <span />
            </span>
            <span className="dock-tooltip">Start</span>
          </button>
          <div className="dock-divider" aria-hidden="true" />
          {appIds.map((app) => (
            <button
              key={app}
              className={`dock-item ${active?.app === app ? "dock-selected" : ""}`}
              aria-label={`Open ${appNames[app]}`}
              onClick={() => {
                setPanel(null);
                const state = useOS.getState();
                const appWindows = state.windows
                  .filter((win) => win.app === app)
                  .sort((a, b) => b.z - a.z);
                const existing =
                  appWindows.find((win) => win.id === state.activeId) ??
                  appWindows.find((win) => win.workspace === state.workspace) ??
                  appWindows[0];
                if (existing) {
                  if (
                    existing.id === state.activeId &&
                    !existing.minimized &&
                    existing.workspace === state.workspace
                  ) {
                    state.updateWindow(existing.id, { minimized: true });
                  } else {
                    state.setWorkspace(existing.workspace);
                    state.focus(existing.id);
                  }
                } else launch(app);
              }}
            >
              <AppIcon app={app} size={25} />
              <span className="dock-tooltip">{appNames[app]}</span>
              <span
                className={`running-dot ${windows.some((win) => win.app === app) ? "running" : ""}`}
              />
            </button>
          ))}
        </nav>
        {visible.length > 0 && (
          <button
            className="show-desktop"
            aria-label="Show desktop"
            onClick={() => {
              visible.forEach((win) =>
                useOS.getState().updateWindow(win.id, { minimized: true }),
              );
            }}
          >
            <Monitor size={16} />
          </button>
        )}
      </footer>
      {panel && (
        <div className="panel-dismiss" onPointerDown={() => setPanel(null)} />
      )}
      {panel === "search" && (
        <StartMenu
          onLaunch={launch}
          onClose={() => {
            setPanel(null);
            startButton.current?.focus();
          }}
        />
      )}
      {panel === "notifications" && (
        <section
          className="floating-panel notification-panel"
          aria-label="Notification center"
        >
          <div className="panel-title">
            <span>Notifications</span>
            <button
              onClick={() => {
                useOS.getState().clearNotices();
                setPanel(null);
              }}
            >
              Clear all
            </button>
          </div>
          {notices.map((notice) => (
            <article className="notice" key={notice.id}>
              <Brand size={18} />
              <div>
                <strong>{notice.title}</strong>
                <p>{notice.message}</p>
                <small>
                  {new Date(notice.time).toLocaleTimeString("en-GB", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </small>
              </div>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}
