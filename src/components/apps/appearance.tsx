"use client";

import { useRef, useState } from "react";
import { Check, Image as ImageIcon, Upload, X } from "lucide-react";
import { accentColors } from "@/lib/theme";
import { useOS } from "@/lib/store";
import {
  saveWallpaperImage,
  removeWallpaperImage,
  wallpaperImageTypes,
} from "@/lib/wallpaper";

const colors = [
  "#151515",
  "#1f2923",
  "#223247",
  "#34304a",
  "#51313c",
  "#704c36",
  "#8b887a",
  "#e3dfd4",
];

export function Appearance() {
  const theme = useOS((state) => state.theme);
  const accentColor = useOS((state) => state.accentColor);
  const mode = useOS((state) => state.wallpaperMode);
  const color = useOS((state) => state.wallpaperColor);
  const fit = useOS((state) => state.wallpaperFit);
  const imageName = useOS((state) => state.wallpaperImageName);
  const imageInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  return (
    <>
      <h2>Appearance</h2>
      <h3 className="appearance-label">Theme</h3>
      <div className="theme-options" role="group" aria-label="Theme">
        {(["dark", "light"] as const).map((value) => (
          <button
            key={value}
            aria-pressed={theme === value}
            onClick={() => useOS.getState().setTheme(value)}
            className={theme === value ? "theme-active" : ""}
          >
            <div className={`theme-preview theme-${value}`} aria-hidden="true">
              <div />
              <span>{theme === value && <Check size={15} />}</span>
            </div>
            <strong>{value === "dark" ? "Dark" : "Light"}</strong>
          </button>
        ))}
      </div>
      <h3 className="appearance-label">Accent color</h3>
      <div className="color-swatches" role="group" aria-label="Accent color">
        {accentColors.map(({ name, value }) => (
          <button
            key={value}
            aria-label={name}
            title={name}
            aria-pressed={accentColor === value}
            className={`color-swatch ${accentColor === value ? "color-selected" : ""}`}
            style={{ backgroundColor: value }}
            onClick={() => useOS.getState().setAccentColor(value)}
          >
            {accentColor === value && <Check size={16} />}
          </button>
        ))}
      </div>
      <label className="custom-color">
        <span>Custom accent</span>
        <input
          type="color"
          aria-label="Custom accent color"
          value={accentColor}
          onInput={(event) =>
            useOS.getState().setAccentColor(event.currentTarget.value)
          }
        />
        <span className="color-value">{accentColor.toUpperCase()}</span>
      </label>
      <div className="background-type">
        <label htmlFor="background-type">Background</label>
        <select
          id="background-type"
          value={mode}
          disabled={busy}
          onChange={(event) => {
            setError("");
            useOS
              .getState()
              .setWallpaperMode(event.target.value as typeof mode);
          }}
        >
          <option value="preset">Theme wallpaper</option>
          <option value="solid">Solid color</option>
          <option value="image">Picture</option>
        </select>
      </div>
      {mode === "solid" && (
        <div className="wallpaper-colors">
          <div
            className="color-swatches"
            role="group"
            aria-label="Background colors"
          >
            {colors.map((value) => (
              <button
                key={value}
                aria-label={`Background ${value}`}
                aria-pressed={color === value}
                className={`color-swatch ${color === value ? "color-selected" : ""}`}
                style={{ backgroundColor: value }}
                onClick={() => useOS.getState().setWallpaperColor(value)}
              >
                {color === value && <Check size={16} />}
              </button>
            ))}
          </div>
          <label className="custom-color">
            <span>Custom color</span>
            <input
              type="color"
              aria-label="Custom background color"
              value={color}
              onChange={(event) =>
                useOS.getState().setWallpaperColor(event.target.value)
              }
            />
            <span className="color-value">{color.toUpperCase()}</span>
          </label>
        </div>
      )}
      {mode === "image" && (
        <div className="wallpaper-picture">
          <input
            ref={imageInput}
            hidden
            type="file"
            accept={wallpaperImageTypes.join(",")}
            aria-label="Wallpaper image"
            onChange={async (event) => {
              const file = event.currentTarget.files?.[0];
              event.currentTarget.value = "";
              if (!file) return;
              setBusy(true);
              setError("");
              try {
                await saveWallpaperImage(file);
                useOS.getState().setWallpaperImage(file.name);
              } catch (error) {
                setError(
                  error instanceof Error
                    ? error.message
                    : "The image could not be saved.",
                );
              } finally {
                setBusy(false);
              }
            }}
          />
          {imageName && (
            <div className="wallpaper-filename">
              <ImageIcon size={18} />
              <span title={imageName}>{imageName}</span>
              <button
                className="icon-button"
                aria-label="Remove custom wallpaper"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  setError("");
                  try {
                    await removeWallpaperImage();
                    useOS.getState().setWallpaperImage("");
                  } catch (error) {
                    setError(
                      error instanceof Error
                        ? error.message
                        : "The image could not be removed.",
                    );
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <X size={15} />
              </button>
            </div>
          )}
          <button
            className="small-button"
            disabled={busy}
            onClick={() => imageInput.current?.click()}
          >
            <Upload size={15} />
            {busy ? "Saving…" : imageName ? "Change image" : "Choose image"}
          </button>
          {imageName && (
            <div className="background-type image-fit">
              <label htmlFor="wallpaper-fit">Image fit</label>
              <select
                id="wallpaper-fit"
                value={fit}
                onChange={(event) =>
                  useOS
                    .getState()
                    .setWallpaperFit(event.target.value as typeof fit)
                }
              >
                <option value="cover">Fill screen</option>
                <option value="contain">Fit to screen</option>
              </select>
            </div>
          )}
          {error && (
            <p className="error-text" role="alert">
              {error}
            </p>
          )}
        </div>
      )}
    </>
  );
}
