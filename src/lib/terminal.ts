export type CommandResult = { output: string; clear?: boolean };

export function execute(input: string): CommandResult {
  const command = input.trim();
  if (!command) return { output: "" };
  if (command === "help")
    return {
      output:
        "Terminal is under development.\nAvailable commands: help, clear.",
    };
  if (command === "clear") return { output: "", clear: true };
  return { output: "Unknown command. Available commands: help, clear." };
}
