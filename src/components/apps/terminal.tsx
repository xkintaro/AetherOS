"use client";
import { useEffect, useRef, useState } from "react";
import { execute } from "@/lib/terminal";

const prompt = "aether:\\>";

export default function TerminalApp() {
  const [input, setInput] = useState("");
  const [lines, setLines] = useState<{ command: string; output: string }[]>([]);
  const bottom = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLInputElement>(null);
  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "nearest" });
  }, [lines]);
  function run() {
    if (!input.trim()) return;
    const result = execute(input);
    if (result.clear) setLines([]);
    else
      setLines((lines) => [
        ...lines,
        { command: input, output: result.output },
      ]);
    setInput("");
  }
  return (
    <div className="terminal-app" onClick={() => field.current?.focus()}>
      <p className="terminal-hint">
        Type <span>help</span> to see what you can do.
      </p>
      {lines.map((line, index) => (
        <div className="terminal-block" key={index}>
          <div className="terminal-command">
            <span className="terminal-path">{prompt}</span>
            {line.command}
          </div>
          <pre>{line.output}</pre>
        </div>
      ))}
      <form
        className="terminal-command"
        onSubmit={(event) => {
          event.preventDefault();
          run();
        }}
      >
        <span className="terminal-path">{prompt}</span>
        <input
          ref={field}
          aria-label="Terminal command"
          autoComplete="off"
          spellCheck={false}
          value={input}
          onChange={(event) => setInput(event.target.value)}
        />
      </form>
      <div ref={bottom} />
    </div>
  );
}
