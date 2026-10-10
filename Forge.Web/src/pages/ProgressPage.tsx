import { EmptyState, Page } from '../components'

/** The Progress tab. Charts come after food logging. */
export default function ProgressPage() {
  return (
    <Page title="Progress">
      <EmptyState icon="chart" title="Your trends will live here">
        Weight, strength, calories, and how well you stick to your plan, over weeks and months. Coming soon.
      </EmptyState>
    </Page>
  )
}
