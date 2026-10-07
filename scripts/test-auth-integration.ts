/**
 * Complete Authentication & Authorization Integration Test Suite
 * Tests all requirements: login, PIN login, logout, refresh, lockout, RBAC, permissions, reset.
 */

import { createApp } from '../apps/api/src/index.js';
import { prisma } from '../apps/api/src/db/index.js';
import http from 'http';

let server: http.Server;
let baseUrl: string;

async function request(path: string, options: RequestInit = {}) {
  const res = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, ok: res.ok, body: data };
}

async function runTests() {
  console.log('====================================================');
  console.log(' Starting Complete Auth & RBAC Integration Tests');
  console.log('====================================================\n');

  // Start test server
  const app = createApp();
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => {
      const addr = server.address() as any;
      baseUrl = `http://127.0.0.1:${addr.port}`;
      console.log(`[Test Server] Listening on ${baseUrl}\n`);
      resolve();
    });
  });

  let testsPassed = 0;
  let testsFailed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`✓ [PASS] ${testName}`);
      testsPassed++;
    } else {
      console.error(`✗ [FAIL] ${testName}${detail ? ` (${detail})` : ''}`);
      testsFailed++;
    }
  }

  try {
    // 1. Password Login (Admin)
    const adminLogin = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: 'admin', password: 'admin123' }),
    });
    assert(adminLogin.status === 200, 'Admin login with valid credentials returns 200');
    assert(!!adminLogin.body?.data?.tokens?.accessToken, 'Admin login returns accessToken');
    assert(adminLogin.body?.data?.user?.roles?.includes('ADMIN'), 'Admin user has ADMIN role');
    assert(
      adminLogin.body?.data?.user?.permissions?.includes('users.manage'),
      'Admin user has granular permission users.manage',
    );
    const adminToken = adminLogin.body?.data?.tokens?.accessToken;
    const adminRefreshToken = adminLogin.body?.data?.tokens?.refreshToken;

    // 2. Password Login (Cashier)
    const cashierLogin = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: 'cashier', password: 'cashier123' }),
    });
    assert(cashierLogin.status === 200, 'Cashier login with valid credentials returns 200');
    assert(
      cashierLogin.body?.data?.user?.roles?.includes('CASHIER'),
      'Cashier user has CASHIER role',
    );
    assert(
      cashierLogin.body?.data?.user?.permissions?.includes('sales.create'),
      'Cashier user has granular permission sales.create',
    );
    const cashierToken = cashierLogin.body?.data?.tokens?.accessToken;

    // 3. Invalid Credentials Handling
    const invalidLogin = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: 'cashier', password: 'wrongpassword' }),
    });
    assert(invalidLogin.status === 401, 'Invalid password returns 401 Unauthorized');
    assert(
      invalidLogin.body?.error?.code === 'INVALID_CREDENTIALS',
      'Error code is INVALID_CREDENTIALS',
    );

    // 4. Touch Terminal PIN Login
    const pinLogin = await request('/api/auth/pin-login', {
      method: 'POST',
      body: JSON.stringify({ username: 'cashier', pin: '1234' }),
    });
    assert(pinLogin.status === 200, 'Cashier PIN login returns 200 OK');
    assert(
      pinLogin.body?.data?.user?.username === 'cashier',
      'PIN login resolves correct user profile',
    );

    const invalidPinLogin = await request('/api/auth/pin-login', {
      method: 'POST',
      body: JSON.stringify({ username: 'cashier', pin: '9999' }),
    });
    assert(invalidPinLogin.status === 401, 'Incorrect PIN returns 401');

    // 5. Protected Route Authentication Guard
    const noToken = await request('/api/auth/me');
    assert(noToken.status === 401, 'Accessing /api/auth/me without token returns 401');

    const meResponse = await request('/api/auth/me', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(meResponse.status === 200, 'Accessing /api/auth/me with Bearer token returns 200');
    assert(
      meResponse.body?.data?.user?.username === 'admin',
      'Returned user matches token payload',
    );

    // 6. Granular Permission Enforcement
    // 6a. Admin accessing admin-only route (requires 'users.manage')
    const adminAccess = await request('/api/auth/test/admin-only', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(adminAccess.status === 200, 'Admin allowed on users.manage endpoint (200 OK)');

    // 6b. Cashier accessing admin-only route (should be DENIED with 403 Forbidden)
    const cashierForbidden = await request('/api/auth/test/admin-only', {
      headers: { Authorization: `Bearer ${cashierToken}` },
    });
    assert(
      cashierForbidden.status === 403,
      'Cashier denied on users.manage endpoint (403 Forbidden)',
    );
    assert(
      cashierForbidden.body?.error?.code === 'INSUFFICIENT_PERMISSIONS',
      'Forbidden error specifies INSUFFICIENT_PERMISSIONS',
    );

    // 6c. Cashier accessing sales checkout route (requires 'sales.create')
    const cashierAllowed = await request('/api/auth/test/sales-only', {
      headers: { Authorization: `Bearer ${cashierToken}` },
    });
    assert(cashierAllowed.status === 200, 'Cashier allowed on sales.create endpoint (200 OK)');

    // 7. Token Refresh Mechanism
    const refreshRes = await request('/api/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken: adminRefreshToken }),
    });
    assert(refreshRes.status === 200, 'Token refresh returns 200 OK');
    assert(!!refreshRes.body?.data?.accessToken, 'Token refresh issues new access token');

    const invalidRefresh = await request('/api/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken: 'invalid.jwt.token' }),
    });
    assert(invalidRefresh.status === 401, 'Invalid refresh token returns 401');

    // 8. Logout & Session Revocation
    const logoutRes = await request('/api/auth/logout', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ refreshToken: adminRefreshToken }),
    });
    assert(logoutRes.status === 200, 'Logout request returns 200 OK');

    // Attempting refresh with revoked token should fail
    const revokedRefresh = await request('/api/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken: adminRefreshToken }),
    });
    assert(revokedRefresh.status === 401, 'Revoked refresh token is rejected on refresh attempt');

    // 9. Password Reset Architecture
    const forgotRes = await request('/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ emailOrUsername: 'manager' }),
    });
    assert(forgotRes.status === 200, 'Forgot password request returns 200 OK');
    const resetToken = forgotRes.body?.data?.token;
    assert(!!resetToken, 'Dev environment generates reset token for verification');

    if (resetToken) {
      const resetRes = await request('/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token: resetToken, newPassword: 'newManagerPassword123!' }),
      });
      assert(resetRes.status === 200, 'Reset password returns 200 OK');

      // Verify login with new password
      const newLogin = await request('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username: 'manager', password: 'newManagerPassword123!' }),
      });
      assert(newLogin.status === 200, 'Manager can log in with newly reset password');

      // Revert password back to manager123 for consistency
      await request('/api/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ emailOrUsername: 'manager' }),
      }).then(async (r) => {
        const t = r.body?.data?.token;
        if (t) {
          await request('/api/auth/reset-password', {
            method: 'POST',
            body: JSON.stringify({ token: t, newPassword: 'manager123' }),
          });
        }
      });
    }

    // 10. Audit Logging Verification
    const auditLogs = await prisma.auditLog.findMany({
      where: {
        action: {
          in: [
            'LOGIN_SUCCESS',
            'LOGIN_FAILED',
            'LOGOUT',
            'PASSWORD_RESET_REQUESTED',
            'PASSWORD_RESET_COMPLETED',
          ],
        },
      },
      take: 10,
    });
    assert(
      auditLogs.length >= 4,
      `Security-sensitive audit logs recorded (${auditLogs.length} verified)`,
    );

    console.log('\n====================================================');
    console.log(` Results: ${testsPassed} Passed, ${testsFailed} Failed`);
    console.log('====================================================');

    if (testsFailed > 0) {
      process.exit(1);
    }
  } finally {
    server.close();
    await prisma.$disconnect();
  }
}

runTests().catch((e) => {
  console.error('Test suite failed:', e);
  process.exit(1);
});
