import {
  FileText,
  Files,
  FolderClosed,
  FolderDown,
  FolderRoot,
  Monitor,
  type LucideIcon,
} from "lucide-react";
import {
  DESKTOP_ID,
  DOCUMENTS_ID,
  DOWNLOADS_ID,
  ROOT_ID,
  type VFile,
} from "@/lib/filesystem";

const systemFolderIcons: Record<string, LucideIcon> = {
  [DESKTOP_ID]: Monitor,
  [DOCUMENTS_ID]: Files,
  [DOWNLOADS_ID]: FolderDown,
};

export function FileIcon({
  file,
  size = 24,
  strokeWidth = 1.5,
}: {
  file: Pick<VFile, "id" | "kind">;
  size?: number;
  strokeWidth?: number;
}) {
  const systemIcon =
    file.kind === "folder" ? systemFolderIcons[file.id] : undefined;
  const Icon =
    systemIcon ??
    (file.id === ROOT_ID
      ? FolderRoot
      : file.kind === "folder"
        ? FolderClosed
        : FileText);
  return (
    <Icon
      size={size}
      strokeWidth={systemIcon ? 1.5 : strokeWidth}
      className={systemIcon ? "system-folder-icon" : undefined}
      aria-hidden="true"
    />
  );
}
