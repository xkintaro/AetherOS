"use client";
import { useState, useRef } from "react";
import { Monitor, Keyboard, HardDrive, Download, Upload } from "lucide-react";
import { useOS } from "@/lib/store";
import { Appearance } from "./appearance";

export default function Settings() {
  const files = useOS((state) => state.files);
  const [tab, setTab] = useState("appearance");
  const input = useRef<HTMLInputElement>(null);
  function backup() {
    const blob = new Blob(
      [JSON.stringify({ version: 3, files: useOS.getState().files }, null, 2)],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "aetheros-backup.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    useOS.getState().notify("Backup exported", "Workspace downloaded as JSON.");
  }
  return (
    <div className="settings-app">
      <aside className="app-sidebar">
        <span className="sidebar-label">YOUR AETHEROS</span>
        {[
          ["appearance", "Appearance", Monitor],
          ["keyboard", "Keyboard", Keyboard],
          ["storage", "Storage & backup", HardDrive],
        ].map(([id, title, Icon]) => {
          const I = Icon as typeof Monitor;
          return (
            <button
              className={tab === id ? "selected" : ""}
              key={String(id)}
              onClick={() => setTab(String(id))}
            >
              <I size={16} />
              {String(title)}
            </button>
          );
        })}
      </aside>
      <section className="settings-main">
        {tab === "appearance" ? (
          <Appearance />
        ) : tab === "keyboard" ? (
          <>
            <h2>Keyboard shortcuts</h2>

            {[
              ["Find an app or file", "Ctrl / ⌘ + K"],
              ["Save a document", "Ctrl / ⌘ + S"],
              ["Switch windows", "Alt + `"],
              ["Close active window", "Alt + W"],
              ["Workspace 1 / 2", "Ctrl + Alt + 1 / 2"],
              ["Close panels", "Esc"],
            ].map(([label, key]) => (
              <div className="shortcut-row" key={label}>
                <span>{label}</span>
                <kbd>{key}</kbd>
              </div>
            ))}
          </>
        ) : (
          <>
            <h2>Storage & backup</h2>
            <div className="storage-card">
              <HardDrive size={30} />
              <div>
                <strong>Local workspace</strong>
                <p>
                  {files.length} items ·{" "}
                  {new Blob([JSON.stringify(files)]).size.toLocaleString()}{" "}
                  bytes
                </p>
              </div>
            </div>
            <p className="storage-warning">
              Clearing browser site data deletes these files. Export a backup to
              keep a copy.
            </p>
            <div className="backup-buttons">
              <button className="primary" onClick={backup}>
                <Download size={16} />
                Export backup
              </button>
              <button
                className="small-button"
                onClick={() => input.current?.click()}
              >
                <Upload size={16} />
                Restore backup
              </button>
            </div>
            <input
              hidden
              ref={input}
              type="file"
              accept="application/json,.json"
              onChange={async (e) => {
                const f = e.currentTarget.files?.[0];
                e.currentTarget.value = "";
                if (!f) return;
                if (f.size > 5_000_000) {
                  useOS
                    .getState()
                    .notify(
                      "Backup too large",
                      "Choose a backup smaller than 5 MB.",
                    );
                  return;
                }
                if (
                  !window.confirm(
                    "Replace the current workspace with this backup? Export your current files first if you need them.",
                  )
                )
                  return;
                try {
                  if (
                    !useOS.getState().importBackup(JSON.parse(await f.text()))
                  )
                    throw new Error();
                } catch {
                  useOS
                    .getState()
                    .notify(
                      "Could not restore",
                      "This file is not a valid AetherOS backup.",
                    );
                }
              }}
            />
          </>
        )}
      </section>
    </div>
  );
}
