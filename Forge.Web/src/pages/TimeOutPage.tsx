import { EmptyState, Page } from '../components'

/** The Time Out tab. Unlock goals come after food logging. */
export default function TimeOutPage() {
  return (
    <Page title="Time Out">
      <EmptyState icon="hourglass" title="Earn your scroll time">
        Choose goals, like finishing today's workout, that unlock apps such as Instagram. Coming soon.
      </EmptyState>
    </Page>
  )
}
