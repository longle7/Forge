import { EmptyState, Page } from '../components'

/** The Calories tab. Food logging comes next. */
export default function CaloriesPage() {
  return (
    <Page title="Calories">
      <EmptyState icon="food" title="Food logging is coming next">
        Log meals with full macros, search foods, or snap a photo of a label or your plate.
      </EmptyState>
    </Page>
  )
}
