import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../db/index.js';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import {
  PERMISSIONS,
  BusinessSettings,
  StoreSettingsUnified,
  PosOperationalSettings,
  LocalizationSettings,
  PaymentMethodConfig,
  UnifiedSettingsPayload,
  UserDetailExtended,
  RoleDetailExtended,
} from '@pos/types';
import {
  updateBusinessSettingsSchema,
  updateStoreSettingsExtendedSchema,
  updatePosSettingsSchema,
  updateLocalizationSettingsSchema,
  paymentMethodConfigSchema,
  createSystemUserSchema,
  updateSystemUserSchema,
} from '@pos/validation';
import { PaymentMethodType, Prisma } from '@prisma/client';

export const settingsRouter: Router = Router();

// Default Fallbacks
const DEFAULT_POS_SETTINGS: PosOperationalSettings = {
  receiptSize: '80mm',
  barcodeBehavior: {
    autoAddToCart: true,
    beepOnScan: true,
    focusInputByDefault: true,
    minLength: 3,
  },
  sound: {
    enabled: true,
    volume: 0.7,
    playBeep: true,
    playCashDrawer: true,
    playWarning: true,
    playSuccess: true,
  },
  keyboardShortcuts: {
    enabled: true,
    customBindings: {
      search: 'F1',
      barcode: 'F2',
      customer: 'F4',
      payment: 'F8',
      clear: 'Delete',
      shortcuts: '?',
    },
  },
  customerDisplay: {
    enabled: false,
    port: 'COM3',
    baudRate: 9600,
    lineLength: 20,
    welcomeMessage: 'Welcome to Angkor Mart!',
    idleMessage: 'Thank You for Shopping!',
  },
  printer: {
    enabled: true,
    type: 'network',
    ip: '192.168.1.200',
    port: 9100,
    charactersPerLine: 48,
    autoCut: true,
  },
  cashDrawer: {
    enabled: true,
    driver: 'printer_kick',
    pulsePin: 0,
    openOnCashSale: true,
  },
};

const DEFAULT_LOCALIZATION_SETTINGS: LocalizationSettings = {
  language: 'en',
  defaultCurrency: 'USD',
  currencyFormatting: {
    symbol: '$',
    position: 'prefix',
    decimalPlaces: 2,
    thousandsSeparator: ',',
    decimalSeparator: '.',
  },
  dateTimeFormatting: {
    dateFormat: 'DD/MM/YYYY',
    timeFormat: 'hh:mm A',
    timezone: 'Asia/Phnom_Penh',
    use24Hour: false,
  },
};

/**
 * GET /api/settings
 * Retrieve consolidated settings payload (Business, active Store, POS, Localization, Payment Methods)
 */
settingsRouter.get('/', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    const businessId = user.businessId;
    const requestedStoreId = (req.query.storeId as string) || user.storeId;

    // 1. Fetch Business
    const business = await prisma.business.findUnique({
      where: { id: businessId },
    });

    if (!business) {
      res.status(404).json({
        success: false,
        error: { code: 'BUSINESS_NOT_FOUND', message: 'Business entity not found' },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // 2. Fetch Stores List
    const stores = await prisma.store.findMany({
      where: { businessId, deletedAt: null },
      select: {
        id: true,
        name: true,
        code: true,
        address: true,
        phone: true,
        receiptHeader: true,
        receiptFooter: true,
        settings: true,
      },
      orderBy: { name: 'asc' },
    });

    const activeStore =
      (requestedStoreId ? stores.find((s) => s.id === requestedStoreId) : stores[0]) || stores[0];

    // 3. Extract JSON Settings
    const bizSettingsJson = (business.settings as Record<string, any>) || {};
    const storeSettingsJson = (activeStore?.settings as Record<string, any>) || {};

    const businessSettings: BusinessSettings = {
      id: business.id,
      name: business.name,
      code: business.code,
      logoUrl: business.logoUrl,
      address: business.address,
      phone: business.phone,
      email: business.email,
      taxNumber: business.taxNumber,
      defaultCurrency: business.defaultCurrency,
      baseExchangeRate: Number(business.baseExchangeRate),
      timezone: business.timezone,
    };

    const storeSettingsUnified: StoreSettingsUnified = {
      id: activeStore?.id || '',
      storeId: activeStore?.id || '',
      storeName: activeStore?.name || 'Default Store',
      receipt: {
        showLogo: storeSettingsJson.receipt?.showLogo ?? true,
        showTaxBreakdown: storeSettingsJson.receipt?.showTaxBreakdown ?? true,
        showCashierName: storeSettingsJson.receipt?.showCashierName ?? true,
        showCustomerInfo: storeSettingsJson.receipt?.showCustomerInfo ?? true,
        paperSize: storeSettingsJson.receipt?.paperSize || '80mm',
        customHeader: activeStore?.receiptHeader || storeSettingsJson.receipt?.customHeader || null,
        customFooter: activeStore?.receiptFooter || storeSettingsJson.receipt?.customFooter || null,
      },
      tax: {
        defaultTaxRate: storeSettingsJson.tax?.defaultTaxRate ?? 0.1,
        isTaxInclusive: storeSettingsJson.tax?.isTaxInclusive ?? false,
        enableTax: storeSettingsJson.tax?.enableTax ?? true,
        taxNumber: storeSettingsJson.tax?.taxNumber || business.taxNumber || null,
      },
      inventory: {
        allowNegativeStock: storeSettingsJson.inventory?.allowNegativeStock ?? false,
        defaultLowStockAlert: storeSettingsJson.inventory?.defaultLowStockAlert ?? 5,
        trackBatches: storeSettingsJson.inventory?.trackBatches ?? false,
        enableStockTransfers: storeSettingsJson.inventory?.enableStockTransfers ?? true,
      },
    };

    const posSettings: PosOperationalSettings = {
      receiptSize: bizSettingsJson.pos?.receiptSize || DEFAULT_POS_SETTINGS.receiptSize,
      barcodeBehavior: {
        ...DEFAULT_POS_SETTINGS.barcodeBehavior,
        ...(bizSettingsJson.pos?.barcodeBehavior || {}),
      },
      sound: {
        ...DEFAULT_POS_SETTINGS.sound,
        ...(bizSettingsJson.pos?.sound || {}),
      },
      keyboardShortcuts: {
        ...DEFAULT_POS_SETTINGS.keyboardShortcuts,
        ...(bizSettingsJson.pos?.keyboardShortcuts || {}),
      },
      customerDisplay: {
        ...DEFAULT_POS_SETTINGS.customerDisplay,
        ...(bizSettingsJson.pos?.customerDisplay || {}),
      },
      printer: {
        ...DEFAULT_POS_SETTINGS.printer,
        ...(bizSettingsJson.pos?.printer || {}),
      },
      cashDrawer: {
        ...DEFAULT_POS_SETTINGS.cashDrawer,
        ...(bizSettingsJson.pos?.cashDrawer || {}),
      },
    };

    const localizationSettings: LocalizationSettings = {
      language: bizSettingsJson.localization?.language || DEFAULT_LOCALIZATION_SETTINGS.language,
      defaultCurrency:
        (bizSettingsJson.localization?.defaultCurrency as any) ||
        business.defaultCurrency ||
        DEFAULT_LOCALIZATION_SETTINGS.defaultCurrency,
      currencyFormatting: {
        ...DEFAULT_LOCALIZATION_SETTINGS.currencyFormatting,
        symbol: business.defaultCurrency === 'KHR' ? '៛' : '$',
        ...(bizSettingsJson.localization?.currencyFormatting || {}),
      },
      dateTimeFormatting: {
        ...DEFAULT_LOCALIZATION_SETTINGS.dateTimeFormatting,
        timezone: business.timezone || DEFAULT_LOCALIZATION_SETTINGS.dateTimeFormatting.timezone,
        ...(bizSettingsJson.localization?.dateTimeFormatting || {}),
      },
    };

    // 4. Fetch Payment Methods
    const paymentMethods = await prisma.paymentMethod.findMany({
      where: { businessId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });

    const paymentMethodsConfig: PaymentMethodConfig[] = paymentMethods.map((pm) => ({
      id: pm.id,
      businessId: pm.businessId,
      name: pm.name,
      code: pm.code,
      type: pm.type,
      isActive: pm.isActive,
      isDefault: pm.isDefault,
      config: (pm.config as Record<string, any>) || null,
    }));

    const payload: UnifiedSettingsPayload = {
      business: businessSettings,
      store: storeSettingsUnified,
      pos: posSettings,
      localization: localizationSettings,
      paymentMethods: paymentMethodsConfig,
      storesList: stores.map((s) => ({ id: s.id, name: s.name, code: s.code })),
    };

    res.status(200).json({
      success: true,
      data: payload,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/settings/business
 * Update business details (name, logoUrl, address, phone, email, currency, timezone)
 */
settingsRouter.put(
  '/business',
  requireAuth,
  requirePermission(PERMISSIONS.SETTINGS_MANAGE),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const parsed = updateBusinessSettingsSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.issues[0]?.message || 'Invalid business payload',
          },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const updated = await prisma.business.update({
        where: { id: user.businessId },
        data: {
          name: parsed.data.name,
          logoUrl: parsed.data.logoUrl,
          address: parsed.data.address,
          phone: parsed.data.phone,
          email: parsed.data.email || null,
          taxNumber: parsed.data.taxNumber,
          defaultCurrency: parsed.data.defaultCurrency,
          baseExchangeRate: new Prisma.Decimal(parsed.data.baseExchangeRate),
          timezone: parsed.data.timezone,
        },
      });

      res.status(200).json({
        success: true,
        data: {
          id: updated.id,
          name: updated.name,
          code: updated.code,
          logoUrl: updated.logoUrl,
          address: updated.address,
          phone: updated.phone,
          email: updated.email,
          taxNumber: updated.taxNumber,
          defaultCurrency: updated.defaultCurrency,
          baseExchangeRate: Number(updated.baseExchangeRate),
          timezone: updated.timezone,
        },
        message: 'Business settings updated successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * GET /api/settings/store/:storeId
 * Get specific store settings
 */
settingsRouter.get(
  '/store/:storeId',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const storeId = req.params.storeId as string;

      const store = await prisma.store.findFirst({
        where: { id: storeId, businessId: user.businessId, deletedAt: null },
      });

      if (!store) {
        res.status(404).json({
          success: false,
          error: { code: 'STORE_NOT_FOUND', message: 'Store not found' },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const storeJson = (store.settings as Record<string, any>) || {};

      const unified: StoreSettingsUnified = {
        id: store.id,
        storeId: store.id,
        storeName: store.name,
        receipt: {
          showLogo: storeJson.receipt?.showLogo ?? true,
          showTaxBreakdown: storeJson.receipt?.showTaxBreakdown ?? true,
          showCashierName: storeJson.receipt?.showCashierName ?? true,
          showCustomerInfo: storeJson.receipt?.showCustomerInfo ?? true,
          paperSize: storeJson.receipt?.paperSize || '80mm',
          customHeader: store.receiptHeader || storeJson.receipt?.customHeader || null,
          customFooter: store.receiptFooter || storeJson.receipt?.customFooter || null,
        },
        tax: {
          defaultTaxRate: storeJson.tax?.defaultTaxRate ?? 0.1,
          isTaxInclusive: storeJson.tax?.isTaxInclusive ?? false,
          enableTax: storeJson.tax?.enableTax ?? true,
          taxNumber: storeJson.tax?.taxNumber || null,
        },
        inventory: {
          allowNegativeStock: storeJson.inventory?.allowNegativeStock ?? false,
          defaultLowStockAlert: storeJson.inventory?.defaultLowStockAlert ?? 5,
          trackBatches: storeJson.inventory?.trackBatches ?? false,
          enableStockTransfers: storeJson.inventory?.enableStockTransfers ?? true,
        },
      };

      res.status(200).json({
        success: true,
        data: unified,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * PUT /api/settings/store/:storeId
 * Update specific store settings (receipt, tax, inventory)
 */
settingsRouter.put(
  '/store/:storeId',
  requireAuth,
  requirePermission(PERMISSIONS.SETTINGS_MANAGE),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const storeId = req.params.storeId as string;

      const store = await prisma.store.findFirst({
        where: { id: storeId, businessId: user.businessId, deletedAt: null },
      });

      if (!store) {
        res.status(404).json({
          success: false,
          error: { code: 'STORE_NOT_FOUND', message: 'Store not found' },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const parsed = updateStoreSettingsExtendedSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.issues[0]?.message || 'Invalid store settings payload',
          },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const existingSettings = (store.settings as Record<string, any>) || {};
      const newSettings = {
        ...existingSettings,
        ...(parsed.data.receipt ? { receipt: parsed.data.receipt } : {}),
        ...(parsed.data.tax ? { tax: parsed.data.tax } : {}),
        ...(parsed.data.inventory ? { inventory: parsed.data.inventory } : {}),
      };

      const updated = await prisma.store.update({
        where: { id: storeId },
        data: {
          ...(parsed.data.storeName ? { name: parsed.data.storeName } : {}),
          ...(parsed.data.address !== undefined ? { address: parsed.data.address } : {}),
          ...(parsed.data.phone !== undefined ? { phone: parsed.data.phone } : {}),
          ...(parsed.data.receipt?.customHeader !== undefined
            ? { receiptHeader: parsed.data.receipt.customHeader }
            : {}),
          ...(parsed.data.receipt?.customFooter !== undefined
            ? { receiptFooter: parsed.data.receipt.customFooter }
            : {}),
          settings: newSettings,
        },
      });

      const updatedJson = (updated.settings as Record<string, any>) || {};

      const unified: StoreSettingsUnified = {
        id: updated.id,
        storeId: updated.id,
        storeName: updated.name,
        receipt: {
          showLogo: updatedJson.receipt?.showLogo ?? true,
          showTaxBreakdown: updatedJson.receipt?.showTaxBreakdown ?? true,
          showCashierName: updatedJson.receipt?.showCashierName ?? true,
          showCustomerInfo: updatedJson.receipt?.showCustomerInfo ?? true,
          paperSize: updatedJson.receipt?.paperSize || '80mm',
          customHeader: updated.receiptHeader || updatedJson.receipt?.customHeader || null,
          customFooter: updated.receiptFooter || updatedJson.receipt?.customFooter || null,
        },
        tax: {
          defaultTaxRate: updatedJson.tax?.defaultTaxRate ?? 0.1,
          isTaxInclusive: updatedJson.tax?.isTaxInclusive ?? false,
          enableTax: updatedJson.tax?.enableTax ?? true,
          taxNumber: updatedJson.tax?.taxNumber || null,
        },
        inventory: {
          allowNegativeStock: updatedJson.inventory?.allowNegativeStock ?? false,
          defaultLowStockAlert: updatedJson.inventory?.defaultLowStockAlert ?? 5,
          trackBatches: updatedJson.inventory?.trackBatches ?? false,
          enableStockTransfers: updatedJson.inventory?.enableStockTransfers ?? true,
        },
      };

      res.status(200).json({
        success: true,
        data: unified,
        message: 'Store settings updated successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * GET /api/settings/pos
 * Get POS operational settings
 */
settingsRouter.get('/pos', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    const business = await prisma.business.findUnique({
      where: { id: user.businessId },
    });

    const bizSettingsJson = (business?.settings as Record<string, any>) || {};
    const posSettings: PosOperationalSettings = {
      receiptSize: bizSettingsJson.pos?.receiptSize || DEFAULT_POS_SETTINGS.receiptSize,
      barcodeBehavior: {
        ...DEFAULT_POS_SETTINGS.barcodeBehavior,
        ...(bizSettingsJson.pos?.barcodeBehavior || {}),
      },
      sound: {
        ...DEFAULT_POS_SETTINGS.sound,
        ...(bizSettingsJson.pos?.sound || {}),
      },
      keyboardShortcuts: {
        ...DEFAULT_POS_SETTINGS.keyboardShortcuts,
        ...(bizSettingsJson.pos?.keyboardShortcuts || {}),
      },
      customerDisplay: {
        ...DEFAULT_POS_SETTINGS.customerDisplay,
        ...(bizSettingsJson.pos?.customerDisplay || {}),
      },
      printer: {
        ...DEFAULT_POS_SETTINGS.printer,
        ...(bizSettingsJson.pos?.printer || {}),
      },
      cashDrawer: {
        ...DEFAULT_POS_SETTINGS.cashDrawer,
        ...(bizSettingsJson.pos?.cashDrawer || {}),
      },
    };

    res.status(200).json({
      success: true,
      data: posSettings,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/settings/pos
 * Update POS operational settings
 */
settingsRouter.put(
  '/pos',
  requireAuth,
  requirePermission(PERMISSIONS.SETTINGS_MANAGE),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const parsed = updatePosSettingsSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.issues[0]?.message || 'Invalid POS settings payload',
          },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const business = await prisma.business.findUnique({
        where: { id: user.businessId },
      });

      const currentJson = (business?.settings as Record<string, any>) || {};
      const updatedJson = {
        ...currentJson,
        pos: parsed.data,
      };

      await prisma.business.update({
        where: { id: user.businessId },
        data: { settings: updatedJson },
      });

      res.status(200).json({
        success: true,
        data: parsed.data,
        message: 'POS operational settings saved successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * GET /api/settings/localization
 * Get localization settings
 */
settingsRouter.get(
  '/localization',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const business = await prisma.business.findUnique({
        where: { id: user.businessId },
      });

      const bizSettingsJson = (business?.settings as Record<string, any>) || {};
      const loc: LocalizationSettings = {
        language: bizSettingsJson.localization?.language || DEFAULT_LOCALIZATION_SETTINGS.language,
        defaultCurrency:
          (bizSettingsJson.localization?.defaultCurrency as any) ||
          business?.defaultCurrency ||
          'USD',
        currencyFormatting: {
          ...DEFAULT_LOCALIZATION_SETTINGS.currencyFormatting,
          symbol: business?.defaultCurrency === 'KHR' ? '៛' : '$',
          ...(bizSettingsJson.localization?.currencyFormatting || {}),
        },
        dateTimeFormatting: {
          ...DEFAULT_LOCALIZATION_SETTINGS.dateTimeFormatting,
          timezone: business?.timezone || 'Asia/Phnom_Penh',
          ...(bizSettingsJson.localization?.dateTimeFormatting || {}),
        },
      };

      res.status(200).json({
        success: true,
        data: loc,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * PUT /api/settings/localization
 * Update localization settings
 */
settingsRouter.put(
  '/localization',
  requireAuth,
  requirePermission(PERMISSIONS.SETTINGS_MANAGE),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const parsed = updateLocalizationSettingsSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.issues[0]?.message || 'Invalid localization settings payload',
          },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const business = await prisma.business.findUnique({
        where: { id: user.businessId },
      });

      const currentJson = (business?.settings as Record<string, any>) || {};
      const updatedJson = {
        ...currentJson,
        localization: parsed.data,
      };

      await prisma.business.update({
        where: { id: user.businessId },
        data: {
          settings: updatedJson,
          defaultCurrency: parsed.data.defaultCurrency,
          timezone: parsed.data.dateTimeFormatting.timezone,
        },
      });

      res.status(200).json({
        success: true,
        data: parsed.data,
        message: 'Localization settings updated successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * GET /api/settings/payments
 * Get all payment methods with gateway parameters
 */
settingsRouter.get(
  '/payments',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const methods = await prisma.paymentMethod.findMany({
        where: { businessId: user.businessId },
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
      });

      const mapped: PaymentMethodConfig[] = methods.map((m) => ({
        id: m.id,
        businessId: m.businessId,
        name: m.name,
        code: m.code,
        type: m.type,
        isActive: m.isActive,
        isDefault: m.isDefault,
        config: (m.config as Record<string, any>) || null,
      }));

      res.status(200).json({
        success: true,
        data: mapped,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * POST /api/settings/payments
 * Add a new payment method
 */
settingsRouter.post(
  '/payments',
  requireAuth,
  requirePermission(PERMISSIONS.SETTINGS_MANAGE),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const parsed = paymentMethodConfigSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.issues[0]?.message || 'Invalid payment method payload',
          },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const existing = await prisma.paymentMethod.findUnique({
        where: {
          businessId_code: {
            businessId: user.businessId,
            code: parsed.data.code,
          },
        },
      });

      if (existing) {
        res.status(409).json({
          success: false,
          error: {
            code: 'PAYMENT_METHOD_EXISTS',
            message: `Payment method with code '${parsed.data.code}' already exists.`,
          },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      if (parsed.data.isDefault) {
        // Clear other defaults
        await prisma.paymentMethod.updateMany({
          where: { businessId: user.businessId },
          data: { isDefault: false },
        });
      }

      const created = await prisma.paymentMethod.create({
        data: {
          businessId: user.businessId,
          name: parsed.data.name,
          code: parsed.data.code,
          type: parsed.data.type as PaymentMethodType,
          isActive: parsed.data.isActive,
          isDefault: parsed.data.isDefault,
          config: parsed.data.config || {},
        },
      });

      res.status(201).json({
        success: true,
        data: {
          id: created.id,
          name: created.name,
          code: created.code,
          type: created.type,
          isActive: created.isActive,
          isDefault: created.isDefault,
          config: created.config,
        },
        message: 'Payment method created successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * PUT /api/settings/payments/:id
 * Update payment method configuration
 */
settingsRouter.put(
  '/payments/:id',
  requireAuth,
  requirePermission(PERMISSIONS.SETTINGS_MANAGE),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const id = req.params.id as string;
      const parsed = paymentMethodConfigSchema.partial().safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.issues[0]?.message || 'Invalid payload',
          },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      if (parsed.data.isDefault) {
        await prisma.paymentMethod.updateMany({
          where: { businessId: user.businessId },
          data: { isDefault: false },
        });
      }

      const updated = await prisma.paymentMethod.update({
        where: { id },
        data: {
          ...(parsed.data.name ? { name: parsed.data.name } : {}),
          ...(parsed.data.type ? { type: parsed.data.type as PaymentMethodType } : {}),
          ...(parsed.data.isActive !== undefined ? { isActive: parsed.data.isActive } : {}),
          ...(parsed.data.isDefault !== undefined ? { isDefault: parsed.data.isDefault } : {}),
          ...(parsed.data.config !== undefined ? { config: parsed.data.config || {} } : {}),
        },
      });

      res.status(200).json({
        success: true,
        data: updated,
        message: 'Payment method updated successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * PATCH /api/settings/payments/:id/toggle
 * Fast toggle active/inactive status
 */
settingsRouter.patch(
  '/payments/:id/toggle',
  requireAuth,
  requirePermission(PERMISSIONS.SETTINGS_MANAGE),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params.id as string;
      const method = await prisma.paymentMethod.findUnique({ where: { id } });
      if (!method) {
        res
          .status(404)
          .json({ success: false, error: { code: 'NOT_FOUND', message: 'Method not found' } });
        return;
      }

      const updated = await prisma.paymentMethod.update({
        where: { id },
        data: { isActive: !method.isActive },
      });

      res.status(200).json({
        success: true,
        data: { id: updated.id, isActive: updated.isActive },
        message: `Payment method ${updated.isActive ? 'enabled' : 'disabled'} successfully`,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * GET /api/settings/users
 * List all users with roles, permissions, and store access
 */
settingsRouter.get(
  '/users',
  requireAuth,
  requirePermission(PERMISSIONS.USERS_MANAGE),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const users = await prisma.user.findMany({
        where: { businessId: user.businessId, deletedAt: null },
        include: {
          userRoles: {
            include: {
              role: {
                include: {
                  rolePermissions: {
                    include: { permission: true },
                  },
                },
              },
              store: true,
            },
          },
        },
        orderBy: { fullName: 'asc' },
      });

      const mapped: UserDetailExtended[] = users.map((u) => {
        const roles = u.userRoles.map((ur) => ({
          roleId: ur.role.id,
          roleName: ur.role.name,
          storeId: ur.store?.id || null,
          storeName: ur.store?.name || null,
        }));

        const permissions = Array.from(
          new Set(
            u.userRoles.flatMap((ur) => ur.role.rolePermissions.map((rp) => rp.permission.code)),
          ),
        );

        const storeAccess = Array.from(
          new Set(
            u.userRoles
              .filter((ur) => ur.store !== null)
              .map((ur) => JSON.stringify({ storeId: ur.store!.id, storeName: ur.store!.name })),
          ),
        ).map((s) => JSON.parse(s));

        return {
          id: u.id,
          username: u.username,
          email: u.email,
          fullName: u.fullName,
          phone: u.phone,
          isActive: u.isActive,
          roles,
          permissions,
          storeAccess,
          lastLoginAt: u.lastLoginAt ? u.lastLoginAt.toISOString() : null,
          createdAt: u.createdAt.toISOString(),
        };
      });

      res.status(200).json({
        success: true,
        data: mapped,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * POST /api/settings/users
 * Create a new user with credentials, roles, and store access
 */
settingsRouter.post(
  '/users',
  requireAuth,
  requirePermission(PERMISSIONS.USERS_MANAGE),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authUser = req.user!;
      const parsed = createSystemUserSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.issues[0]?.message || 'Invalid user data',
          },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // Check username uniqueness
      const existing = await prisma.user.findFirst({
        where: {
          OR: [
            { username: parsed.data.username },
            ...(parsed.data.email ? [{ email: parsed.data.email }] : []),
          ],
        },
      });

      if (existing) {
        res.status(409).json({
          success: false,
          error: { code: 'USER_EXISTS', message: 'Username or email is already registered.' },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // Resolve assigned role (roleId or first in roleIds)
      const assignedRoleId = parsed.data.roleId || parsed.data.roleIds?.[0];
      if (!assignedRoleId) {
        res.status(400).json({
          success: false,
          error: { code: 'ROLE_REQUIRED', message: 'At least one role ID must be assigned.' },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // Verify Role exists
      const role = await prisma.role.findFirst({
        where: { id: assignedRoleId, businessId: authUser.businessId },
      });

      if (!role) {
        res.status(404).json({
          success: false,
          error: { code: 'ROLE_NOT_FOUND', message: 'Assigned role does not exist.' },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const passwordHash = await bcrypt.hash(parsed.data.password, 10);
      const pinCodeHash = parsed.data.pinCode ? await bcrypt.hash(parsed.data.pinCode, 10) : null;

      const newUser = await prisma.$transaction(async (tx) => {
        const createdUser = await tx.user.create({
          data: {
            businessId: authUser.businessId,
            username: parsed.data.username,
            email: parsed.data.email || null,
            passwordHash,
            pinCodeHash,
            fullName: parsed.data.fullName,
            phone: parsed.data.phone || null,
            isActive: parsed.data.isActive ?? true,
          },
        });

        // Assign Store Roles
        const storeIds = parsed.data.storeIds || [];
        if (storeIds.length === 0) {
          // Business-wide assignment
          await tx.userRole.create({
            data: {
              userId: createdUser.id,
              roleId: role.id,
              storeId: null,
            },
          });
        } else {
          // Scoped store assignments
          for (const sId of storeIds) {
            await tx.userRole.create({
              data: {
                userId: createdUser.id,
                roleId: role.id,
                storeId: sId,
              },
            });
          }
        }

        return createdUser;
      });

      const userExtended = await prisma.user.findUnique({
        where: { id: newUser.id },
        include: {
          userRoles: {
            include: {
              role: {
                include: {
                  rolePermissions: {
                    include: { permission: true },
                  },
                },
              },
              store: true,
            },
          },
        },
      });

      const roles = (userExtended?.userRoles || []).map((ur) => ({
        roleId: ur.role.id,
        roleName: ur.role.name,
        storeId: ur.store?.id || null,
        storeName: ur.store?.name || null,
      }));

      const permissions = Array.from(
        new Set(
          (userExtended?.userRoles || []).flatMap((ur) =>
            ur.role.rolePermissions.map((rp) => rp.permission.code),
          ),
        ),
      );

      const storeAccess = Array.from(
        new Set(
          (userExtended?.userRoles || [])
            .filter((ur) => ur.store !== null)
            .map((ur) => JSON.stringify({ storeId: ur.store!.id, storeName: ur.store!.name })),
        ),
      ).map((s) => JSON.parse(s));

      res.status(201).json({
        success: true,
        data: {
          id: newUser.id,
          username: newUser.username,
          fullName: newUser.fullName,
          email: newUser.email,
          phone: newUser.phone,
          isActive: newUser.isActive,
          roles,
          permissions,
          storeAccess,
        },
        message: 'User created successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * PUT /api/settings/users/:id
 * Update existing user
 */
settingsRouter.put(
  '/users/:id',
  requireAuth,
  requirePermission(PERMISSIONS.USERS_MANAGE),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authUser = req.user!;
      const userId = req.params.id as string;

      const user = await prisma.user.findFirst({
        where: { id: userId, businessId: authUser.businessId, deletedAt: null },
      });

      if (!user) {
        res.status(404).json({
          success: false,
          error: { code: 'USER_NOT_FOUND', message: 'User not found' },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const parsed = updateSystemUserSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.issues[0]?.message || 'Invalid user data',
          },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const updateData: Prisma.UserUpdateInput = {};
      if (parsed.data.fullName) updateData.fullName = parsed.data.fullName;
      if (parsed.data.email !== undefined) updateData.email = parsed.data.email || null;
      if (parsed.data.phone !== undefined) updateData.phone = parsed.data.phone || null;
      if (parsed.data.isActive !== undefined) updateData.isActive = parsed.data.isActive;

      if (parsed.data.password) {
        updateData.passwordHash = await bcrypt.hash(parsed.data.password, 10);
      }
      if (parsed.data.pinCode) {
        updateData.pinCodeHash = await bcrypt.hash(parsed.data.pinCode, 10);
      }

      await prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: userId },
          data: updateData,
        });

        // Reassign role and store access if roleId or storeIds provided
        const roleIdToAssign = parsed.data.roleId || parsed.data.roleIds?.[0];
        if (roleIdToAssign) {
          await tx.userRole.deleteMany({ where: { userId } });

          const storeIds = parsed.data.storeIds || [];
          if (storeIds.length === 0) {
            await tx.userRole.create({
              data: { userId, roleId: roleIdToAssign, storeId: null },
            });
          } else {
            for (const sId of storeIds) {
              await tx.userRole.create({
                data: { userId, roleId: roleIdToAssign, storeId: sId },
              });
            }
          }
        }
      });

      const updatedUser = await prisma.user.findUnique({
        where: { id: userId },
      });

      res.status(200).json({
        success: true,
        data: updatedUser
          ? {
              id: updatedUser.id,
              username: updatedUser.username,
              fullName: updatedUser.fullName,
              email: updatedUser.email,
              phone: updatedUser.phone,
              isActive: updatedUser.isActive,
            }
          : null,
        message: 'User updated successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * PATCH /api/settings/users/:id/toggle
 * Toggle active/suspended user state
 */
settingsRouter.patch(
  '/users/:id/toggle',
  requireAuth,
  requirePermission(PERMISSIONS.USERS_MANAGE),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authUser = req.user!;
      const userId = req.params.id as string;

      if (userId === authUser.userId) {
        res.status(400).json({
          success: false,
          error: {
            code: 'SELF_SUSPEND_BLOCKED',
            message: 'You cannot deactivate your own account.',
          },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const user = await prisma.user.findFirst({
        where: { id: userId, businessId: authUser.businessId, deletedAt: null },
      });

      if (!user) {
        res
          .status(404)
          .json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } });
        return;
      }

      const updated = await prisma.user.update({
        where: { id: userId },
        data: { isActive: !user.isActive },
      });

      res.status(200).json({
        success: true,
        data: { id: updated.id, isActive: updated.isActive },
        message: `User ${updated.fullName} is now ${updated.isActive ? 'active' : 'suspended'}.`,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * GET /api/settings/roles
 * List roles with permissions matrix
 */
settingsRouter.get(
  '/roles',
  requireAuth,
  requirePermission(PERMISSIONS.USERS_MANAGE),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authUser = req.user!;
      const [roles, permissions] = await Promise.all([
        prisma.role.findMany({
          where: { businessId: authUser.businessId },
          include: {
            rolePermissions: {
              include: { permission: true },
            },
            _count: { select: { userRoles: true } },
          },
          orderBy: { name: 'asc' },
        }),
        prisma.permission.findMany({
          orderBy: [{ category: 'asc' }, { name: 'asc' }],
        }),
      ]);

      const mapped: RoleDetailExtended[] = roles.map((r) => ({
        id: r.id,
        businessId: r.businessId,
        name: r.name,
        description: r.description,
        isSystem: r.isSystem,
        permissions: r.rolePermissions.map((rp) => ({
          id: rp.permission.id,
          code: rp.permission.code,
          name: rp.permission.name,
          category: rp.permission.category,
        })),
        userCount: r._count.userRoles,
        createdAt: r.createdAt.toISOString(),
      }));

      res.status(200).json({
        success: true,
        data: {
          roles: mapped,
          allPermissions: permissions,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * PUT /api/settings/roles/:id
 * Update role permissions
 */
settingsRouter.put(
  '/roles/:id',
  requireAuth,
  requirePermission(PERMISSIONS.USERS_MANAGE),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authUser = req.user!;
      const roleId = req.params.id as string;
      const { permissionIds, description } = req.body;

      const role = await prisma.role.findFirst({
        where: { id: roleId, businessId: authUser.businessId },
      });

      if (!role) {
        res.status(404).json({
          success: false,
          error: { code: 'ROLE_NOT_FOUND', message: 'Role not found' },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      await prisma.$transaction(async (tx) => {
        if (description !== undefined) {
          await tx.role.update({
            where: { id: roleId },
            data: { description },
          });
        }

        if (Array.isArray(permissionIds)) {
          await tx.rolePermission.deleteMany({ where: { roleId } });
          for (const pId of permissionIds) {
            await tx.rolePermission.create({
              data: { roleId, permissionId: pId },
            });
          }
        }
      });

      res.status(200).json({
        success: true,
        message: 'Role permissions updated successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  },
);
