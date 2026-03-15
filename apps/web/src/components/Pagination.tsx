/**
 * Pagination — Reusable server-side pagination component.
 * Shows page numbers, previous/next, and items-per-page info.
 */
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface PaginationProps {
  page: number
  totalPages: number
  totalItems: number
  pageSize: number
  onPageChange: (page: number) => void
}

export function Pagination({ page, totalPages, totalItems, pageSize, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null

  const startItem = (page - 1) * pageSize + 1
  const endItem = Math.min(page * pageSize, totalItems)

  // Generate page numbers to show (max 5 with ellipsis)
  function getPages(): (number | '...')[] {
    if (totalPages <= 5) return Array.from({ length: totalPages }, (_, i) => i + 1)
    const pages: (number | '...')[] = [1]
    if (page > 3) pages.push('...')
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) {
      pages.push(i)
    }
    if (page < totalPages - 2) pages.push('...')
    pages.push(totalPages)
    return pages
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '14px 0', fontFamily: 'Outfit, sans-serif',
      flexWrap: 'wrap', gap: 10,
    }}>
      <span style={{ fontSize: 12, color: '#94a3b8' }}>
        {startItem}–{endItem} / {totalItems}
      </span>

      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          style={{
            ...btnStyle,
            opacity: page <= 1 ? 0.4 : 1,
            cursor: page <= 1 ? 'default' : 'pointer',
          }}
        >
          <ChevronLeft size={14} />
        </button>

        {getPages().map((p, i) =>
          p === '...' ? (
            <span key={`e${i}`} style={{ padding: '0 4px', fontSize: 12, color: '#cbd5e1' }}>…</span>
          ) : (
            <button
              key={p}
              onClick={() => onPageChange(p)}
              style={{
                ...btnStyle,
                background: p === page ? '#7c3aed' : 'transparent',
                color: p === page ? '#fff' : '#475569',
                fontWeight: p === page ? 700 : 500,
                border: p === page ? 'none' : '1px solid #e2e8f0',
              }}
            >
              {p}
            </button>
          )
        )}

        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          style={{
            ...btnStyle,
            opacity: page >= totalPages ? 0.4 : 1,
            cursor: page >= totalPages ? 'default' : 'pointer',
          }}
        >
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  )
}

const btnStyle: React.CSSProperties = {
  width: 32, height: 32, borderRadius: 8,
  border: '1px solid #e2e8f0', background: '#fff',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  cursor: 'pointer', fontSize: 12, fontFamily: 'Outfit, sans-serif',
  color: '#475569',
}
