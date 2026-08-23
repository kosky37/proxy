export function modeBadge(mode: string): { bg: string; label: string } {
  if (mode === 'mock') {
    return { bg: 'info', label: 'Mock' }
  }

  if (mode === 'manual') {
    return { bg: 'success', label: 'Manual' }
  }

  return { bg: 'secondary', label: 'Passthrough' }
}
