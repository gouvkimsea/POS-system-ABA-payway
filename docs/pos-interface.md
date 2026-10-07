# Point of Sale (POS) Interface & Checkout Specification

## 1. Overview

The Point of Sale (POS) terminal interface is engineered for **ultra-fast retail checkout**, touch ergonomics, keyboard-driven operation, and seamless multi-device responsiveness. It directly queries and mutates the PostgreSQL database through typed API contracts with zero hardcoded placeholder data.

Accessible at: `http://localhost:3000/pos`

---

## 2. Multi-Device Responsive Architecture

| Device Class                         | Viewport Range        | Layout Adaptation                                                                                                                |
| ------------------------------------ | --------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| **Desktop & Large Displays**         | &ge; 1440px           | Split screen: 65% Catalog & Search / 35% Fixed Cart & Summary                                                                    |
| **Laptops & Standard Terminals**     | 1280px &ndash; 1439px | Split screen: Balanced 60/40 catalog and checkout column                                                                         |
| **Touch POS Terminals & Tablets**    | 1024px &ndash; 1279px | Large touch targets (min 44px&ndash;56px), compact list/grid toggle                                                              |
| **Mobile Phones & Vertical Tablets** | &le; 1023px           | Full-screen product catalog with a **sticky bottom summary bar** that expands into a **touch-friendly slide-up checkout drawer** |

---

## 3. Screen Structure

### 3.1 Top Terminal Bar (`PosHeader`)

- **Brand & Store Name**: Displays business name (`Angkor Fresh Mart`) and active branch (`Monivong Central Branch`).
- **Register Code Badge**: Displays active terminal (`REG-01`).
- **Live Terminal Clock**: Displays second-accurate local time.
- **Network Status Pill**: Indicates `Online` or `Offline Cache` mode with automatic recovery from `localStorage`.
- **Held Orders Counter**: Visual counter badge (`Held (X)`) opening the held sales recall modal.
- **Shortcuts Modal Trigger**: Visual cheat sheet helper (`? / Shortcuts`).
- **Fullscreen Mode Toggle**: Native browser fullscreen toggle.
- **Cashier Profile & Exit**: Displays active cashier identity (`Dara Sok`) and exit button.

### 3.2 Left / Main Catalog Area

- **Product Search (F1)**: Debounced instant search filtering across product name, SKU, and barcode.
- **Barcode Scanner Input (F2)**: Hardware USB/Bluetooth scanner input listening for `Enter` key events. Automatically plays a distinct 1700Hz scanner beep (`posSounds.playBeep()`) and increments quantity.
- **Category Navigation (`CategoryNav`)**: Horizontal scrollable category pill bar with color indicators and item count badges.
- **Product Display Grid (`ProductGrid`)**:
  - Touch-friendly cards with high-contrast typography.
  - Real product photography with graceful SVG fallback.
  - Real-time stock status badge:
    - `In Stock (X)` (Emerald)
    - `Low Stock (X)` (Amber &le; 5 units)
    - `Out of Stock` (Rose, disabled)
  - Dual Currency Display: Primary USD (`$1.00`) and secondary Cambodian Riel (`4,100 ៛`).
  - View Switcher: Supports switching between **Touch Grid View** and **Compact List View**.

### 3.3 Right / Checkout Cart Area (`CartArea`)

- **Customer Selection (F4)**:
  - Defaults to `Walk-in Customer`.
  - Opens `CustomerModal` for searching existing customers by phone/name or creating a customer on-the-fly.
  - Displays customer loyalty points (`120 pts`).
- **Itemized Cart Rows**:
  - Product title, unit, SKU, and line unit price.
  - Tactile touch quantity steppers (`-`, quantity, `+`).
  - Per-item discount trigger (percentage or fixed dollar amount).
  - Selected item indicator with remove button (`X`) or `DELETE` shortcut key.
- **Cart Actions**:
  - **Hold Sale**: Moves current cart to PostgreSQL `status: PENDING` held orders and clears register for the next customer.
  - **Clear Cart**: Clears cart with confirmation.
- **Financial Breakdown & Totals**:
  - Subtotal in USD.
  - Order discounts in USD.
  - Tax (10% VAT inclusive breakdown).
  - **Grand Total Due**: Large 24px+ bold font displaying `$Total USD` and `Total KHR`.
- **Big Pay Button (F8)**: Vibrant emerald touch button (`PAY NOW (F8)`) opening the checkout payment dialog.

---

## 4. Keyboard Shortcuts

| Shortcut    | Description       | Action                                            |
| ----------- | ----------------- | ------------------------------------------------- |
| **`F1`**    | Product Search    | Focuses the catalog text search input             |
| **`F2`**    | Barcode Input     | Focuses the barcode scanner input                 |
| **`F4`**    | Customer Selector | Opens customer search & creation modal            |
| **`F8`**    | Checkout / Pay    | Opens the payment and tender dialog               |
| **`ESC`**   | Close Dialog      | Closes any active modal or drawer                 |
| **`DEL`**   | Remove Item       | Deletes the currently selected cart row           |
| **`Enter`** | Submit            | Submits barcode scanner entry / completes payment |

---

## 5. Payment & Receipt Workflow

### 5.1 Payment Processing (`PaymentModal`)

1. **Cash (USD & KHR)**:
   - Quick tender preset buttons: Exact Amount, `$10`, `$20`, `$50`, `$100`.
   - Real-time Change calculation in USD and KHR.
   - Prevents completion if tender is insufficient.
2. **ABA KHQR Pay**:
   - Universal dynamic KHQR payment display with ABA Payway branding, merchant name, and instant confirmation.
3. **Credit / Debit Card**:
   - Card terminal authorization reference capture.

### 5.2 Thermal Receipt Modal (`ReceiptModal`)

- Standard 80mm commercial thermal receipt design:
  - Header with business name, store branch address, and telephone.
  - Receipt number (`RCP-YYYYMMDD-XXXX`) and Order reference (`ORD-YYYYMMDD-XXXX`).
  - Cashier name, customer name, date and timestamp.
  - Itemized lines with quantity, unit price, and line totals.
  - Subtotal, discounts, tax, grand total in USD & KHR.
  - Tendered cash and calculated change in USD & KHR.
  - Native print button (`window.print()`).
  - "Next Customer" button to reset the terminal in 1 click.

---

## 6. Real Database & Transaction Guarantees

Every completed sale executes an atomic PostgreSQL transaction via Prisma:

1. Creates `Order` with `status: COMPLETED`.
2. Creates `OrderItem` rows for each line.
3. Decrements inventory quantity in the store's `Inventory` table.
4. Generates an immutable `StockMovement` audit record (`type: SALE`, `quantityChange: -qty`).
5. Creates a `Payment` record linked to the chosen payment method.
6. Creates a `Receipt` record with unique sequential number.
7. Increments customer loyalty points (1 point per whole $1 spent).
8. Emits a structured `AuditLog` entry (`ORDER_COMPLETED`).

---

## 7. Verification & Automated Test Suite

Run the full POS integration test suite:

```bash
pnpm test:pos
```

**Results: 43 Passed, 0 Failed**:

- Cashier authentication & token verification.
- Terminal initialization with categories, products, customers, payment methods.
- Product search by keyword and barcode lookup.
- Customer search and quick customer creation.
- Hold sale & recall held sale workflow.
- Full checkout transaction, payment creation, receipt creation.
- PostgreSQL database state verification.
- Inventory stock decrement & stock movement auditing.
