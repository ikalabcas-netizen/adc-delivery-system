/** Merge class names, filtering falsy values */
export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ')
}

/** Format datetime to Vietnamese locale */
export function formatDate(date: string | Date, opts?: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'short',
    timeStyle: 'short',
    ...opts,
  }).format(new Date(date))
}

/** Format relative time (e.g. "2 phút trước") */
export function formatRelative(date: string | Date): string {
  const diff = Date.now() - new Date(date).getTime()
  const mins  = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days  = Math.floor(diff / 86400000)

  if (mins < 1)   return 'Vừa xong'
  if (mins < 60)  return `${mins} phút trước`
  if (hours < 24) return `${hours} giờ trước`
  return `${days} ngày trước`
}

/** Map order status → display label */
export const STATUS_LABELS: Record<string, string> = {
  pending:    'Chờ xử lý',
  assigned:   'Đã phân công',
  in_transit: 'Đang giao',
  delivered:  'Đã giao',

  cancelled:  'Đã huỷ',
}

/** Map order status → badge CSS class */
export const STATUS_BADGE_CLASS: Record<string, string> = {
  pending:    'badge-pending',
  assigned:   'badge-assigned',
  in_transit: 'badge-in-transit',
  delivered:  'badge-delivered',

  cancelled:  'badge-cancelled',
}
