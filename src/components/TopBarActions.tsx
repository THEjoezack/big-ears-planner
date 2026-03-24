import { ThemeSettings } from "@/components/ThemeSettings";

/** Fixed top-right: appearance (theme) only. */
export function TopBarActions() {
  return (
    <div className="top-bar-actions">
      <ThemeSettings />
    </div>
  );
}
