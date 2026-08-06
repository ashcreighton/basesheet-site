import { componentRegistry } from "../../quartz/components/registry"

export { BasesEntry, BasesView, FilterNode, GroupBy, PropertyConfig, SortDirection, SummaryType, ViewRenderer, ViewRendererProps, ViewTypeRegistration, BasesBody, registerCustomViews, viewRegistry, compile, evaluate, evaluateFilter, resolvePropertyValue, BasesData, BasesPageOptions } from "./bases-page"

export const plugins: Record<string, Record<string, (...args: unknown[]) => void>> = {
  "bases-page": {
    BasesPage: (...args: unknown[]) => { componentRegistry.setOptionOverrides("bases-page", args[0] as Record<string, unknown>); },
    BasesTransformer: (...args: unknown[]) => { componentRegistry.setOptionOverrides("bases-page", args[0] as Record<string, unknown>); },
  },
}

export const BasesPage = plugins["bases-page"].BasesPage
export const BasesTransformer = plugins["bases-page"].BasesTransformer
