const key = 'proxy-theme'

export type Theme = 'light' | 'dark'

export function readTheme(): Theme {
  const stored = localStorage.getItem(key)
  return stored === 'dark' ? 'dark' : 'light'
}

export function applyTheme(theme: Theme) {
  document.documentElement.setAttribute('data-bs-theme', theme)
  localStorage.setItem(key, theme)
}
