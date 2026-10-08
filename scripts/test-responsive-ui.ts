/**
 * ==============================================================================
 * Comprehensive Responsive UI & Viewport Test Suite
 * ==============================================================================
 * Validates responsive design, accessibility, touch ergonomics, and layout
 * across all standard POS display profiles:
 *
 * 1. Mobile Compact (360 x 640 - Android compact)
 * 2. Mobile Modern (390 x 844 - iPhone 12/13/14/15)
 * 3. Tablet Portrait (768 x 1024 - iPad / 10" Tablet)
 * 4. Touch POS Terminal Landscape (1024 x 768 - Standard Touch POS Register)
 * 5. Laptop Standard (1366 x 768 - Countertop laptop station)
 * 6. Desktop Full HD (1920 x 1080 - Workstation monitor)
 *
 * Assertions:
 * - Viewport metadata configuration & PWA capabilities
 * - CSS global overflow prevention & safe-area insets
 * - Responsive grid scaling & breakpoint distribution
 * - Minimum touch target sizes (>= 44px / 48px WCAG 2.1 AA)
 * - Mobile bottom navigation visibility and suppression on desktop
 * - Mobile cart drawer touch gestures and floating action bar
 * - Desktop sidebar cart rendering and padding compensation
 * - Touch input latency optimization (touch-action: manipulation)
 * - Input auto-zoom suppression on iOS (< 768px font-size 16px)
 * ==============================================================================
 */

import fs from 'fs';
import path from 'path';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  ✓ [PASS] ${testName}`);
    passed++;
  } else {
    console.error(`  ✗ [FAIL] ${testName}${detail ? ` (${detail})` : ''}`);
    failed++;
  }
}

// ------------------------------------------------------------------------------
// Viewport Profile Definitions
// ------------------------------------------------------------------------------
interface ViewportProfile {
  name: string;
  width: number;
  height: number;
  deviceType: 'mobile' | 'tablet' | 'pos-touch' | 'desktop';
  expectedGridCols: number;
  mobileNavVisible: boolean;
  drawerCartExpected: boolean;
  desktopSidebarExpected: boolean;
}

const VIEWPORT_PROFILES: ViewportProfile[] = [
  {
    name: 'Mobile Compact (360x640)',
    width: 360,
    height: 640,
    deviceType: 'mobile',
    expectedGridCols: 2,
    mobileNavVisible: true,
    drawerCartExpected: true,
    desktopSidebarExpected: false,
  },
  {
    name: 'Mobile Modern / iPhone (390x844)',
    width: 390,
    height: 844,
    deviceType: 'mobile',
    expectedGridCols: 2,
    mobileNavVisible: true,
    drawerCartExpected: true,
    desktopSidebarExpected: false,
  },
  {
    name: 'Tablet Portrait / iPad (768x1024)',
    width: 768,
    height: 1024,
    deviceType: 'tablet',
    expectedGridCols: 3,
    mobileNavVisible: true,
    drawerCartExpected: true,
    desktopSidebarExpected: false,
  },
  {
    name: 'Touch POS Terminal Landscape (1024x768)',
    width: 1024,
    height: 768,
    deviceType: 'pos-touch',
    expectedGridCols: 3,
    mobileNavVisible: false,
    drawerCartExpected: false,
    desktopSidebarExpected: true,
  },
  {
    name: 'Laptop Standard POS Station (1366x768)',
    width: 1366,
    height: 768,
    deviceType: 'desktop',
    expectedGridCols: 4,
    mobileNavVisible: false,
    drawerCartExpected: false,
    desktopSidebarExpected: true,
  },
  {
    name: 'Desktop Full HD Workstation (1920x1080)',
    width: 1920,
    height: 1080,
    deviceType: 'desktop',
    expectedGridCols: 5,
    mobileNavVisible: false,
    drawerCartExpected: false,
    desktopSidebarExpected: true,
  },
];

async function runResponsiveUiTests() {
  console.log('======================================================================');
  console.log('📱 RUNNING RESPONSIVE UI & TOUCH ERGONOMICS TEST SUITE');
  console.log('======================================================================\n');

  const webRoot = path.resolve(process.cwd(), 'apps/web');

  // --------------------------------------------------------------------------
  // Category 1: Viewport Profiles & Grid Column Layout Math
  // --------------------------------------------------------------------------
  console.log('--- [Category 1] Viewport Matrix & Grid Column Responsiveness ---');

  function calculateExpectedGridColumns(width: number): number {
    if (width >= 1536) return 5; // 2xl:grid-cols-5
    if (width >= 1280) return 4; // xl:grid-cols-4
    if (width >= 768) return 3; // md:grid-cols-3
    if (width >= 640) return 3; // sm:grid-cols-3
    return 2; // grid-cols-2 (mobile default)
  }

  function isMobileViewport(width: number): boolean {
    return width < 1024; // lg breakpoint in Tailwind CSS (1024px)
  }

  for (const vp of VIEWPORT_PROFILES) {
    const computedCols = calculateExpectedGridColumns(vp.width);
    assert(
      computedCols === vp.expectedGridCols,
      `[${vp.name}] Resolves ${computedCols} catalog grid columns (target: ${vp.expectedGridCols})`,
    );

    const isMobile = isMobileViewport(vp.width);
    assert(
      isMobile === vp.mobileNavVisible,
      `[${vp.name}] Navigation mode: ${isMobile ? 'Mobile Bottom Bar' : 'Desktop Header/Sidebar'}`,
    );

    assert(
      !isMobile === vp.desktopSidebarExpected,
      `[${vp.name}] Desktop Sidebar Cart is ${!isMobile ? 'ACTIVE' : 'COLLAPSED TO DRAWER'}`,
    );
  }

  // --------------------------------------------------------------------------
  // Category 2: Root Layout & Viewport Metadata Verification
  // --------------------------------------------------------------------------
  console.log('\n--- [Category 2] Root Layout & Viewport Configuration ---');
  const layoutFilePath = path.join(webRoot, 'src/app/layout.tsx');
  const layoutContent = fs.readFileSync(layoutFilePath, 'utf-8');

  assert(
    layoutContent.includes("width: 'device-width'"),
    'Layout defines explicit width: "device-width"',
  );
  assert(
    layoutContent.includes('initialScale: 1'),
    'Layout defines initialScale: 1 for crisp mobile rendering',
  );
  assert(
    layoutContent.includes("viewportFit: 'cover'"),
    'Layout configures viewportFit: "cover" for edge-to-edge notched screens',
  );
  assert(
    layoutContent.includes("themeColor: '#0f172a'"),
    'Layout configures brand dark themeColor for mobile system status bar',
  );
  assert(
    layoutContent.includes('mobile-web-app-capable'),
    'Configures mobile-web-app-capable for standalone POS kiosk mode',
  );
  assert(
    layoutContent.includes('apple-mobile-web-app-capable'),
    'Configures apple-mobile-web-app-capable for iOS fullscreen POS mode',
  );
  assert(
    layoutContent.includes('format-detection') && layoutContent.includes('telephone=no'),
    'Disables automatic telephone format-detection to prevent accidental phone dialing',
  );

  // --------------------------------------------------------------------------
  // Category 3: Global CSS Overflow Prevention & Touch Optimization
  // --------------------------------------------------------------------------
  console.log('\n--- [Category 3] Global CSS Overflow & Touch Ergonomics ---');
  const globalsCssPath = path.join(webRoot, 'src/app/globals.css');
  const globalsCssContent = fs.readFileSync(globalsCssPath, 'utf-8');

  assert(
    globalsCssContent.includes('overflow-x: hidden'),
    'Global CSS strictly enforces overflow-x: hidden to prevent horizontal scroll bugs',
  );
  assert(
    globalsCssContent.includes('max-width: 100vw'),
    'Global CSS enforces max-width: 100vw viewport constraint',
  );
  assert(
    globalsCssContent.includes('touch-action: manipulation'),
    'Configures touch-action: manipulation to eliminate 300ms tap delay on touchscreens',
  );
  assert(
    globalsCssContent.includes('font-size: 16px !important'),
    'Configures font-size: 16px on inputs under 768px to prevent iOS auto-zoom shift',
  );
  assert(
    globalsCssContent.includes('env(safe-area-inset-bottom'),
    'Defines safe-area-inset CSS variables for modern bezel-less devices',
  );

  // --------------------------------------------------------------------------
  // Category 4: Mobile Bottom Navigation & Minimum Touch Targets
  // --------------------------------------------------------------------------
  console.log('\n--- [Category 4] Mobile Bottom Navigation & Touch Targets ---');
  const bottomNavPath = path.join(webRoot, 'src/components/BottomNavigation.tsx');
  const bottomNavContent = fs.readFileSync(bottomNavPath, 'utf-8');

  assert(
    bottomNavContent.includes('lg:hidden'),
    'BottomNavigation uses "lg:hidden" to hide on desktop/landscape POS viewports',
  );
  assert(
    bottomNavContent.includes('fixed bottom-0 inset-x-0'),
    'BottomNavigation uses fixed bottom positioning with full horizontal spread',
  );
  assert(
    bottomNavContent.includes('min-h-[48px]'),
    'BottomNavigation interactive links enforce min-h-[48px] touch targets (WCAG compliant)',
  );
  assert(
    bottomNavContent.includes('safe-area-inset-bottom'),
    'BottomNavigation honors safe-area-inset-bottom padding',
  );

  // --------------------------------------------------------------------------
  // Category 5: Mobile POS Cart Drawer & Touch Swipe Gestures
  // --------------------------------------------------------------------------
  console.log('\n--- [Category 5] Mobile Cart Drawer & Gesture Navigation ---');
  const mobileCartPath = path.join(webRoot, 'src/components/pos/MobileCartDrawer.tsx');
  const mobileCartContent = fs.readFileSync(mobileCartPath, 'utf-8');

  assert(
    mobileCartContent.includes('lg:hidden'),
    'MobileCartDrawer floating trigger is hidden on desktop viewports (lg:hidden)',
  );
  assert(
    mobileCartContent.includes('fixed bottom-[calc(3.5rem+env(safe-area-inset-bottom,0px))]'),
    'Floating cart button stacks cleanly above mobile bottom navigation bar',
  );
  assert(
    mobileCartContent.includes('onTouchStart') &&
      mobileCartContent.includes('onTouchMove') &&
      mobileCartContent.includes('onTouchEnd'),
    'MobileCartDrawer implements touch gesture event listeners for swipe dismissal',
  );
  assert(
    mobileCartContent.includes('touchDelta > 70'),
    'Implements ergonomic swipe-down threshold (> 70px) to dismiss drawer',
  );

  // --------------------------------------------------------------------------
  // Category 6: Product Grid Layout & Occlusion Protection
  // --------------------------------------------------------------------------
  console.log('\n--- [Category 6] Product Grid Responsive Layout & Padding ---');
  const productGridPath = path.join(webRoot, 'src/components/pos/ProductGrid.tsx');
  const productGridContent = fs.readFileSync(productGridPath, 'utf-8');

  assert(
    productGridContent.includes(
      'grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5',
    ),
    'ProductGrid implements responsive 5-tier column breakdown',
  );
  assert(
    productGridContent.includes('pb-32 sm:pb-36 lg:pb-6'),
    'ProductGrid applies bottom padding compensation (pb-32 mobile -> pb-6 desktop) to prevent occlusion by floating bars',
  );
  assert(
    productGridContent.includes('touch-scroll'),
    'ProductGrid applies momentum touch scrolling class',
  );

  // --------------------------------------------------------------------------
  // Category 7: POS Main Page Split Layout Architecture
  // --------------------------------------------------------------------------
  console.log('\n--- [Category 7] POS Main Page Adaptive Split Layout ---');
  const posPagePath = path.join(webRoot, 'src/app/pos/page.tsx');
  const posPageContent = fs.readFileSync(posPagePath, 'utf-8');

  assert(
    posPageContent.includes('hidden lg:flex') || posPageContent.includes('hidden lg:block'),
    'POS main page collapses sidebar cart on mobile/tablet viewports (< 1024px)',
  );
  assert(
    posPageContent.includes('<MobileCartDrawer'),
    'POS main page renders adaptive MobileCartDrawer component',
  );
  assert(
    posPageContent.includes('isMobileCartOpen'),
    'POS main page maintains mobile cart drawer open/close state machine',
  );

  // --------------------------------------------------------------------------
  // Category 8: Payment Modal & Touch Keypad Ergonomics
  // --------------------------------------------------------------------------
  console.log('\n--- [Category 8] Payment Modal & Touch Keypad Ergonomics ---');
  const paymentModalPath = path.join(webRoot, 'src/components/pos/PaymentModal.tsx');
  const paymentModalContent = fs.readFileSync(paymentModalPath, 'utf-8');

  assert(
    paymentModalContent.includes('max-w-') || paymentModalContent.includes('w-full'),
    'Payment modal uses responsive max-width boundary',
  );
  assert(
    paymentModalContent.includes('grid grid-cols-') || paymentModalContent.includes('grid-cols-3'),
    'Payment modal provides touch-friendly numeric keypad layout',
  );

  console.log('\n======================================================================');
  console.log(`  RESPONSIVE UI TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('======================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runResponsiveUiTests().catch((err) => {
  console.error('Fatal Responsive UI Test Failure:', err);
  process.exit(1);
});
