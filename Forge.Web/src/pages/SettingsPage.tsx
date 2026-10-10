import { useState, type FormEvent } from 'react'
import { parseRestoreCode, switchUserId, userId } from '../api'
import { forgetRemembered } from '../cache'
import { Card, field, primaryButton, secondaryButton, Section } from '../components'
import { loadDraft } from '../draft'
import { useTitle } from '../usePolling'

export default function SettingsPage() {
  useTitle('Settings')
  const [code, setCode] = useState(userId)
  const [copied, setCopied] = useState(false)
  const [typed, setTyped] = useState('')
  const [message, setMessage] = useState<string>()

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
    } catch {
      setMessage("Couldn't copy. Select the code and copy it yourself.")
    }
  }

  const restore = (event: FormEvent) => {
    event.preventDefault()
    const next = parseRestoreCode(typed)
    if (!next) return setMessage("That isn't a restore code. It looks like the one above: letters, numbers, and dashes.")
    if (next === code) return setMessage("That's already this device's code.")
    if (loadDraft()) return setMessage('Finish or discard the workout in progress first (Workout tab).')
    if (!confirm('Switch to the workouts saved under that code? The ones under the current code stay saved; keep its code to come back.')) return
    switchUserId(next)
    forgetRemembered() // last-known data belongs to the old code
    setCode(next)
    setTyped('')
    setCopied(false)
    setMessage('Done. This device now shows the workouts saved under that code.')
  }

  return (
    <>
      <h1 className="text-2xl font-bold">Settings</h1>

      <Section title="Your restore code">
        <Card>
          <p className="text-sm text-neutral-500">
            Forge has no accounts. Your workouts are saved under this code, made up on this device. Keep it somewhere safe (in
            Notes, say): if Safari clears this site's data, or you move to another phone, entering it below brings your history
            back. Anyone with the code can see your workouts, so keep it private.
          </p>
          <p className="mt-3 rounded-lg bg-neutral-100 p-3 text-center font-mono text-sm break-all select-all dark:bg-neutral-800">{code}</p>
          <button onClick={copy} className={`mt-2 w-full ${secondaryButton}`}>
            {copied ? 'Copied' : 'Copy code'}
          </button>
        </Card>
        <Card>
          <form onSubmit={restore} className="space-y-2">
            <label htmlFor="restore" className="font-semibold">
              Use a restore code
            </label>
            <input id="restore" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" autoCapitalize="none" spellCheck={false} className={`${field} font-mono`} />
            <button disabled={!typed.trim()} className={primaryButton}>
              Use this code
            </button>
          </form>
        </Card>
        {message && (
          <p role="status" className="px-1 text-sm text-neutral-600 dark:text-neutral-300">
            {message}
          </p>
        )}
      </Section>

      <Section title="About">
        <Card>
          <p className="flex items-center justify-between">
            Version <span className="text-neutral-500">{__APP_VERSION__}</span>
          </p>
        </Card>
      </Section>
    </>
  )
}
