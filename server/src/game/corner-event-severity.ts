export function getCornerEventSeverity(cornerType?: string): 'minor' | 'normal' {
  if (cornerType === 'start' || cornerType === 'ding') {
    return 'minor';
  }

  return 'normal';
}
