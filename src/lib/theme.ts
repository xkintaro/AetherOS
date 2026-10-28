export type Theme = "dark" | "light";
export const defaultAccent = "#8b9cf7";
export const accentColors = [
  { name: "Blue", value: defaultAccent },
  { name: "Violet", value: "#b49aef" },
  { name: "Rose", value: "#e59ab5" },
  { name: "Amber", value: "#d6ae70" },
  { name: "Green", value: "#91bd9d" },
  { name: "Slate", value: "#a1a9b8" },
] as const;

export const isHexColor = (value: unknown): value is string =>
  typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);

function rgb(hex: string) {
  return [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16));
}
function luminance(hex: string) {
  const channels = rgb(hex).map((value) => {
    const c = value / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}
export function contrastRatio(a: string, b: string) {
  const x = luminance(a),
    y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

/** Preserve the selected hue while keeping small accented labels readable. */
export function themeAccent(color: string, theme: Theme) {
  const accent = isHexColor(color) ? color.toLowerCase() : defaultAccent;
  const background = theme === "dark" ? "#303034" : "#ececef";
  const target = theme === "dark" ? 255 : 0;
  const channels = rgb(accent);
  let text = accent;
  for (
    let step = 1;
    contrastRatio(text, background) < 4.5 && step <= 100;
    step++
  ) {
    text =
      "#" +
      channels
        .map((c) =>
          Math.round(c + ((target - c) * step) / 100)
            .toString(16)
            .padStart(2, "0"),
        )
        .join("");
  }
  return {
    "--accent": accent,
    "--accent-text": text,
    "--on-accent":
      contrastRatio(accent, "#000000") >= 4.5 ? "#000000" : "#ffffff",
  };
}

export function restoreTheme(saved: Record<string, unknown>) {
  const legacyAccent =
    saved.atmosphere === "sage"
      ? "#91bd9d"
      : saved.atmosphere === "dusk"
        ? "#e59ab5"
        : saved.atmosphere === "graphite"
          ? "#a1a9b8"
          : defaultAccent;
  return {
    theme: saved.theme === "light" ? ("light" as const) : ("dark" as const),
    accentColor: isHexColor(saved.accentColor)
      ? saved.accentColor.toLowerCase()
      : legacyAccent,
  };
}
