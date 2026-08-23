export function modeBadge(mode: string): { label: string } {
  if (mode === 'mock') {
    return { label: 'Mock' }
  }

  if (mode === 'manual') {
    return { label: 'Manual' }
  }

  return { label: 'Passthrough' }
}
