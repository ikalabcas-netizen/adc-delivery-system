---
name: ADC Delivery System - Design Style
description: >
  Design language và component patterns cho dự án ADC Delivery System.
  Luôn gọi skill này khi thiết kế hoặc chỉnh sửa bất kỳ UI nào trong project
  adc-delivery-system để đảm bảo nhất quán toàn hệ thống.
---

# ADC Design System — Hướng dẫn thiết kế

## 1. Nguyên tắc chung
- **Font**: `Outfit, sans-serif` — dùng cho toàn bộ text
- **Màu nền trang**: `#eef2f5` (slate neutral nhạt)
- **Không dùng Tailwind** cho inline layout — ưu tiên `style={{}}` props để kiểm soát chính xác
- **Animations**: đơn giản, `transition: all 0.15s ease` hoặc `cubic-bezier(0.4,0,0.2,1)`
- **Border radius chuẩn**: card = 12–16px, button/input = 8–10px, badge = 20px (pill)

### ⚠️ Quy tắc bắt buộc: Tương phản màu (Color Contrast)

> **Màu chữ và màu nền KHÔNG ĐƯỢC trùng hoặc gần tông màu nhau. Phải có độ tương phản rõ rệt.**

- **Nền tối (dark)** → chữ **trắng hoặc sáng** (`Colors.white`, `#F8FAFC`, `#E2E8F0`)
- **Nền sáng (light/white)** → chữ **tối** (`#1E293B` slate-800, `#0F172A` slate-900)
- **AppBar nền `#0A3444`** → icon/chữ màu `Colors.white` LUÔN LUÔN
- **PopupMenu / Dropdown / Card** → phải set **màu nền tường minh** (`color: Colors.white` hoặc tối tường minh), KHÔNG để theme tự quyết (tránh dark mode làm chữ tối trên nền tối)
- **Flutter**: dùng `color: Colors.white, surfaceTintColor: Colors.transparent` cho `PopupMenuButton` khi cần đảm bảo nền sáng
- **Web**: dùng `background: '#fff'` tường minh cho dropdown/card thay vì `background: 'transparent'`

---

## 2. Bảng màu ADC (Cyan Palette)

```
Cyan 500 (primary action): #06b6d4
Cyan 600 (hover/dark):     #0891b2
Cyan 300 (highlight):      #67e8f9
Cyan 100 (light bg):       #cffafe
Cyan 50  (ultra light):    #ecfeff

Navy sidebar bg:     linear-gradient(180deg, #0c4a6e 0%, #083344 100%)
Page background:     #eef2f5
Card background:     #ffffff  (hoặc rgba(255,255,255,0.85) cho glassmorphism)
Border:              #e2e8f0  (hoặc rgba(6,182,212,0.2) cho ADC tint)
Text primary:        #0f172a
Text secondary:      #475569
Text muted:          #94a3b8
```

---

## 3. Gradient & Glassmorphism Card (dùng cho login, modal, pending page)

```tsx
// Outer container (full viewport centering)
style={{
  position: 'fixed', inset: 0,
  background: 'linear-gradient(135deg, #ecfeff 0%, #f0f9ff 40%, #e0f2fe 100%)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: 16, fontFamily: 'Outfit, sans-serif',
}}

// Glassmorphism card
style={{
  width: '100%', maxWidth: 420,
  background: 'rgba(255,255,255,0.85)',
  backdropFilter: 'blur(20px)',
  borderRadius: 20,
  border: '1px solid rgba(6,182,212,0.2)',
  boxShadow: '0 8px 40px rgba(6,182,212,0.12), 0 2px 8px rgba(0,0,0,0.06)',
  padding: '40px 36px 32px',
}}
```

---

## 4. Responsive Shell & Layout (`ResponsiveShell.tsx`)

**ALL layouts MUST use `ResponsiveShell`** — the shared component handles responsive sidebar automatically.

```tsx
import { ResponsiveShell, NavItem } from '@/components/layout/ResponsiveShell'

const NAV_ITEMS: NavItem[] = [
  { to: '/coordinator/dashboard', icon: BarChart3, label: 'Dashboard' },
  // ...
]

export function MyLayout() {
  return (
    <ResponsiveShell
      navItems={NAV_ITEMS}
      accentColor="#06b6d4"    // role-specific accent
      roleLabel="Điều phối viên"
      profilePath="/coordinator/profile"
    >
      <Routes>...</Routes>
    </ResponsiveShell>
  )
}
```

### Role Accent Colors

| Role | Accent | Hex |
|------|--------|-----|
| Coordinator | Cyan | `#06b6d4` |
| Sales | Amber | `#f59e0b` |
| Delivery | Emerald | `#10b981` |
| Admin | Purple | `#8b5cf6` |

### Responsive Breakpoints

| Breakpoint | Sidebar | Main Padding | Behavior |
|------------|---------|--------------|----------|
| Desktop (>768px) | Fixed 220px left | `28px 32px` | Always visible |
| Mobile (≤768px) | Hidden (drawer) | `16px` | Hamburger top-left → slide-out 260px |

### Mobile Features
- **Hamburger button** top-left with ADC brand bar
- **Slide-out drawer** with `slideInLeft` animation (0.2s)
- **Backdrop overlay** with blur — click to close
- **Auto-close** on route navigation
- **ESC key** to close drawer
- **Content pages**: use `maxWidth` and responsive grids to adapt

### Grid Responsive Pattern

```tsx
// KPI cards, driver grids, etc.
style={{
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',  // min 160px on mobile
  gap: 12,
}}

// Two-column sections → stack on mobile
style={{
  display: 'grid',
  gridTemplateColumns: window.innerWidth > 768 ? '1fr 1fr' : '1fr',
  gap: 16,
}}
```

---

## 5. Sidebar — Internal Structure (managed by ResponsiveShell)

```tsx
// Sidebar background (dark navy)
background: 'linear-gradient(180deg, #0B1929 0%, #0F2847 100%)'

// Nav item ACTIVE — uses role accentColor dynamically
background: `${accentColor}22`, color: accentColor,
borderLeft: `2px solid ${accentColor}`, borderRadius: 8

// Nav item INACTIVE
color: 'rgba(255,255,255,0.55)', borderLeft: '2px solid transparent'
```

---

## 6. Cards / List items (trang nội dung)

```tsx
// Standard white card
style={{
  background: '#fff', borderRadius: 12,
  border: '1px solid #e2e8f0', padding: '14px 16px',
  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
}}
```

---

## 7. Buttons

```tsx
// Primary (Cyan gradient)
style={{
  padding: '9px 20px',
  background: 'linear-gradient(135deg, #06b6d4, #0891b2)',
  color: '#fff', border: 'none', borderRadius: 9,
  fontSize: 13, fontWeight: 600, cursor: 'pointer',
  fontFamily: 'Outfit, sans-serif',
  boxShadow: '0 2px 8px rgba(6,182,212,0.3)',
}}

// Secondary
style={{
  padding: '9px 16px', background: '#f8fafc', color: '#475569',
  border: '1px solid #e2e8f0', borderRadius: 9,
  fontSize: 13, cursor: 'pointer', fontFamily: 'Outfit, sans-serif',
}}

// Danger
style={{
  background: '#fff1f2', color: '#e11d48',
  border: '1px solid rgba(225,29,72,0.15)',
  borderRadius: 9, padding: '9px 14px', fontSize: 13,
}}
```

---

## 8. Status Badges

```tsx
const ROLE_MAP = {
  super_admin: { bg: '#f3f0ff', color: '#7c3aed', label: 'Super Admin' },
  coordinator: { bg: '#eff6ff', color: '#2563eb', label: 'Điều phối viên' },
  sales:       { bg: '#ecfeff', color: '#0891b2', label: 'Kinh doanh' },
  manager:     { bg: '#f0fdf4', color: '#059669', label: 'Quản lý' },
  delivery:    { bg: '#fffbeb', color: '#d97706', label: 'Giao nhận' },
}

const STATUS_MAP = {
  pending:    { bg: '#fffbeb', color: '#d97706', label: 'Chờ xử lý' },
  assigned:   { bg: '#eff6ff', color: '#2563eb', label: 'Đã gán' },
  in_transit: { bg: '#f3f0ff', color: '#7c3aed', label: 'Đang giao' },
  delivered:  { bg: '#f0fdf4', color: '#16a34a', label: 'Đã giao' },
  failed:     { bg: '#fff1f2', color: '#e11d48', label: 'Thất bại' },
  cancelled:  { bg: '#f8fafc', color: '#94a3b8', label: 'Huỷ' },
}
```

---

## 9. Form Inputs

```tsx
style={{
  width: '100%', padding: '9px 12px',
  border: '1px solid #e2e8f0', borderRadius: 9,
  fontSize: 13, fontFamily: 'Outfit, sans-serif',
  color: '#1e293b', background: '#fff',
  outline: 'none', boxSizing: 'border-box',
}}
// Focus: border-color: #06b6d4, box-shadow: 0 0 0 3px rgba(6,182,212,0.1)
```

---

## 10. Modals (glassmorphism overlay)

```tsx
// Backdrop
style={{
  position: 'fixed', inset: 0,
  background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(4px)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  zIndex: 100, padding: 16,
}}

// Modal box
style={{
  background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(20px)',
  borderRadius: 16, padding: 28,
  width: '100%', maxWidth: 420,
  boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
  border: '1px solid rgba(6,182,212,0.15)',
}}
```

---

## 11. Page Header Pattern

```tsx
<div style={{ marginBottom: 24 }}>
  <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0f172a', margin: 0, fontFamily: 'Outfit, sans-serif' }}>
    Tên trang
  </h1>
  <p style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>Subtitle / thống kê</p>
</div>
```

---

## 12. Các file tham chiếu trong project

| File | Vai trò |
|---|---|
| `apps/web/src/components/layout/ResponsiveShell.tsx` | **Shared responsive shell — all layouts MUST use** |
| `apps/web/src/pages/LoginPage.tsx` | Template nền trang trước auth |
| `apps/web/src/pages/PendingApprovalPage.tsx` | Template glassmorphism card toàn trang |
| `apps/web/src/pages/coordinator/CoordinatorLayout.tsx` | Example layout using ResponsiveShell |
| `apps/web/src/pages/admin/AdminUsersPage.tsx` | Template card-list + modal pattern |
| `apps/web/src/pages/ProfileSettingsPage.tsx` | Template form settings |
| `apps/web/src/index.css` | Outfit font import, CSS variables |
