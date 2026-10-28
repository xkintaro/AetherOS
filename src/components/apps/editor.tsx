"use client";
import { useState, useEffect, useRef } from "react";
import { FileText, Check, Save } from "lucide-react";
import { useOS, type WindowState } from "@/lib/store";
import { filePath, isAvailable, DOCUMENTS_ID, HOME_ID } from "@/lib/filesystem";

export default function Editor({ win }: { win: WindowState }) {
  const file = useOS((s) => s.files.find((f) => f.id === win.fileId));
  const files = useOS((s) => s.files);
  const [text, setText] = useState(file?.content ?? "");
  const [saved, setSaved] = useState(false);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  useEffect(() => () => clearTimeout(savedTimer.current), []);
  const [name, setName] = useState("Untitled.txt");
  const baseline = useRef(file?.content ?? "");
  const textArea = useRef<HTMLTextAreaElement>(null);
  const lineNumbers = useRef<HTMLDivElement>(null);
  const [externalChange, setExternalChange] = useState(false);
  const dirty = text !== (file?.content ?? "");
  useEffect(() => {
    if (!file || file.content === baseline.current) return;
    if (text === baseline.current || text === file.content) {
      baseline.current = file.content;
      setText(file.content);
      setExternalChange(false);
    } else {
      setExternalChange(true);
    }
  }, [file?.content, text]);
  const save = () => {
    if (
      externalChange &&
      !window.confirm(
        "This file changed in another app. Replace that content with your current text?",
      )
    )
      return;
    if (file) {
      useOS.getState().saveFile(file.id, text);
    } else {
      const id = useOS
        .getState()
        .createFile(
          isAvailable(files, DOCUMENTS_ID) ? DOCUMENTS_ID : HOME_ID,
          name,
          "text",
          text,
        );
      if (!id) {
        useOS
          .getState()
          .notify(
            "Choose another name",
            "A document with that name exists, or the name is invalid.",
          );
        return;
      }
      useOS.getState().updateWindow(win.id, { fileId: id, title: name });
    }
    baseline.current = text;
    setExternalChange(false);
    setSaved(true);
    clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => setSaved(false), 1500);
  };
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (useOS.getState().activeId !== win.id) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        save();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });
  useEffect(() => {
    useOS.getState().updateWindow(win.id, {
      title: `${file?.name ?? name}${dirty ? " •" : ""}`,
    });
  }, [dirty, file?.name, name, win.id]);
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);
  return (
    <div className="editor-app" data-dirty={dirty}>
      <div className="app-toolbar">
        <FileText size={15} />
        {file ? (
          <span className="editor-path">{filePath(files, file.id)}</span>
        ) : (
          <input
            className="filename-input"
            aria-label="File name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        )}
        <div className="toolbar-spacer" />
        <span className="muted">
          {externalChange
            ? "Changed in another app"
            : dirty
              ? "Unsaved changes"
              : saved
                ? "Saved"
                : "All changes saved"}
        </span>
        <button className="small-button" onClick={save}>
          {saved ? <Check size={14} /> : <Save size={14} />}Save
        </button>
      </div>
      <div className="editor-surface">
        <div
          className="line-numbers"
          aria-hidden
          onWheel={(event) => {
            if (textArea.current) textArea.current.scrollTop += event.deltaY;
          }}
        >
          <div className="line-numbers-content" ref={lineNumbers}>
            {text.split("\n").map((_, i) => (
              <div key={i}>{i + 1}</div>
            ))}
          </div>
        </div>
        <textarea
          ref={textArea}
          spellCheck={false}
          aria-label="Document content"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onScroll={(event) => {
            if (lineNumbers.current)
              lineNumbers.current.style.transform = `translateY(-${event.currentTarget.scrollTop}px)`;
          }}
          onKeyDown={(e) => {
            if (e.key === "Tab") {
              e.preventDefault();
              const target = e.currentTarget;
              const pos = target.selectionStart;
              setText(
                text.slice(0, pos) + "  " + text.slice(target.selectionEnd),
              );
              requestAnimationFrame(() => {
                target.setSelectionRange(pos + 2, pos + 2);
              });
            }
          }}
        />
      </div>
      <div className="files-status">
        <span>
          {text.trim().split(/\s+/).filter(Boolean).length} words ·{" "}
          {text.length} characters
        </span>
        <span>
          Plain text <span className="status-dot">●</span> UTF-8{" "}
          <span className="status-dot">●</span> Ctrl + S to save
        </span>
      </div>
    </div>
  );
}
