# Authentication & Role-Based Access Control (RBAC) Specification

## 1. Overview

The POS system enforces a zero-trust, defense-in-depth security model. Authentication handles identity verification, while granular permissions and roles govern access control across both the API and client interfaces. Client-side checks provide a smooth user experience, but **every sensitive query or state-altering mutation is enforced by backend middleware**.

---

## 2. Authentication Architecture

### 2.1 Credential Verification & Hashing

- **Password Authentication**: Standard username/email and password credentials hashed using `bcrypt` (10 salt rounds).
- **Touch-Friendly PIN Authentication**: Fast 4-digit cashier/operator PIN hashed using `bcrypt` (10 salt rounds), allowing quick lock/unlock cycles on touchscreen POS terminals.

### 2.2 Token Lifecycle & Session Model

- **Dual-Token Pattern**:
  - **Access Token**: Short-lived JWT (24 hours in dev, configurable) containing user ID, username, business ID, store ID, assigned roles, and granular permission codes.
  - **Refresh Token**: Long-lived token (7 days) stored securely and hashed via SHA-256 in the PostgreSQL `UserSession` table.
- **Session Tracking (`UserSession` table)**:
  - Tracks `userId`, `refreshTokenHash`, `ipAddress`, `userAgent`, `isValid`, and `expiresAt`.
  - Enables instant remote session revocation upon logout, password change, or administrative action.
- **Token Rotation & Invalidation**:
  - Valid refresh tokens generate fresh access tokens.
  - Calling `/api/auth/logout` invalidates the specific session in the database.
  - Password resets immediately invalidate all active sessions for that user across all devices.

### 2.3 Account Protection & Lockout

- **Brute-Force Prevention**:
  - Tracked via `failedLoginAttempts` and `lockedUntil` on the `User` model.
  - Accounts are automatically locked for 15 minutes after 5 consecutive failed login attempts.
  - Successful authentication resets `failedLoginAttempts` to 0 and updates `lastLoginAt`.
- **Status Validation**:
  - Inactive accounts (`isActive = false`) or deleted accounts are immediately rejected during both login and token refresh.

### 2.4 Password Reset Architecture

- **Token Generation**:
  - Secure 32-byte cryptographic hex token generated upon password reset request.
  - Stored hashed via SHA-256 in the `PasswordResetToken` table with a 1-hour expiration.
  - Single-use policy (`isUsed = true` upon redemption).
  - Completing reset updates the user's password hash and invalidates all existing user sessions.

---

## 3. Role-Based Access Control (RBAC) & Granular Permissions

### 3.1 Initial Roles

1. **`ADMIN`**: Full administrative authority over business settings, stores, user accounts, and security logs.
2. **`MANAGER`**: Store-level management authority over product catalog, inventory adjustments, staff shifts, cash management, and reporting.
3. **`CASHIER`**: Frontline register operations, sales creation, basic product view, and register opening/closing.

### 3.2 Granular Permissions Matrix

| Permission Code    | Description                                  | CASHIER | MANAGER |  ADMIN  |
| ------------------ | -------------------------------------------- | :-----: | :-----: | :-----: |
| `products.view`    | View catalog products and prices             | &check; | &check; | &check; |
| `products.create`  | Create new products and variants             | &cross; | &check; | &check; |
| `products.update`  | Update existing products and variants        | &cross; | &check; | &check; |
| `products.delete`  | Delete or archive catalog items              | &cross; | &cross; | &check; |
| `inventory.view`   | View stock levels and locations              | &cross; | &check; | &check; |
| `inventory.adjust` | Perform stock counts and movements           | &cross; | &check; | &check; |
| `sales.create`     | Ring up sales and print receipts             | &check; | &check; | &check; |
| `sales.refund`     | Issue refunds for completed orders           | &cross; | &check; | &check; |
| `sales.void`       | Void items or cancel active sales            | &cross; | &check; | &check; |
| `reports.view`     | View sales summaries and financial reports   | &cross; | &check; | &check; |
| `users.manage`     | Create and manage user accounts and roles    | &cross; | &cross; | &check; |
| `settings.manage`  | Manage business, tax, and store settings     | &cross; | &cross; | &check; |
| `register.open`    | Open cash register shifts                    | &check; | &check; | &check; |
| `register.close`   | Close cash register shifts and submit counts | &check; | &check; | &check; |
| `cash.manage`      | Log pay-ins, pay-outs, and float adjustments | &cross; | &check; | &check; |

---

## 4. Middleware & Route Protection

### 4.1 Backend Middleware (`apps/api/src/middleware/auth.ts`)

- **`requireAuth`**: Extracts and verifies JWT bearer token from the `Authorization: Bearer <token>` header, attaching decoded user payload to `req.user`.
- **`requirePermission(...requiredPermissions: PermissionCode[])`**: Verifies user possesses all required permissions (admins bypass automatically).
- **`requireRole(...allowedRoles: RoleCode[])`**: Verifies user holds at least one of the specified roles.

### 4.2 Frontend Route Guard (`apps/web/src/components/AuthGuard.tsx`)

- Validates active user state via React context (`useAuth`).
- Automatically redirects unauthenticated users to `/login`.
- Displays structured "Access Denied" screens if required permissions or roles are unmet.
- Re-validates tokens on app mount and automatically triggers refresh when access tokens expire.

---

## 5. Security Audit Logging

All security-relevant actions are recorded in the PostgreSQL `AuditLog` table:

- `LOGIN_SUCCESS` / `LOGIN_FAILED` / `ACCOUNT_LOCKED`
- `LOGOUT`
- `PASSWORD_RESET_REQUESTED` / `PASSWORD_RESET_COMPLETED`

Each entry captures `businessId`, `userId`, `action`, `resource`, `ipAddress`, `userAgent`, and `metadata` (JSON).

---

## 6. Seed Credentials (Development Environment)

| Username  | Default Password | Quick PIN | Role      | Assigned Permissions                                               |
| --------- | ---------------- | --------- | --------- | ------------------------------------------------------------------ |
| `admin`   | `admin123`       | `1111`    | `ADMIN`   | All 15 permissions                                                 |
| `manager` | `manager123`     | `2222`    | `MANAGER` | Catalog, inventory, sales, register, reports                       |
| `cashier` | `cashier123`     | `1234`    | `CASHIER` | `sales.create`, `products.view`, `register.open`, `register.close` |
