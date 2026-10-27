import { useState } from 'react'
import { appleSignIn, deleteMyData, forgetUserId, getProfile, isCancel, isNative, signOut } from '../api'
import { DISMISSED_KEY } from '../AdaptiveGoalCard'
import { forgetRemembered, write } from '../cache'
import { dangerButton, Group, Notice, Page, Row, tintedButton } from '../components'
import { saveDraft } from '../draft'
import { EQUIPMENT_KEY } from '../equipment'
import { EquipmentSettings } from '../EquipmentSettings'
import { forgetHealth, healthSupported } from '../health'
import { HealthSettings } from '../HealthSettings'
import { formatKcal } from '../nutrition'
import { usePolling } from '../usePolling'

/**
 * Settings (from the person button on Home): goals, your equipment, your account, Delete Account, the legal pages, and
 * the version.
 */
export default function SettingsPage() {
  const [message, setMessage] = useState<string>()
  const [deleting, setDeleting] = useState(false)
  const profile = usePolling(getProfile, '/profile')

  // Everything goes: what's on the server for your account, and what Forge kept on this device. On the iPhone, Apple
  // asks you to confirm with a fresh sign-in, which also lets Forge revoke its access at Apple; then you're signed out.
  const deleteEverything = async () => {
    if (!confirm("Delete your account and everything you've logged in Forge, on our server and on this device? This can't be undone.")) return
    setDeleting(true)
    setMessage(undefined)
    try {
      const appleCode = isNative ? (await appleSignIn()).authorizationCode : undefined
      await deleteMyData(appleCode)
      forgetRemembered()
      saveDraft(undefined)
      for (const key of ['forge.rest', 'forge.scanConsent', DISMISSED_KEY, EQUIPMENT_KEY]) write(key, null)
      forgetHealth()
      if (isNative) return signOut() // Welcome takes over; signing in again starts a new, empty account
      forgetUserId()
      setMessage('Your data was deleted. Forge starts fresh on this device.')
    } catch (error) {
      if (!isCancel(error)) setMessage(`Couldn't delete your data: ${(error as Error).message}`)
    }
    setDeleting(false)
  }

  return (
    <Page title="Settings" back={{ to: '/', label: 'Home' }}>
      <Group>
        <Row to="/setup" icon="target" detail={profile.data ? `${formatKcal(profile.data.calorieGoal)} kcal` : 'Not set'}>
          Goals
        </Row>
      </Group>

      <EquipmentSettings />

      {healthSupported() && <HealthSettings />}

      {isNative && (
        <Group title="Account" footer="Signed in with Apple. Your data is saved to your account, so it's here on a new phone, or if you delete and reinstall Forge.">
          <div className="p-4">
            <button onClick={signOut} className={`w-full ${tintedButton}`}>
              Sign Out
            </button>
          </div>
        </Group>
      )}

      {message && <Notice>{message}</Notice>}

      <Group title="Your data" footer="Removes your account and your workouts, food, weigh-ins, habits, plan, and goals from our server right away, and clears what Forge kept on this device.">
        <div className="p-4">
          <button onClick={deleteEverything} disabled={deleting} className={dangerButton}>
            {deleting ? 'Deleting…' : isNative ? 'Delete Account' : 'Delete My Data'}
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
