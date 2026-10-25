import { useState } from 'react'
import { Group, Notice, plainButton, tintedButton } from './components'
import { connectHealth, disconnectHealth, healthConnected, lastHealthSync, syncHealth } from './health'
import { useAction } from './usePolling'
import { plural } from './workouts'

/** Settings → Apple Health (iPhone app only): connect, sync now, and how to stop. */
export function HealthSettings() {
  const [connected, setConnected] = useState(healthConnected)
  const [result, setResult] = useState<string>()
  const { busy, error, run } = useAction()
  const synced = lastHealthSync()

  const said = (count: number) => setResult(count ? `Brought in ${plural(count, 'workout')}.` : 'Up to date.')
  const connect = () =>
    run(async () => {
      said(await connectHealth())
      setConnected(true)
    })
  const syncNow = () => run(async () => said(await syncHealth(true)))
  const disconnect = () => {
    disconnectHealth()
    setConnected(false)
    setResult(undefined)
  }

  return (
    <Group
      title="Apple Health"
      footer={
        connected
          ? 'Forge brings in new workouts when you open it. To stop Forge reading Health entirely, open the Health app → Sharing → Apps → Forge.'
          : 'Bring in workouts from your Apple Watch and other apps, with their calories and heart rate. Forge only reads from Health; it never writes to it.'
      }
    >
      <div className="space-y-2 p-4">
        {connected ? (
          <>
            <p className="text-[15px] text-muted">{synced ? `Last synced ${new Date(synced).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}` : 'Not synced yet'}</p>
            <button onClick={syncNow} disabled={busy} className={`w-full ${tintedButton}`}>
              {busy ? 'Syncing…' : 'Sync Now'}
            </button>
            <button onClick={disconnect} disabled={busy} className={`-ml-1 ${plainButton}`}>
              Stop Syncing on This iPhone
            </button>
          </>
        ) : (
          <button onClick={connect} disabled={busy} className={`w-full ${tintedButton}`}>
            {busy ? 'Connecting…' : 'Connect Apple Health'}
          </button>
        )}
        {result && !error && <p className="text-[15px] text-muted">{result}</p>}
        {error && <Notice tone="error">{error}</Notice>}
      </div>
    </Group>
  )
}
