import { ThemeSettings } from "@/components/ThemeSettings";

/** Fixed top-right: settings when the main header is not shown. */
export function TopBarActions({ festivalId }: { festivalId: string }) {
  return (
    <div className="top-bar-actions">
      <ThemeSettings festivalId={festivalId} />
    </div>
  );
}
