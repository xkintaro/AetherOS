"use client";
import { useEffect, useState } from "react";
import { useOS } from "@/lib/store";
import { readWallpaperImage } from "@/lib/wallpaper";

export function Wallpaper() {
  const mode = useOS((state) => state.wallpaperMode);
  const color = useOS((state) => state.wallpaperColor);
  const fit = useOS((state) => state.wallpaperFit);
  const revision = useOS((state) => state.wallpaperRevision);
  const name = useOS((state) => state.wallpaperImageName);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let url: string | undefined;
    setImageUrl(null);
    if (mode === "image" && name) {
      readWallpaperImage()
        .then((image) => {
          if (cancelled) return;
          if (!image) throw new Error("Choose the image again in Appearance.");
          url = URL.createObjectURL(image);
          setImageUrl(url);
        })
        .catch((error) => {
          if (!cancelled)
            useOS
              .getState()
              .notify(
                "Wallpaper unavailable",
                error instanceof Error
                  ? error.message
                  : "Choose another image in Appearance.",
              );
        });
    }
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [mode, revision, name]);

  const custom = mode === "solid" || (mode === "image" && imageUrl);
  const background =
    mode === "solid"
      ? color
      : imageUrl
        ? `url("${imageUrl}") center / ${fit} no-repeat ${color}`
        : undefined;
  return (
    <div
      className="wallpaper"
      aria-hidden="true"
      style={custom ? { background } : undefined}
    >
      {!custom && (
        <>
          <div className="orb orb-one" />
          <div className="orb orb-two" />
          <div className="orb orb-three" />
          <div className="wallpaper-grain" />
          <div className="wallpaper-lines" />
        </>
      )}
    </div>
  );
}
