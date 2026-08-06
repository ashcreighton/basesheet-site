import type {
  QuartzComponent,
  QuartzComponentConstructor,
  QuartzComponentProps,
} from "@quartz-community/types";
import type { BasesData, BasesPageOptions } from "../types";
import { resolveBasesEntries } from "../resolver";
import type { EvalContext } from "../compiler";
import { i18n } from "../i18n";
import { registerCustomViews, viewRegistry } from "../registry";
import { ViewSelector } from "./ViewSelector";
import { registerBuiltinViews } from "./views";
import style from "./styles/bases.scss";
// @ts-expect-error inline script import handled by esbuild plugin
import script from "./scripts/bases.inline.ts";

let builtinViewsRegistered = false;

// Word-count goal for this project's Basesheet board specifically —
// not a general Bases feature, just this site's editorial target.
const WORDCOUNT_GOAL = 4500;

function StatsLedger({ allFiles }: { allFiles: QuartzComponentProps["allFiles"] }) {
  let written = 0;
  let pieces = 0;
  const statuses = new Set<string>();

  for (const f of allFiles) {
    const fm = (f as { frontmatter?: Record<string, unknown> }).frontmatter;
    if (!fm) continue;
    const wc = fm.wordcount;
    if (typeof wc === "number") {
      written += wc;
      pieces += 1;
    }
    const status = fm["content status"];
    if (typeof status === "string" && status.length > 0) statuses.add(status);
  }

  if (pieces === 0) return null;

  const pct = Math.round((written / WORDCOUNT_GOAL) * 100);
  const diff = written - WORDCOUNT_GOAL;
  const diffLabel = diff >= 0 ? "over goal" : "still needed";
  const diffValue = Math.abs(diff).toLocaleString("en-US");

  return (
    <div class="bases-stats">
      <div class="bases-stats-ledger">
        <div class="bases-stat">
          <span class="bases-stat-num">{written.toLocaleString("en-US")}</span>
          <span class="bases-stat-lbl">Written</span>
        </div>
        <div class="bases-stat">
          <span class="bases-stat-num">{WORDCOUNT_GOAL.toLocaleString("en-US")}</span>
          <span class="bases-stat-lbl">Goal</span>
        </div>
        <div class="bases-stat bases-stat-pct">
          <span class="bases-stat-num">{pct}%</span>
          <span class="bases-stat-lbl">Of goal</span>
        </div>
      </div>
      <div class="bases-stats-bar-row">
        <div class="bases-stats-bar-track">
          <div
            class="bases-stats-bar-fill"
            style={{ width: `${Math.min(pct, 100)}%` }}
          />
        </div>
        <div class="bases-stats-bar-caption">
          <span>
            <strong>{diffValue} words</strong> {diffLabel}
          </span>
          <span>
            {pieces} piece{pieces === 1 ? "" : "s"} across {statuses.size} stage
            {statuses.size === 1 ? "" : "s"}
          </span>
        </div>
      </div>
    </div>
  );
}

export default ((opts?: BasesPageOptions) => {
  const Component: QuartzComponent = (props: QuartzComponentProps) => {
    const locale = props.cfg?.locale ?? "en-US";
    const localeStrings = i18n(locale).components.bases;
    const fileData = props.fileData as {
      basesData?: BasesData;
      basesOptions?: BasesPageOptions;
      basesSelfContext?: EvalContext["self"];
    };
    const basesData = fileData.basesData;
    const basesOptions = fileData.basesOptions ?? opts;
    const basesSelfContext = fileData.basesSelfContext;
    const slug = (props.fileData.slug as string) ?? "";
    const rawSlugs = ((props.ctx as Record<string, unknown>)?.allSlugs as string[]) ?? [];
    const baseSlugs = new Set(rawSlugs.filter((s) => s.endsWith(".base")));
    const baseAliases = new Set([...baseSlugs].map((s) => s.replace(/\.base$/, "")));
    const allSlugs = rawSlugs.filter((s) => !baseSlugs.has(s) && !baseAliases.has(s));
    const linkResolution = basesOptions?.linkResolution ?? "shortest";

    if (!basesData) {
      return <div class="bases-page bases-empty">{localeStrings.noData}</div>;
    }

    const views = basesData.views ?? [];
    if (views.length === 0) {
      return <div class="bases-page bases-empty">{localeStrings.noViews}</div>;
    }

    const preferredType = basesOptions?.defaultViewType ?? "table";
    const initialIndex = Math.max(
      0,
      views.findIndex((view) => view.type === preferredType),
    );
    if (!builtinViewsRegistered) {
      registerBuiltinViews();
      builtinViewsRegistered = true;
    }

    if (basesOptions?.customViews) {
      registerCustomViews(basesOptions.customViews);
    }

    // Collect CSS from custom view registrations (deduplicated by type)
    const activeTypes = new Set(views.map((v) => v.type));
    const viewCssChunks: string[] = [];
    for (const typeId of activeTypes) {
      const reg = viewRegistry.get(typeId);
      if (reg?.css) viewCssChunks.push(reg.css);
    }

    return (
      <div class="bases-page" data-initial-view={initialIndex}>
        {viewCssChunks.length > 0 && (
          <style dangerouslySetInnerHTML={{ __html: viewCssChunks.join("\n") }} />
        )}
        <StatsLedger allFiles={props.allFiles} />
        <ViewSelector views={views} activeIndex={initialIndex} locale={locale} />
        <div class="bases-view-container">
          {views.map((view, index) => {
            const { entries, total } = resolveBasesEntries(
              basesData,
              props.allFiles,
              view,
              basesSelfContext,
            );
            const registration = viewRegistry.get(view.type);
            const Renderer = registration?.render;
            return (
              <div
                class={`bases-view ${index === initialIndex ? "is-active" : ""}`}
                data-view-index={index}
                data-view-type={view.type}
              >
                {entries.length === 0 ? (
                  <div class="bases-empty">{localeStrings.noData}</div>
                ) : Renderer ? (
                  <Renderer
                    entries={entries}
                    view={view}
                    basesData={basesData}
                    total={total}
                    locale={locale}
                    slug={slug}
                    allSlugs={allSlugs}
                    linkResolution={linkResolution}
                    options={registration.options}
                  />
                ) : (
                  <div class="bases-empty">Unknown view type: {view.type}</div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  Component.css = style;
  // Collect afterDOMLoaded scripts from all registered views so they get
  // bundled into postscript.js (SPA-compatible) instead of inline <script> tags.
  const viewScripts = viewRegistry
    .getAll()
    .map((reg) => reg.afterDOMLoaded)
    .filter((s): s is string => typeof s === "string" && s.length > 0);
  Component.afterDOMLoaded = [script, ...viewScripts];

  return Component;
}) satisfies QuartzComponentConstructor<BasesPageOptions>;
