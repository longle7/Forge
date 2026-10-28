// Frees development certificate slots before the TestFlight archive (Node 24, no dependencies). Each run is a fresh
// Mac with an empty keychain, so Xcode makes a new Apple Development certificate every time, and once Apple's limit is
// reached the archive fails ("Your account has reached the maximum number of certificates").
// Forge is only ever built here (there's no Mac), so every development certificate on the team is a leftover from an
// earlier run: revoke them all. Distribution certificates are never touched.
// ponytail: NextTrain shares the team, so this also revokes its leftovers, and an app archiving at the very same moment
// would lose its certificate mid-build; run the two TestFlight workflows one at a time.
// Run by .github/workflows/testflight.yml, which sets ASC_KEY_ID, ASC_ISSUER_ID, and ASC_KEY_PATH.
import { readFileSync } from 'node:fs'
import { client } from './testflight-testers.mjs'

const { ASC_KEY_ID, ASC_ISSUER_ID, ASC_KEY_PATH } = process.env
const api = client(ASC_KEY_ID, ASC_ISSUER_ID, readFileSync(ASC_KEY_PATH, 'utf8'))

// DEVELOPMENT is "Apple Development"; IOS_DEVELOPMENT, the older "iOS Development".
const { data } = await api('GET', '/v1/certificates?filter[certificateType]=DEVELOPMENT,IOS_DEVELOPMENT&limit=200')
for (const certificate of data) {
  await api('DELETE', `/v1/certificates/${certificate.id}`)
  console.log(`Revoked ${certificate.attributes.name}, serial ${certificate.attributes.serialNumber}`)
}
console.log(`Development certificates revoked: ${data.length}.`)
