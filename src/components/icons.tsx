import {
  Aperture,
  FolderClosed,
  FileText,
  Terminal,
  Settings2,
  type LucideIcon,
} from "lucide-react";
import type { AppId } from "@/lib/store";
export const appIcons: Record<AppId, LucideIcon> = {
  files: FolderClosed,
  editor: FileText,
  terminal: Terminal,
  settings: Settings2,
};
export function AppIcon({ app, size = 24 }: { app: AppId; size?: number }) {
  const Icon = appIcons[app];
  return (
    <span className={`app-icon icon-${app}`}>
      <Icon size={size} strokeWidth={1.6} />
    </span>
  );
}
export function Brand({ size = 20 }: { size?: number }) {
  return <Aperture size={size} strokeWidth={1.7} />;
}
