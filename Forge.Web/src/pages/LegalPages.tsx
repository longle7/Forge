import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { CONTACT_EMAIL, EFFECTIVE_DATE, GOVERNING_STATE, OPERATOR } from '../legal'
import { Page } from '../components'

// The Privacy Policy, Terms of Use, and Support pages: their URLs go in App Store Connect. Keep them in step with what
// the app actually does, and bump EFFECTIVE_DATE (legal.ts) when the policy or terms change. Not legal advice: have a
// lawyer review them.

const link = 'text-coral-ink underline'
const BACK = { to: '/settings', label: 'Settings' }

function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Page title={title} back={BACK}>
      <p className="-mt-3 text-[15px] text-muted">Effective {EFFECTIVE_DATE}</p>
      <article className="space-y-5 text-[17px] leading-relaxed">{children}</article>
      <nav aria-label="Legal" className="flex flex-wrap gap-x-4 gap-y-1 border-t border-line pt-4 text-[15px]">
        <Link to="/privacy" className={link}>
          Privacy Policy
        </Link>
        <Link to="/terms" className={link}>
          Terms of Use
        </Link>
        <Link to="/support" className={link}>
          Help &amp; Support
        </Link>
      </nav>
    </Page>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-[20px] font-bold">{title}</h2>
      <div className="space-y-2 text-ink/85">{children}</div>
    </section>
  )
}

/** A link to another site, which opens in a new tab and says so to screen readers. */
function External({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className={link}>
      {children}
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  )
}

const Email = () => (
  <a href={`mailto:${CONTACT_EMAIL}`} className={link}>
    {CONTACT_EMAIL}
  </a>
)

export function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy">
      <p>
        Forge tracks your workouts, food, weight, and habits. It's operated by {OPERATOR} ("we", "us") and built to know as
        little about you as possible: you sign in with Apple, there are no ads or analytics, and we never sell or share
        your personal information.
      </p>

      <Section title="What we collect, and why">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>What you log.</strong> Your workouts, maxes, and weekly plan, the food you log and the meals you save, your
            weigh-ins, your habits and check-offs, your Time Out goals, and your goals with what they're worked out from
            (sex, birth year, height, weight, activity level, and your goal and goal weight). We store them on our server so Forge can show
            them to you on any iPhone you sign in on. We use them only to run Forge for you, never for advertising.
          </li>
          <li>
            <strong>Your Sign in with Apple ID.</strong> When you sign in, Apple tells us a random identifier for your Apple
            account, which is the same each time you sign in to Forge. We store it to find your data. We don't ask Apple for
            your name or email, so we never receive them.
          </li>
          <li>
            <strong>Apple Health, if you connect it.</strong> In the iPhone app you can let Forge read your workouts (from
            your Apple Watch and other apps), heart rate, and active calories from Apple Health. Forge stores the workouts
            it brings in, with their calories and heart rate, and your daily active calories on our server, to show them
            with your training and count them in your calorie budget. Health data is never used for advertising or
            marketing, never sold, and never shared with anyone else. Forge only reads from Health; it never writes to it.
            You can stop it any time in the Health app (Sharing → Apps → Forge), and Delete Account removes everything it
            brought in.
          </li>
          <li>
            <strong>Photos you scan.</strong> When you scan a nutrition label or a meal, the photo goes to our server and on
            to Anthropic, whose Claude AI reads it and sends back the nutrition it found. We don't store the photo; we only
            count how many scans you make each day, to keep costs in check. You're asked before your first scan.
          </li>
          <li>
            <strong>Food searches.</strong> The words you search for are sent from our server to the US Department of
            Agriculture's FoodData Central database. The USDA receives the search, not anything about you.
          </li>
          <li>
            <strong>On your device.</strong> Forge keeps the workout in progress, the data it last loaded (so it works with
            no signal), and your settings on your phone or browser. It never leaves your device unless it's part of what
            you log.
          </li>
          <li>
            <strong>Technical data.</strong> Like any website, our hosting receives your IP address and basic request
            details in order to deliver Forge and keep it secure. We don't keep request logs ourselves. When something goes
            wrong on our server, it records the error (not your data) so we can fix it.
          </li>
          <li>
            <strong>Messages you send us.</strong> If you email us, we receive what you send, and use it only to reply and
            improve Forge.
          </li>
        </ul>
      </Section>

      <Section title="What we don't do">
        <p>
          We don't sell your personal information or share it for advertising, don't show ads, don't use analytics or
          tracking of any kind, don't track you across other companies' apps or websites, and don't use data brokers.
        </p>
      </Section>

      <Section title="Services that handle data for us">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>Microsoft Azure</strong> hosts the website, our server, and its database, in the United States.{' '}
            <External href="https://privacy.microsoft.com/en-us/privacystatement">Microsoft's privacy statement</External>
          </li>
          <li>
            <strong>Apple</strong> handles Sign in with Apple.{' '}
            <External href="https://www.apple.com/legal/privacy/">Apple's privacy policy</External>
          </li>
          <li>
            <strong>Anthropic</strong> reads the photos you scan, only when you scan one. Under its commercial terms,
            Anthropic doesn't train its models on them.{' '}
            <External href="https://www.anthropic.com/legal/privacy">Anthropic's privacy policy</External>
          </li>
          <li>
            <strong>USDA FoodData Central</strong> answers food searches, which our server sends without anything about you.
          </li>
        </ul>
      </Section>

      <Section title="How long we keep it">
        <p>What you log and your account: until you delete them (see below). Scan counts: a day each. Messages: as long as needed to answer them.</p>
      </Section>

      <Section title="Your choices and rights">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>Delete your account now:</strong> Settings → Delete Account removes your account and everything you've
            logged from our server right away, revokes Forge's Sign in with Apple access, and clears what Forge stored on
            this device. Deleting the app doesn't delete your account: sign in again and your data is still there.
          </li>
          <li>
            <strong>Access, correction, and deletion:</strong> depending on where you live (for example California, other US
            states, the European Economic Area, or the UK), you may have the right to know what personal information we
            have about you, get a copy, correct it, delete it, or object to or restrict how we use it. Email <Email />.
            We'll answer within 30 days (45 where the law allows more time). Because we don't know your name or email, we
            may ask you to use Delete Account, which works instantly. We won't treat you differently
            for using these rights.
          </li>
          <li>
            If you're in the EEA or UK, you can also complain to your local data protection authority. We use your data to
            provide the features you use, with your consent (photo scans), and for our legitimate interest in keeping
            Forge secure.
          </li>
        </ul>
      </Section>

      <Section title="Security">
        <p>
          All connections use encryption (HTTPS), and our keys and passwords are stored as encrypted secrets, never in our
          code. Only someone signed in to your Apple account can see what you've logged.
        </p>
      </Section>

      <Section title="Where your data is stored">
        <p>In the United States. If you use Forge from elsewhere, your data is transferred to and stored in the US.</p>
      </Section>

      <Section title="Children">
        <p>
          Forge is for people 13 and older, and doesn't knowingly collect personal information from children under 13. If
          you believe a child has given us personal information, email <Email /> and we'll delete it.
        </p>
      </Section>

      <Section title="Changes and contact">
        <p>
          If this policy changes, we'll update this page and the date above, and ask you to agree again in the app if the
          change is significant. Questions or requests: <Email />.
        </p>
      </Section>
    </LegalPage>
  )
}

export function TermsPage() {
  return (
    <LegalPage title="Terms of Use">
      <p>
        These terms are an agreement between you and {OPERATOR} ("we", "us"), which operates Forge. By using the Forge
        website or app, you agree to them. If you don't agree, please don't use Forge.
      </p>

      <Section title="What Forge is">
        <p>
          Forge is a free app for logging workouts, food, weight, and habits, with goals and progress to keep you going.
          It's for general fitness and wellness information only.
        </p>
      </Section>

      <Section title="Not medical advice">
        <p>
          Forge isn't a medical device and doesn't give medical advice. Its calorie and macro goals, exercise calories, and
          nutrition from searches and photo scans are estimates, and can be wrong; photo scans in particular are read by
          AI and can mistake a food or a portion. Check anything that matters to you.
        </p>
        <p>
          Talk to a doctor before starting a new diet or exercise program, especially if you're pregnant, have a health
          condition, take medication, or have a history of disordered eating. Stop exercising and get help if you feel pain,
          dizziness, or shortness of breath. In an emergency, call 911.
        </p>
      </Section>

      <Section title="Using Forge">
        <p>You agree not to:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>break any law while using Forge;</li>
          <li>disrupt, overload, or try to gain unauthorized access to Forge or its servers;</li>
          <li>scrape Forge or its API, or use automated tools to access them beyond normal personal use;</li>
          <li>copy, resell, or redistribute Forge as your own service.</li>
        </ul>
        <p>
          What you log is yours. You're responsible for what you enter, for keeping your Apple account secure, and you can
          delete it all at any time in Settings.
        </p>
      </Section>

      <Section title="Other services">
        <p>
          Forge uses services from other companies: Anthropic reads photos you scan, and the USDA's FoodData Central answers
          food searches. If you got the app from Apple's App Store, Apple's{' '}
          <External href="https://www.apple.com/legal/internet-services/itunes/dev/stdeula/">Licensed Application End User License Agreement</External>{' '}
          also applies. We're not responsible for other companies' services or websites we link to.
        </p>
      </Section>

      <Section title="Ownership">
        <p>
          Forge's name, logo, design, and software belong to {OPERATOR}. Forge's source code is published on GitHub for
          transparency; publishing it doesn't give anyone a license to reuse it.
        </p>
      </Section>

      <Section title="No warranty">
        <p>
          Forge is provided "as is" and "as available", without warranties of any kind, express or implied, including
          warranties of accuracy, reliability, availability, merchantability, fitness for a particular purpose, and
          non-infringement. We don't promise that Forge will be uninterrupted, error-free, or accurate.
        </p>
      </Section>

      <Section title="Limits on our liability">
        <p>
          To the fullest extent the law allows, {OPERATOR} won't be liable for any indirect, incidental, special,
          consequential, or punitive damages, or for injury, lost data, or other loss, arising from your use of Forge or
          your reliance on its information. Our total liability for any claim about Forge is limited to US$50. Some places
          don't allow these limits, so they may not all apply to you; nothing in these terms limits rights you have under
          laws that can't be waived.
        </p>
      </Section>

      <Section title="Changes">
        <p>
          We may change Forge, or stop offering it, at any time. We may update these terms; the date above shows when they
          last changed, and continuing to use Forge after a change means you accept it.
        </p>
      </Section>

      <Section title="Governing law">
        <p>
          These terms are governed by the laws of the Commonwealth of {GOVERNING_STATE} and applicable US federal law,
          without regard to conflict-of-law rules. Any dispute will be handled in the state or federal courts located in{' '}
          {GOVERNING_STATE}, unless the law where you live gives you the right to bring it elsewhere. If any part of these
          terms can't be enforced, the rest still applies.
        </p>
      </Section>

      <Section title="Contact">
        <p>
          Questions about these terms: <Email />. How we handle your data is covered in the{' '}
          <Link to="/privacy" className={link}>
            Privacy Policy
          </Link>
          .
        </p>
      </Section>
    </LegalPage>
  )
}

const QUESTIONS: [string, ReactNode][] = [
  ['How do I get my data on a new phone?', 'Sign in with the same Apple account and everything is there. The same goes if you delete Forge and install it again.'],
  ['How are my calorie goals worked out?', 'From your details in Settings → Goals, with the Mifflin-St Jeor formula most dietitians use, adjusted for your activity and goal. You can change any number by hand. On workout days, Forge adds an estimate of what you burned.'],
  ['A photo scan got it wrong.', 'Scans are read by AI and are estimates. Check the numbers before you log, and edit them if they look off. A clear, flat, well-lit photo of the label works best.'],
  ['Why does Time Out not lock my apps yet?', "Locking apps uses Apple's Screen Time, which only an iPhone app can use. It's coming to the Forge iPhone app; the goals and their status work today."],
  ['How do I delete my data?', 'Settings → Delete Account removes your account and everything you logged from our server right away, and clears what Forge stored on your device. Or email us.'],
]

export function SupportPage() {
  return (
    <LegalPage title="Help & Support">
      <Section title="Contact us">
        <p>
          Email <Email /> with questions, problems, or ideas. Tell us what you were doing and which screen you were on. We
          usually reply within a few days.
        </p>
      </Section>
      <Section title="Common questions">
        <dl className="space-y-3">
          {QUESTIONS.map(([question, answer]) => (
            <div key={question}>
              <dt className="font-semibold text-ink">{question}</dt>
              <dd>{answer}</dd>
            </div>
          ))}
        </dl>
      </Section>
    </LegalPage>
  )
}
