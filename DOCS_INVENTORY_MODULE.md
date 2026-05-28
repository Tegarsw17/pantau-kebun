# Pantau Kebun Inventory Module

## Scope

Inventory uses a storefront-style card grid instead of tables. It supports two roles:

- `admin`: can view stock, expiry, financial price data, and create stock mutations.
- `non-admin`: can view item stock and expiry warnings only.

The implementation follows the current app structure: React JSX, Vite, plain CSS, TanStack Router, and direct Supabase REST calls with static fallback data.

## Database Model

The inventory model is ledger-based:

- `items` stores master data, optional Cloudinary image URL/public ID, active/archive state, and the cached `current_stock`.
- `stock_movements` stores append-only stock transactions and `created_by` actor IDs from Supabase Auth.

`stock_movements.qty` is signed:

- `IN`: positive quantity.
- `OUT`, `ADJUSTMENT`, `MAINTENANCE`, `DISPOSAL`: negative quantity.

`price_per_unit` is only valid for `IN` movements. Expiry dates are optional and mainly used for incoming fertilizer, nutrients, hormones, and agrochemical stock.

SQL lives in:

- `supabase/inventory.sql`

## RBAC And RLS

The SQL enables row level security on `items` and `stock_movements`.

Role resolution expects one of these Supabase Auth JWT claims:

- `app_role`
- `app_metadata.role`
- `user_metadata.role`

It also supports a database role row in:

- `public.user_roles`

Admin values are:

- `admin`
- `inventory_admin`

Policy behavior:

- Anonymous/non-admin users can read active inventory items.
- Anonymous/non-admin users can read non-financial stock movement fields for active items.
- Admin users can read active and archived items.
- Admin users can create/update item master data.
- Admin users can insert stock movements for active items.
- `stock_movements` remains append-only; update/delete is blocked by trigger.

Important production note:

- The admin workspace now signs in through Supabase Auth email/password.
- Create the admin user in Supabase Auth, then insert the user's UUID into `public.user_roles` with role `admin` or `inventory_admin`. Add `display_name` and/or `email` so ledger actors render as readable labels.
- Re-enable RLS after applying the auth schema.
- PostgreSQL RLS is row-based, not column-based. The frontend avoids requesting `price_per_unit` for non-admin users. If field workers also become authenticated Supabase users, move financial data to a separate admin-only table/RPC before giving them database access.

Bootstrap an admin role after creating the Auth user:

```sql
insert into public.user_roles (user_id, role, display_name, email)
values ('AUTH_USER_UUID_HERE', 'admin', 'Admin Name', 'admin@example.com')
on conflict (user_id) do update
set
  role = excluded.role,
  display_name = excluded.display_name,
  email = excluded.email;
```

## UI Behavior

Main inventory view:

- Search input filters by item name, brand, category, and unit.
- Horizontal tabs filter by the four inventory categories.
- Items render as responsive cards: 1 column on mobile, 3-4 columns on desktop.
- Cards render `items.image_url` when available and fall back to a category visual when empty.
- Admin item creation uploads images to Cloudinary using `VITE_PUBLIC_CLOUDINARY_CLOUD_NAME` and `VITE_PUBLIC_CLOUDINARY_UPLOAD_PRESET`, with Cloudinary folder `item-image`.
- Uploaded item images store both `items.image_url` and `items.image_public_id` so cleanup/replacement can target the Cloudinary asset.
- When an admin replaces an item image, the frontend updates the inventory row first, then calls the `delete-cloudinary-image` Supabase Edge Function to delete the previous `item-image/*` Cloudinary asset. Cleanup failure does not roll back the item update.
- Cards show category visual, category badge, name and brand, stock level, stock status, and expiry warning.
- Table view supports client-side sorting by item, category, stock, threshold, expiry, and last price.

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
- Admin can archive and restore item master data from the edit modal.
- Item cards show financial information when available.
- Item cards show the `Mutasi Stok` button.
- Admin can export the visible stock ledger to CSV for reporting/accounting, optionally scoped by movement date range.
- Admin can see/export the authenticated actor label attached to each stock movement.
- Mutation modal supports `Stok Masuk`, `Stok Keluar`, and `Penyesuaian`.
- Mutation modal uses an explicit reason dropdown: `Pembelian`, `Aplikasi Lahan`, `Alat Rusak`, `Hibah Barang`, and `Kadaluarsa/Rusak`.
- Price and expiry fields are only rendered for `Stok Masuk`.

## Cloudinary Cleanup

Browser uploads remain unsigned and only use public Vite env vars:

- `VITE_PUBLIC_CLOUDINARY_CLOUD_NAME`
- `VITE_PUBLIC_CLOUDINARY_UPLOAD_PRESET`

Cloudinary deletion uses a Supabase Edge Function because the Cloudinary API secret must never be exposed in the browser. Deploy the function:

```bash
supabase functions deploy delete-cloudinary-image
```

Set these Edge Function secrets in Supabase:

```bash
supabase secrets set CLOUDINARY_CLOUD_NAME="your-cloud-name"
supabase secrets set CLOUDINARY_API_KEY="your-api-key"
supabase secrets set CLOUDINARY_API_SECRET="your-api-secret"
```

Supabase automatically provides `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to Edge Functions. The function requires a logged-in admin whose `public.user_roles.role` is `admin` or `inventory_admin`, and it only deletes Cloudinary public IDs under `item-image/`.

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
