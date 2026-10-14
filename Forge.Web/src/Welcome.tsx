import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { Link, useLocation } from 'react-router'
import { isCancel, isSignedIn, onSignInChange, signIn } from './api'
import { Notice, primaryButton } from './components'
import { EFFECTIVE_DATE, LEGAL_PAGES } from './legal'

// Which version of the terms this device agreed to. A new EFFECTIVE_DATE (legal.ts) asks again.
const ACCEPTED_KEY = 'forge.termsAccepted'

function accepted() {
  try {
    return localStorage.getItem(ACCEPTED_KEY) === EFFECTIVE_DATE
  } catch {
    return false // storage blocked: ask each visit, never assume agreement
  }
}

/**
 * First launch (and whenever the terms change): what Forge is, that its numbers are estimates and not medical advice,
 * and an explicit "Agree and Continue" to the Terms of Use and Privacy Policy. An agreement people actively accept
 * holds up far better than terms that are only linked somewhere.
 *
 * On the iPhone it's also where you Sign in with Apple (one tap agrees and signs in), and it comes back if you sign out.
 *
 * A native modal <dialog>: it traps focus and hides the app behind it from screen readers. Escape doesn't dismiss it
 * (agreeing is the way in). It steps aside on the legal pages themselves, so people can read them first.
 */
export default function Welcome() {
  const { pathname } = useLocation()
  const [agreed, setAgreed] = useState(accepted)
  const signedIn = useSyncExternalStore(onSignInChange, isSignedIn)
  const [signingIn, setSigningIn] = useState(false)
  const [error, setError] = useState<string>()
  const dialog = useRef<HTMLDialogElement>(null)
  const open = (!agreed || !signedIn) && !LEGAL_PAGES.includes(pathname)

  useEffect(() => {
    const d = dialog.current
    if (open && d && !d.open) {
      d.showModal()
      d.querySelector('button')?.focus() // showModal focuses the first link; the action is the button
    }
    if (!open && d?.open) d.close()
  }, [open])

  const agree = () => {
    try {
      localStorage.setItem(ACCEPTED_KEY, EFFECTIVE_DATE)
    } catch {
      // Can't remember it; it still counts for this visit.
    }
    setAgreed(true)
  }

  const agreeAndSignIn = async () => {
    setSigningIn(true)
    setError(undefined)
    try {
      await signIn()
      agree()
    } catch (e) {
      if (!isCancel(e)) setError((e as Error).message)
    }
    setSigningIn(false)
  }

  if (agreed && signedIn) return null
  return (
    <dialog
      ref={dialog}
      aria-labelledby="welcome-title"
      onCancel={(event) => event.preventDefault()} // Escape: stay until they agree
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-3xl bg-canvas p-6 text-ink shadow-xl backdrop:bg-black/50"
    >
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <img src="/favicon.svg" alt="" className="size-12 rounded-2xl" />
          <h2 id="welcome-title" className="text-[22px] font-bold">
            Welcome to Forge
          </h2>
        </div>
        <p>
          Your workouts, food, and habits in one place, with goals that keep you going. No ads.
          {!signedIn && ' Sign in with Apple so your data comes with you to a new phone.'}
        </p>
        <p className="rounded-2xl bg-amber/15 p-3 text-[15px]">
          Forge's calorie and nutrition numbers are estimates, not medical advice. Check with a doctor before big changes to
          how you eat or exercise.
        </p>
        <p className="text-[15px] text-muted">
          By continuing, you agree to the{' '}
          <Link to="/terms" className="text-coral-ink underline">
            Terms of Use
          </Link>{' '}
          and{' '}
          <Link to="/privacy" className="text-coral-ink underline">
            Privacy Policy
          </Link>
          .
        </p>
        {signedIn ? (
          <button onClick={agree} className={primaryButton}>
            Agree and Continue
          </button>
        ) : (
          // Apple's own button style: black (white in dark mode), with the Apple logo (a character only Apple's fonts have).
          <button onClick={agreeAndSignIn} disabled={signingIn} className="flex min-h-12 w-full items-center justify-center gap-1.5 rounded-2xl bg-black text-[17px] font-semibold text-white disabled:opacity-60 dark:bg-white dark:text-black">
            <span aria-hidden className="text-[20px] leading-none">{String.fromCharCode(0xf8ff)}</span>
            {signingIn ? 'Signing In…' : 'Sign in with Apple'}
          </button>
        )}
        {error && <Notice>{error}</Notice>}
      </div>
    </dialog>
  )
}
