"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, FileText, FolderClosed, Search } from "lucide-react";
import { filePath, isAvailable } from "@/lib/filesystem";
import { appIds, appNames, useOS, type AppId } from "@/lib/store";
import { AppIcon } from "./icons";

const descriptions: Partial<Record<AppId, string>> = {
  files: "Browse and manage files",
  editor: "Create a text document",
  settings: "Appearance, shortcuts and backups",
};

type SearchResult = {
  key: string;
  title: string;
  description?: string;
  app: AppId;
  fileId?: string;
  folder?: boolean;
};

export function StartMenu({
  onLaunch,
  onClose,
}: {
  onLaunch: (app: AppId, fileId?: string) => void;
  onClose: () => void;
}) {
  const files = useOS((state) => state.files);
  const [query, setQuery] = useState("");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const activeOption = useRef<HTMLButtonElement>(null);
  const search = query.trim().toLowerCase();
  const apps: SearchResult[] = appIds
    .filter((app) => !search || appNames[app].toLowerCase().includes(search))
    .map((app) => ({
      key: `app-${app}`,
      title: appNames[app],
      description: descriptions[app],
      app,
    }));
  const documents: SearchResult[] = search
    ? files
        .filter(
          (file) =>
            isAvailable(files, file.id) &&
            file.name.toLowerCase().includes(search),
        )
        .slice(0, 8)
        .map((file) => ({
          key: `file-${file.id}`,
          title: file.name,
          app: file.kind === "folder" ? "files" : "editor",
          fileId: file.id,
          folder: file.kind === "folder",
          description: filePath(files, file.id),
        }))
    : [];
  const results = [...apps, ...documents];
  // An unopened query has no implicit choice. Typed searches highlight the best match.
  const selected =
    results.find((result) => result.key === selectedKey) ??
    (search ? results[0] : undefined);
  const selectedIndex = selected
    ? results.findIndex((result) => result.key === selected.key)
    : -1;

  useEffect(() => {
    activeOption.current?.scrollIntoView({ block: "nearest" });
  }, [selected?.key]);

  function renderResult(result: SearchResult) {
    const isSelected = selected?.key === result.key;
    return (
      <button
        key={result.key}
        id={`start-result-${result.key}`}
        role="option"
        aria-selected={isSelected}
        tabIndex={-1}
        ref={isSelected ? activeOption : undefined}
        className={`search-result ${isSelected ? "result-selected" : ""}`}
        onClick={() => onLaunch(result.app, result.fileId)}
      >
        {result.fileId ? (
          <span className="result-file-icon">
            {result.folder ? (
              <FolderClosed size={24} />
            ) : (
              <FileText size={24} />
            )}
          </span>
        ) : (
          <AppIcon app={result.app} size={24} />
        )}
        <span className="result-copy">
          <span>{result.title}</span>
          {result.description && <small>{result.description}</small>}
        </span>
        <ArrowUpRight size={16} />
      </button>
    );
  }

  return (
    <section
      id="start-menu"
      className="floating-panel launch-panel"
      role="dialog"
      aria-label="Start menu"
      onKeyDown={(event) => {
        if (event.nativeEvent.isComposing) return;
        if (event.key === "Escape") {
          event.stopPropagation();
          event.preventDefault();
          onClose();
          return;
        }
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          event.preventDefault();
          if (!results.length) return;
          const index =
            selectedIndex < 0
              ? event.key === "ArrowDown"
                ? 0
                : results.length - 1
              : (selectedIndex +
                  (event.key === "ArrowDown" ? 1 : -1) +
                  results.length) %
                results.length;
          setSelectedKey(results[index].key);
        }
        if (event.key === "Enter") {
          event.preventDefault();
          if (selected) onLaunch(selected.app, selected.fileId);
        }
      }}
    >
      <div className="search-field">
        <Search size={20} />
        <input
          autoFocus
          role="combobox"
          aria-label="Search query"
          aria-autocomplete="list"
          aria-expanded="true"
          aria-controls="start-results"
          aria-activedescendant={
            selected ? `start-result-${selected.key}` : undefined
          }
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setSelectedKey(null);
          }}
          placeholder="Search apps and files"
        />
        <kbd>ESC</kbd>
      </div>
      <div
        id="start-results"
        className="search-results"
        role="listbox"
        aria-label="Apps and files"
      >
        {apps.length > 0 && (
          <div role="group" aria-label="Applications">
            <div className="search-section-title" aria-hidden="true">
              APPLICATIONS
            </div>
            {apps.map(renderResult)}
          </div>
        )}
        {documents.length > 0 && (
          <div role="group" aria-label="Files">
            <div className="search-section-title" aria-hidden="true">
              FILES
            </div>
            {documents.map(renderResult)}
          </div>
        )}
      </div>
      {search && !results.length && (
        <p className="search-message" role="status">
          No matches.
        </p>
      )}
      <div className="search-footer">
        <span>↑ ↓ to select</span>
        <span>{selected ? "Enter to open" : "Select an item to open"}</span>
      </div>
    </section>
  );
}
