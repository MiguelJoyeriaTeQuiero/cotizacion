import { useEffect, useState } from 'react'

const KEY = 'tqm_cookie_consent'
export const CONSENT_EVENT = 'tqm-consentchange'
export const OPEN_SETTINGS_EVENT = 'tqm-open-cookie-settings'

export function readConsent() {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function saveConsent({ analytics = false, advertising = false }) {
  const value = {
    necessary: true,
    analytics: !!analytics,
    advertising: !!advertising,
    ts: Date.now(),
  }
  try {
    localStorage.setItem(KEY, JSON.stringify(value))
    // Mirror the decision in the cookie documented in the cookie policy.
    const accepted = value.analytics || value.advertising ? 1 : 0
    document.cookie = `catAccCookies=${accepted}; max-age=${60 * 60 * 24 * 365}; path=/; SameSite=Lax`
  } catch {
    /* ignore storage errors */
  }
  window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: value }))
  return value
}

export function openCookieSettings() {
  window.dispatchEvent(new Event(OPEN_SETTINGS_EVENT))
}

// React hook: returns the current consent object (or null) and updates on change.
export function useConsent() {
  const [consent, setConsent] = useState(readConsent)
  useEffect(() => {
    const handler = e => setConsent(e.detail ?? readConsent())
    window.addEventListener(CONSENT_EVENT, handler)
    return () => window.removeEventListener(CONSENT_EVENT, handler)
  }, [])
  return consent
}
