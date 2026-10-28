import { test } from "node:test";
import assert from "node:assert/strict";
import {
  accentColors,
  contrastRatio,
  defaultAccent,
  restoreTheme,
  themeAccent,
} from "../src/lib/theme";
import { restoreSession } from "../src/lib/session";
import { useOS } from "../src/lib/store";

test("legacy themes migrate without overriding explicit new preferences", () => {
  for (const [atmosphere, accentColor] of [
    ["sage", "#91bd9d"],
    ["dusk", "#e59ab5"],
    ["graphite", "#a1a9b8"],
  ]) {
    assert.deepEqual(restoreTheme({ atmosphere }), {
      theme: "dark",
      accentColor,
    });
  }
  assert.deepEqual(
    restoreTheme({
      atmosphere: "sage",
      theme: "light",
      accentColor: "#FA1234",
    }),
    { theme: "light", accentColor: "#fa1234" },
  );
  assert.deepEqual(restoreTheme({ theme: "invalid", accentColor: "red" }), {
    theme: "dark",
    accentColor: defaultAccent,
  });
});

test("theme and custom accent survive session restoration independently of wallpaper", () => {
  const saved = {
    theme: "light",
    accentColor: "#3d84b2",
    wallpaperMode: "image",
    wallpaperImageName: "photo.png",
    wallpaperFit: "contain",
    wallpaperColor: "#123456",
  };
  const restored = restoreSession(saved);
  for (const [key, value] of Object.entries(saved))
    assert.equal(restored[key as keyof typeof restored], value);
});

test("theme setters preserve custom backgrounds and reject invalid values", () => {
  useOS.setState({
    theme: "dark",
    accentColor: defaultAccent,
    wallpaperMode: "image",
    wallpaperImageName: "keep.png",
    wallpaperColor: "#123456",
  });
  useOS.getState().setTheme("light");
  useOS.getState().setAccentColor("#F012AB");
  assert.equal(useOS.getState().theme, "light");
  assert.equal(useOS.getState().accentColor, "#f012ab");
  assert.equal(useOS.getState().wallpaperMode, "image");
  assert.equal(useOS.getState().wallpaperImageName, "keep.png");
  assert.equal(useOS.getState().wallpaperColor, "#123456");
  useOS.getState().setAccentColor("url(https://invalid)");
  assert.equal(useOS.getState().accentColor, "#f012ab");
  // Runtime guards protect data arriving outside typed callers.
  useOS.getState().setTheme("invalid" as "dark");
  assert.equal(useOS.getState().theme, "light");
});

test("preset and extreme custom accents retain readable text in both modes", () => {
  const colors: string[] = [
    ...accentColors.map((color) => color.value),
    "#000000",
    "#ffffff",
    "#777777",
    "#ff0000",
    "#00ff00",
    "#0000ff",
    "#ffff00",
  ];
  for (const theme of ["dark", "light"] as const) {
    for (const color of colors) {
      const vars = themeAccent(color, theme);
      assert.equal(vars["--user-accent"], color);
      assert.ok(
        contrastRatio(
          vars["--accent-text"],
          theme === "dark" ? "#303034" : "#ececef",
        ) >= 4.5,
        `${theme} ${color}`,
      );
      assert.ok(contrastRatio(vars["--on-accent"], color) >= 4.5, color);
    }
  }
});

test("unrecognized legacy keys cannot escape theme validation", () => {
  for (const atmosphere of ["__proto__", "constructor", "toString", {}, null]) {
    assert.equal(restoreTheme({ atmosphere }).accentColor, defaultAccent);
  }
});
