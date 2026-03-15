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

## 4. Sidebar Layout (Admin / Coordinator / Monitor)

```tsx
// Sidebar outer
style={{
  width: 220, flexShrink: 0,
  background: 'linear-gradient(180deg, #0c4a6e 0%, #083344 100%)',
  display: 'flex', flexDirection: 'column', height: '100vh',
  boxShadow: '2px 0 12px rgba(0,0,0,0.15)',
}}

// Nav item ACTIVE
style={{
  background: 'rgba(6,182,212,0.2)',
  color: '#67e8f9',
  borderLeft: '2px solid #06b6d4',
  borderRadius: 8, padding: '9px 12px',
}}

// Nav item INACTIVE
style={{
  color: 'rgba(255,255,255,0.65)',
  borderLeft: '2px solid transparent',
  borderRadius: 8, padding: '9px 12px',
}}

// Main content area
style={{
  flex: 1, overflowY: 'auto',
  padding: '28px 32px',
  background: '#eef2f5',
}}
```

---

## 5. Cards / List items (trang nội dung)

```tsx
// Standard white card
style={{
  background: '#fff',
  borderRadius: 12,
  border: '1px solid #e2e8f0',
  padding: '14px 16px',
  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
}}

// Card với ADC accent (pending/warning state)
style={{
  border: '1px solid rgba(217,119,6,0.2)',  // amber tint
  background: '#fff',
  borderRadius: 12,
}}
```

---

## 6. Buttons

```tsx
// Primary button (Cyan gradient)
style={{
  padding: '9px 20px',
  background: 'linear-gradient(135deg, #06b6d4, #0891b2)',
  color: '#fff', border: 'none', borderRadius: 9,
  fontSize: 13, fontWeight: 600, cursor: 'pointer',
  fontFamily: 'Outfit, sans-serif',
  boxShadow: '0 2px 8px rgba(6,182,212,0.3)',
}}

// Secondary button
style={{
  padding: '9px 16px',
  background: '#f8fafc', color: '#475569',
  border: '1px solid #e2e8f0', borderRadius: 9,
  fontSize: 13, cursor: 'pointer',
  fontFamily: 'Outfit, sans-serif',
}}

// Danger button
style={{
  background: '#fff1f2', color: '#e11d48',
  border: '1px solid rgba(225,29,72,0.15)',
  borderRadius: 9, padding: '9px 14px',
  fontSize: 13, cursor: 'pointer',
}}
```

---

## 7. Status Badges

```tsx
// Pending (chờ duyệt)
style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20,
  background: '#fffbeb', color: '#d97706', border: '1px solid rgba(217,119,6,0.2)' }}
// Text: "⏳ Chờ duyệt"

// Approved / Status badges by role
const ROLE_MAP = {
  super_admin: { bg: '#f3f0ff', color: '#7c3aed', label: 'Super Admin' },
  coordinator: { bg: '#eff6ff', color: '#2563eb', label: 'Điều phối viên' },
  sales:       { bg: '#ecfeff', color: '#0891b2', label: 'Kinh doanh' },
  manager:     { bg: '#f0fdf4', color: '#059669', label: 'Quản lý' },
  delivery:    { bg: '#fffbeb', color: '#d97706', label: 'Giao nhận' },
}
// Order status
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

## 8. Form Inputs

```tsx
style={{
  width: '100%', padding: '9px 12px',
  border: '1px solid #e2e8f0', borderRadius: 9,
  fontSize: 13, fontFamily: 'Outfit, sans-serif',
  color: '#1e293b', background: '#fff',
  outline: 'none', boxSizing: 'border-box',
}}
// Focus: border-color: #06b6d4, box-shadow: 0 0 0 3px rgba(6,182,212,0.1)

// Label
style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}
```

---

## 9. Modals (glassmorphism overlay)

```tsx
// Backdrop
style={{
  position: 'fixed', inset: 0,
  background: 'rgba(15,23,42,0.5)',
  backdropFilter: 'blur(4px)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  zIndex: 100, padding: 16,
}}

// Modal box
style={{
  background: 'rgba(255,255,255,0.95)',
  backdropFilter: 'blur(20px)',
  borderRadius: 16, padding: 28,
  width: '100%', maxWidth: 420,
  boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
  border: '1px solid rgba(6,182,212,0.15)',
}}
```

---

## 10. Page Header Pattern

```tsx
<div style={{ marginBottom: 24 }}>
  <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0f172a', margin: 0, fontFamily: 'Outfit, sans-serif' }}>
    Tên trang
  </h1>
  <p style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>Subtitle / thống kê</p>
</div>
```

---

## 11. Avatar với initials fallback

```tsx
{user.avatar_url ? (
  <img src={user.avatar_url} alt=""
    style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', border: '2px solid #e2e8f0' }} />
) : (
  <div style={{
    width: 40, height: 40, borderRadius: '50%',
    background: 'linear-gradient(135deg, #cffafe, #a5f3fc)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 15, fontWeight: 700, color: '#0891b2',
  }}>
    {(user.full_name ?? user.email ?? '?')[0].toUpperCase()}
  </div>
)}
```

---

## 12. Logo ADC

```tsx
<img
  src="/logo.png"
  alt="ADC Delivery System"
  style={{ width: '67%', height: 'auto', objectFit: 'contain' }}
  onError={(e) => { e.currentTarget.style.display = 'none' }}
/>
// Trong sidebar: height: 32px, filter: 'brightness(1.2)'
```

---

## 13. Section dividers (trong trang list)

```tsx
<div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
  <SomeIcon size={14} color="#d97706" />
  <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase',
    letterSpacing: '0.08em', color: '#d97706' }}>
    Tiêu đề section (N items)
  </span>
</div>
```

---

## 14. Các file tham chiếu trong project

| File | Vai trò |
|---|---|
| `apps/web/src/pages/LoginPage.tsx` | Template nền trang trước auth |
| `apps/web/src/pages/PendingApprovalPage.tsx` | Template glassmorphism card toàn trang |
| `apps/web/src/pages/admin/AdminLayout.tsx` | Template sidebar + main layout |
| `apps/web/src/pages/admin/AdminUsersPage.tsx` | Template card-list + modal pattern |
| `apps/web/src/pages/ProfileSettingsPage.tsx` | Template form settings |
| `apps/web/tailwind.config.js` | Token màu `adc-*` và `surface-*` |
| `apps/web/src/index.css` | Outfit font import, CSS variables |
