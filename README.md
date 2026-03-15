# ADC Delivery System

Hệ thống quản lý đơn hàng giao nhận toàn diện cho ADC.

## Cấu Trúc Dự Án

```
adc-delivery-system/
├── apps/
│   ├── web/          # React 18 + Vite 5 — Dashboard Điều phối & Giám sát
│   └── mobile/       # Flutter 3.24 (APK) — App Giao nhận
├── packages/
│   └── shared-types/ # TypeScript types dùng chung
├── supabase/
│   ├── migrations/   # SQL schema migrations
│   └── functions/    # Supabase Edge Functions (Deno)
└── .github/
    └── workflows/    # CI/CD pipelines
```

## Tech Stack

| Layer | Công nghệ |
|---|---|
| Web | React 18.3 + Vite 5.4 + TypeScript 5.5 |
| Mobile | Flutter 3.24 (Stable) + Riverpod 2.5 |
| Backend | Supabase (PostgreSQL 15 + Auth + Realtime + Storage) |
| Maps | Mapbox GL JS 3.6 (web) + mapbox_maps_flutter 2.3 (mobile) |
| Route Opt | OpenRouteService v2 API (VRPTW) |
| Cache | Upstash Redis (Geocoding + Route + Log HOT cache) |
| Deployment | Vercel (web) + GitHub Actions |

## Bắt Đầu

### Prerequisites

- Node.js v20 LTS
- Flutter 3.24 (Stable Channel)
- Supabase CLI
- Git

### Cài Đặt

```bash
# Clone repo
git clone https://github.com/YOUR_ORG/adc-delivery-system.git
cd adc-delivery-system

# Cài dependencies (web + shared-types)
npm install

# Chạy web dev server
npm run dev:web
```

### Biến Môi Trường

Copy file env mẫu và điền thông tin:

```bash
cp apps/web/.env.example apps/web/.env.local
```

Xem `apps/web/.env.example` để biết các biến cần thiết.

## Vai Trò Người Dùng

| Vai trò | Giao diện | Quyền hạn |
|---|---|---|
| Super Admin | Web | Duyệt vai trò, quản lý toàn hệ thống |
| Điều phối | Web | Tạo đơn, phân công, xem realtime |
| Kinh doanh | Web | Xem-only |
| Quản lý | Web | Xem-only + báo cáo |
| Giao nhận | Flutter APK | Nhận đơn, cập nhật trạng thái |

## Tài Liệu

- [Kế hoạch triển khai](./docs/implementation_plan.md)
- [Supabase Schema](./supabase/migrations/)
- [API Edge Functions](./supabase/functions/)
