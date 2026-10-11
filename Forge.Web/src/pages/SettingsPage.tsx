import { useState, type FormEvent } from 'react'
import { deleteMyData, forgetUserId, getProfile, parseRestoreCode, switchUserId, userId } from '../api'
import { forgetRemembered } from '../cache'
import { Card, dangerButton, field, Group, Notice, Page, primaryButton, Row, tintedButton } from '../components'
import { loadDraft, saveDraft } from '../draft'
import { formatKcal } from '../nutrition'
import { usePolling } from '../usePolling'

/** Settings (from the person button on Home): goals, your restore code, Delete my data, the legal pages, and the version. */
export default function SettingsPage() {
  const [code, setCode] = useState(userId)
  const [copied, setCopied] = useState(false)
  const [typed, setTyped] = useState('')
  const [message, setMessage] = useState<string>()
  const [deleting, setDeleting] = useState(false)
  const profile = usePolling(getProfile, '/profile')

  // Everything goes: what's on the server under this code, and what Forge kept on this device. A fresh code follows.
  const deleteEverything = async () => {
    if (!confirm("Delete everything you've logged in Forge, on our server and on this device? This can't be undone.")) return
    setDeleting(true)
    setMessage(undefined)
    try {
      await deleteMyData()
      forgetUserId()
      forgetRemembered()
      saveDraft(undefined)
      try {
        for (const key of ['forge.rest', 'forge.scanConsent']) localStorage.removeItem(key)
      } catch {
        // storage blocked: nothing stored
      }
      setCode(userId())
      setCopied(false)
      setMessage('Your data was deleted. Forge starts fresh on this device, with a new restore code.')
    } catch (error) {
      setMessage(`Couldn't delete your data: ${(error as Error).message}`)
    }
    setDeleting(false)
  }

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
    if (loadDraft()) return setMessage('Finish or discard the workout in progress first.')
    if (!confirm('Switch to the data saved under that code? Everything under the current code stays saved; keep its code to come back.')) return
    switchUserId(next)
    forgetRemembered() // last-known data belongs to the old code
    setCode(next)
    setTyped('')
    setCopied(false)
    setMessage('Done. This device now shows what was saved under that code.')
  }

  return (
    <Page title="Settings" back={{ to: '/', label: 'Home' }}>
      <Group>
        <Row to="/setup" icon="target" detail={profile.data ? `${formatKcal(profile.data.calorieGoal)} kcal` : 'Not set'}>
          Goals
        </Row>
      </Group>

      <Group
        title="Your restore code"
        footer="Forge has no accounts. Everything is saved under this code, made up on this device. Keep it somewhere safe, like Notes: if Safari clears this site's data, or you move to another phone, entering it below brings everything back. Anyone with the code can see your data, so keep it private."
      >
        <div className="space-y-2 p-4">
          <p className="rounded-xl bg-fill p-3 text-center font-mono text-[15px] break-all select-all">{code}</p>
          <button onClick={copy} className={`w-full ${tintedButton}`}>
            {copied ? 'Copied' : 'Copy Code'}
          </button>
        </div>
      </Group>

      <Card>
        <form onSubmit={restore} className="space-y-2">
          <label htmlFor="restore" className="font-semibold">
            Use a restore code
          </label>
          <input id="restore" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" autoCapitalize="none" spellCheck={false} className={`${field} font-mono`} />
          <button disabled={!typed.trim()} className={primaryButton}>
            Use This Code
          </button>
        </form>
      </Card>
      {message && <Notice>{message}</Notice>}

      <Group title="Your data" footer="Removes your workouts, food, weigh-ins, habits, plan, and goals from our server right away, and clears what Forge kept on this device.">
        <div className="p-4">
          <button onClick={deleteEverything} disabled={deleting} className={dangerButton}>
            {deleting ? 'Deleting…' : 'Delete My Data'}
          </button>
        </div>
      </Group>

      <Group title="Legal">
        <Row to="/privacy">Privacy Policy</Row>
        <Row to="/terms">Terms of Use</Row>
        <Row to="/support">Help &amp; Support</Row>
      </Group>

      <Group title="About">
        <Row detail={__APP_VERSION__}>Version</Row>
      </Group>
    </Page>
  )
}
