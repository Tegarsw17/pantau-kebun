# Pantau Kebun Inventory Module

## Scope

Inventory uses a storefront-style card grid instead of tables. It supports two roles:

- `admin`: can view stock, expiry, financial price data, and create stock mutations.
- `non-admin`: can view item stock and expiry warnings only.

The implementation follows the current app structure: React JSX, Vite, plain CSS, TanStack Router, and direct Supabase REST calls with static fallback data.

## Database Model

The inventory model is ledger-based:

- `items` stores master data, optional item image URL, and the cached `current_stock`.
- `stock_movements` stores append-only stock transactions.

`stock_movements.qty` is signed:

- `IN`: positive quantity.
- `OUT`, `ADJUSTMENT`, `MAINTENANCE`, `DISPOSAL`: negative quantity.

`price_per_unit` is only valid for `IN` movements. Expiry dates are optional and mainly used for incoming fertilizer, nutrients, hormones, and agrochemical stock.

SQL lives in:

- `supabase/inventory.sql`

## UI Behavior

Main inventory view:

- Search input filters by item name, brand, category, and unit.
- Horizontal tabs filter by the four inventory categories.
- Items render as responsive cards: 1 column on mobile, 3-4 columns on desktop.
- Cards render `items.image_url` when available and fall back to a category visual when empty.
- Admin item creation uploads images to Cloudinary using `VITE_PUBLIC_CLOUDINARY_CLOUD_NAME` and `VITE_PUBLIC_CLOUDINARY_UPLOAD_PRESET`, with Cloudinary folder `item-image`.
- Cards show category visual, category badge, name and brand, stock level, stock status, and expiry warning.

Stock states:

- Safe: `current_stock > low_stock_threshold`.
- Low stock: `current_stock <= low_stock_threshold`.
- Out of stock: `current_stock == 0`.

Expiry states:

- Expired: latest expiry date is before today.
- Expiring soon: latest expiry date is within the next 6 months.
- No badge: no latest expiry date or expiry is more than 6 months away.

Admin-only behavior:

- Admin can create new master items from `Tambah Item`.
- New item creation supports optional Cloudinary image upload and optional initial stock.
- Admin inventory does not use static fallback data; Supabase must be configured and reachable.
- Item cards show financial information when available.
- Item cards show the `Mutasi Stok` button.
- Mutation modal supports `Stok Masuk`, `Stok Keluar`, and `Penyesuaian`.
- Price and expiry fields are only rendered for `Stok Masuk`.

## Git Commit Strategy

1. `feat(db): create inventory ledger schema`
   - Add database DDL and this module documentation.

2. `feat(inventory): add inventory data model and loaders`
   - Add inventory constants, static fallback data, Supabase REST helpers, and normalization logic.

3. `feat(inventory): build storefront card grid`
   - Add shared inventory storefront components, search, filters, stock status, and expiry warnings.

4. `feat(inventory): add admin stock mutation modal`
   - Add admin-only mutation modal, dynamic form fields, validation, and stock movement submission.

5. `feat(inventory): wire inventory routes by role`
   - Connect user and admin inventory pages.

6. `style(inventory): polish dark storefront experience`
   - Add dark-mode storefront, card, badge, and modal styles.

7. `test(build): verify inventory module build`
   - Run `npm run build` and commit the verified state.
