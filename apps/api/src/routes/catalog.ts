import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../db/index.js';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import { PERMISSIONS } from '@pos/types';
import {
  createProductSchema,
  updateProductSchema,
  createVariantSchema,
  updateVariantSchema,
  categorySchema,
  brandSchema,
  supplierSchema,
} from '@pos/validation';

export const catalogRouter: Router = Router();

// ==============================================================================
// 1. PRODUCTS MANAGEMENT
// ==============================================================================

/**
 * GET /api/catalog/products
 * List products with multi-criteria filtering, search, pagination, and stock overview
 */
catalogRouter.get(
  '/products',
  requireAuth,
  requirePermission(PERMISSIONS.PRODUCTS_VIEW),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const businessId = user.businessId;

      const search = typeof req.query.search === 'string' ? req.query.search.trim() : undefined;
      const categoryId = typeof req.query.categoryId === 'string' ? req.query.categoryId : undefined;
      const brandId = typeof req.query.brandId === 'string' ? req.query.brandId : undefined;
      const supplierId = typeof req.query.supplierId === 'string' ? req.query.supplierId : undefined;
      const isActive = req.query.isActive !== undefined ? req.query.isActive === 'true' : undefined;
      const lowStockOnly = req.query.lowStockOnly === 'true';
      const limit = Math.min(parseInt(req.query.limit as string, 10) || 50, 200);
      const offset = parseInt(req.query.offset as string, 10) || 0;

      const where: any = {
        businessId,
        deletedAt: null,
      };

      if (isActive !== undefined) {
        where.isActive = isActive;
      }
      if (categoryId) {
        where.categoryId = categoryId;
      }
      if (brandId) {
        where.brandId = brandId;
      }
      if (supplierId) {
        where.supplierId = supplierId;
      }

      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { nameKhmer: { contains: search, mode: 'insensitive' } },
          { sku: { contains: search, mode: 'insensitive' } },
          { barcode: { contains: search, mode: 'insensitive' } },
        ];
      }

      const [totalCount, products] = await Promise.all([
        prisma.product.count({ where }),
        prisma.product.findMany({
          where,
          include: {
            category: { select: { id: true, name: true, color: true } },
            brand: { select: { id: true, name: true } },
            supplier: { select: { id: true, name: true, phone: true } },
            variants: {
              where: { deletedAt: null },
              include: {
                inventory: {
                  select: { quantity: true },
                },
              },
            },
            inventory: {
              select: {
                quantity: true,
                locationId: true,
                minStockLevel: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          skip: offset,
          take: limit,
        }),
      ]);

      const formatted = products.map((p) => {
        const totalStock = p.inventory.reduce((sum: number, inv) => sum + Number(inv.quantity), 0);
        const isLow = totalStock <= p.reorderLevel;

        const variants = p.variants.map((v) => {
          const varStock = v.inventory.reduce((sum: number, inv) => sum + Number(inv.quantity), 0);
          return {
            id: v.id,
            productId: v.productId,
            name: v.name,
            sku: v.sku,
            barcode: v.barcode,
            costPriceUSD: Number(v.costPriceUSD),
            sellingPriceUSD: Number(v.sellingPriceUSD),
            sellingPriceKHR: Number(v.sellingPriceKHR),
            size: v.size,
            color: v.color,
            weight: v.weight,
            model: v.model,
            attributes: v.attributes,
            isActive: v.isActive,
            stockQuantity: varStock,
            createdAt: v.createdAt.toISOString(),
            updatedAt: v.updatedAt.toISOString(),
          };
        });

        return {
          id: p.id,
          businessId: p.businessId,
          name: p.name,
          nameKhmer: p.nameKhmer,
          sku: p.sku,
          barcode: p.barcode,
          description: p.description,
          categoryId: p.categoryId,
          categoryName: p.category?.name || null,
          categoryColor: p.category?.color || null,
          brandId: p.brandId,
          brandName: p.brand?.name || null,
          supplierId: p.supplierId,
          supplierName: p.supplier?.name || null,
          costPriceUSD: Number(p.costPriceUSD),
          sellingPriceUSD: Number(p.sellingPriceUSD),
          sellingPriceKHR: Number(p.sellingPriceKHR),
          taxRate: Number(p.taxRate),
          isTaxInclusive: p.isTaxInclusive,
          trackInventory: p.trackInventory,
          alertLowStock: p.alertLowStock,
          reorderLevel: p.reorderLevel,
          unit: p.unit,
          imageUrl: p.imageUrl,
          isActive: p.isActive,
          stockQuantity: totalStock,
          isLowStock: isLow,
          variants,
          createdAt: p.createdAt.toISOString(),
          updatedAt: p.updatedAt.toISOString(),
        };
      });

      const filtered = lowStockOnly ? formatted.filter((p) => p.isLowStock) : formatted;

      res.status(200).json({
        success: true,
        data: {
          items: filtered,
          pagination: {
            total: lowStockOnly ? filtered.length : totalCount,
            limit,
            offset,
          },
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * GET /api/catalog/products/barcode/:barcode
 * Fast barcode and SKU index lookup across products and variants
 */
catalogRouter.get(
  '/products/barcode/:barcode',
  requireAuth,
  requirePermission(PERMISSIONS.PRODUCTS_VIEW),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const barcode = String(req.params.barcode).trim();

      // 1. Check direct product barcode or SKU
      const product = await prisma.product.findFirst({
        where: {
          businessId: user.businessId,
          deletedAt: null,
          OR: [{ barcode }, { sku: barcode }],
        },
        include: {
          category: { select: { id: true, name: true } },
          brand: { select: { id: true, name: true } },
          supplier: { select: { id: true, name: true } },
          inventory: {
            select: {
              locationId: true,
              quantity: true,
              location: { select: { name: true, code: true } },
            },
          },
          variants: { where: { deletedAt: null } },
        },
      });

      if (product) {
        const totalStock = product.inventory.reduce((sum: number, inv) => sum + Number(inv.quantity), 0);
        res.status(200).json({
          success: true,
          data: {
            matchType: 'PRODUCT',
            product: {
              id: product.id,
              name: product.name,
              nameKhmer: product.nameKhmer,
              sku: product.sku,
              barcode: product.barcode,
              costPriceUSD: Number(product.costPriceUSD),
              sellingPriceUSD: Number(product.sellingPriceUSD),
              sellingPriceKHR: Number(product.sellingPriceKHR),
              taxRate: Number(product.taxRate),
              unit: product.unit,
              imageUrl: product.imageUrl,
              reorderLevel: product.reorderLevel,
              stockQuantity: totalStock,
              isLowStock: totalStock <= product.reorderLevel,
              categoryName: product.category?.name || null,
              brandName: product.brand?.name || null,
              inventory: product.inventory.map((inv) => ({
                locationId: inv.locationId,
                locationName: inv.location.name,
                locationCode: inv.location.code,
                quantity: Number(inv.quantity),
              })),
            },
          },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // 2. Check variant barcode or SKU
      const variant = await prisma.productVariant.findFirst({
        where: {
          product: { businessId: user.businessId, deletedAt: null },
          deletedAt: null,
          OR: [{ barcode }, { sku: barcode }],
        },
        include: {
          product: {
            include: {
              category: { select: { id: true, name: true } },
              brand: { select: { id: true, name: true } },
            },
          },
          inventory: {
            select: {
              locationId: true,
              quantity: true,
              location: { select: { name: true, code: true } },
            },
          },
        },
      });

      if (variant) {
        const totalStock = variant.inventory.reduce((sum: number, inv) => sum + Number(inv.quantity), 0);
        res.status(200).json({
          success: true,
          data: {
            matchType: 'VARIANT',
            variant: {
              id: variant.id,
              productId: variant.productId,
              name: variant.name,
              sku: variant.sku,
              barcode: variant.barcode,
              size: variant.size,
              color: variant.color,
              weight: variant.weight,
              model: variant.model,
              costPriceUSD: Number(variant.costPriceUSD),
              sellingPriceUSD: Number(variant.sellingPriceUSD),
              sellingPriceKHR: Number(variant.sellingPriceKHR),
              stockQuantity: totalStock,
              product: {
                id: variant.product.id,
                name: variant.product.name,
                nameKhmer: variant.product.nameKhmer,
                taxRate: Number(variant.product.taxRate),
                unit: variant.product.unit,
                imageUrl: variant.product.imageUrl,
                categoryName: variant.product.category?.name || null,
                brandName: variant.product.brand?.name || null,
              },
              inventory: variant.inventory.map((inv) => ({
                locationId: inv.locationId,
                locationName: inv.location.name,
                locationCode: inv.location.code,
                quantity: Number(inv.quantity),
              })),
            },
          },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: `No product or variant found for barcode/SKU: ${barcode}` },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * GET /api/catalog/products/:id
 * Retrieve a single product by ID with full details
 */
catalogRouter.get(
  '/products/:id',
  requireAuth,
  requirePermission(PERMISSIONS.PRODUCTS_VIEW),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const productId = String(req.params.id);

      const product = await prisma.product.findFirst({
        where: {
          id: productId,
          businessId: user.businessId,
          deletedAt: null,
        },
        include: {
          category: true,
          brand: true,
          supplier: true,
          variants: { where: { deletedAt: null } },
          inventory: {
            include: {
              location: true,
            },
          },
        },
      });

      if (!product) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Product not found' },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const totalStock = product.inventory.reduce((sum: number, inv) => sum + Number(inv.quantity), 0);

      res.status(200).json({
        success: true,
        data: {
          ...product,
          costPriceUSD: Number(product.costPriceUSD),
          sellingPriceUSD: Number(product.sellingPriceUSD),
          sellingPriceKHR: Number(product.sellingPriceKHR),
          taxRate: Number(product.taxRate),
          stockQuantity: totalStock,
          isLowStock: totalStock <= product.reorderLevel,
          inventory: product.inventory.map((inv) => ({
            id: inv.id,
            locationId: inv.locationId,
            locationName: inv.location.name,
            locationCode: inv.location.code,
            quantity: Number(inv.quantity),
            minStockLevel: Number(inv.minStockLevel),
          })),
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * POST /api/catalog/products
 * Create a new product with full fields & optional initial stock transaction
 */
catalogRouter.post(
  '/products',
  requireAuth,
  requirePermission(PERMISSIONS.PRODUCTS_CREATE),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const parsed = createProductSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message || 'Invalid product data' },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const input = parsed.data;

      // Check SKU uniqueness in business
      const existingSku = await prisma.product.findFirst({
        where: { businessId: user.businessId, sku: input.sku, deletedAt: null },
      });
      if (existingSku) {
        res.status(409).json({
          success: false,
          error: { code: 'DUPLICATE_SKU', message: `Product with SKU "${input.sku}" already exists` },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // Check Barcode uniqueness if provided
      if (input.barcode) {
        const existingBarcode = await prisma.product.findFirst({
          where: { businessId: user.businessId, barcode: input.barcode, deletedAt: null },
        });
        if (existingBarcode) {
          res.status(409).json({
            success: false,
            error: { code: 'DUPLICATE_BARCODE', message: `Product with barcode "${input.barcode}" already exists` },
            timestamp: new Date().toISOString(),
          });
          return;
        }
      }

      // Execute within database transaction
      const product = await prisma.$transaction(async (tx) => {
        const created = await tx.product.create({
          data: {
            businessId: user.businessId,
            name: input.name,
            nameKhmer: input.nameKhmer || null,
            sku: input.sku,
            barcode: input.barcode || null,
            categoryId: input.categoryId || null,
            brandId: input.brandId || null,
            supplierId: input.supplierId || null,
            description: input.description || null,
            costPriceUSD: input.costPriceUSD,
            sellingPriceUSD: input.sellingPriceUSD,
            sellingPriceKHR: input.sellingPriceKHR || Math.round(input.sellingPriceUSD * 4100),
            taxRate: input.taxRate ?? 0.1,
            isTaxInclusive: input.isTaxInclusive ?? true,
            trackInventory: input.trackInventory ?? true,
            alertLowStock: input.alertLowStock ?? 5,
            reorderLevel: input.reorderLevel ?? 5,
            unit: input.unit || 'pcs',
            imageUrl: input.imageUrl || null,
            isActive: input.isActive ?? true,
          },
        });

        // If initial stock was provided, create inventory record and movement record
        if (input.initialStock && input.initialStock > 0) {
          let locationId = input.initialLocationId;
          let storeId = user.storeId;

          if (!locationId) {
            const defaultLoc = await tx.inventoryLocation.findFirst({
              where: {
                store: { businessId: user.businessId },
                isDefault: true,
              },
            });
            if (defaultLoc) {
              locationId = defaultLoc.id;
              storeId = defaultLoc.storeId;
            }
          }

          if (locationId && storeId) {
            await tx.inventory.create({
              data: {
                storeId,
                locationId,
                productId: created.id,
                quantity: input.initialStock,
                minStockLevel: input.reorderLevel ?? 5,
              },
            });

            await tx.stockMovement.create({
              data: {
                storeId,
                locationId,
                productId: created.id,
                type: 'PURCHASE',
                quantityChange: input.initialStock,
                quantityBefore: 0,
                quantityAfter: input.initialStock,
                unitCost: input.costPriceUSD,
                referenceType: 'INITIAL_STOCK',
                notes: 'Initial stock entered on product creation',
                createdById: user.userId,
              },
            });
          }
        }

        return created;
      });

      res.status(201).json({
        success: true,
        data: product,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * PUT /api/catalog/products/:id
 * Update product fields
 */
catalogRouter.put(
  '/products/:id',
  requireAuth,
  requirePermission(PERMISSIONS.PRODUCTS_UPDATE),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const productId = String(req.params.id);

      const existing = await prisma.product.findFirst({
        where: { id: productId, businessId: user.businessId, deletedAt: null },
      });
      if (!existing) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Product not found' },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const parsed = updateProductSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message || 'Invalid product data' },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const input = parsed.data;

      // Check SKU uniqueness if changed
      if (input.sku && input.sku !== existing.sku) {
        const dup = await prisma.product.findFirst({
          where: {
            businessId: user.businessId,
            sku: input.sku,
            deletedAt: null,
            id: { not: productId },
          },
        });
        if (dup) {
          res.status(409).json({
            success: false,
            error: { code: 'DUPLICATE_SKU', message: `Product with SKU "${input.sku}" already exists` },
            timestamp: new Date().toISOString(),
          });
          return;
        }
      }

      const updated = await prisma.product.update({
        where: { id: productId },
        data: {
          name: input.name ?? existing.name,
          nameKhmer: input.nameKhmer !== undefined ? input.nameKhmer : existing.nameKhmer,
          sku: input.sku ?? existing.sku,
          barcode: input.barcode !== undefined ? input.barcode : existing.barcode,
          categoryId: input.categoryId !== undefined ? input.categoryId : existing.categoryId,
          brandId: input.brandId !== undefined ? input.brandId : existing.brandId,
          supplierId: input.supplierId !== undefined ? input.supplierId : existing.supplierId,
          description: input.description !== undefined ? input.description : existing.description,
          costPriceUSD: input.costPriceUSD !== undefined ? input.costPriceUSD : existing.costPriceUSD,
          sellingPriceUSD: input.sellingPriceUSD !== undefined ? input.sellingPriceUSD : existing.sellingPriceUSD,
          sellingPriceKHR:
            input.sellingPriceKHR !== undefined
              ? input.sellingPriceKHR
              : input.sellingPriceUSD !== undefined
                ? Math.round(input.sellingPriceUSD * 4100)
                : existing.sellingPriceKHR,
          taxRate: input.taxRate !== undefined ? input.taxRate : existing.taxRate,
          isTaxInclusive: input.isTaxInclusive !== undefined ? input.isTaxInclusive : existing.isTaxInclusive,
          trackInventory: input.trackInventory !== undefined ? input.trackInventory : existing.trackInventory,
          alertLowStock: input.alertLowStock !== undefined ? input.alertLowStock : existing.alertLowStock,
          reorderLevel: input.reorderLevel !== undefined ? input.reorderLevel : existing.reorderLevel,
          unit: input.unit ?? existing.unit,
          imageUrl: input.imageUrl !== undefined ? input.imageUrl : existing.imageUrl,
          isActive: input.isActive !== undefined ? input.isActive : existing.isActive,
        },
      });

      res.status(200).json({
        success: true,
        data: updated,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * DELETE /api/catalog/products/:id
 * Soft-delete product
 */
catalogRouter.delete(
  '/products/:id',
  requireAuth,
  requirePermission(PERMISSIONS.PRODUCTS_DELETE),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const productId = String(req.params.id);

      const existing = await prisma.product.findFirst({
        where: { id: productId, businessId: user.businessId, deletedAt: null },
      });
      if (!existing) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Product not found' },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      await prisma.product.update({
        where: { id: productId },
        data: { deletedAt: new Date() },
      });

      res.status(200).json({
        success: true,
        data: { message: `Product "${existing.name}" successfully deleted` },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  },
);

// ==============================================================================
// 2. PRODUCT VARIANTS MANAGEMENT
// ==============================================================================

/**
 * GET /api/catalog/products/:productId/variants
 * List variants for a product
 */
catalogRouter.get(
  '/products/:productId/variants',
  requireAuth,
  requirePermission(PERMISSIONS.PRODUCTS_VIEW),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const productId = String(req.params.productId);

      const variants = await prisma.productVariant.findMany({
        where: {
          productId,
          product: { businessId: user.businessId },
          deletedAt: null,
        },
        include: {
          inventory: {
            include: { location: { select: { name: true, code: true } } },
          },
        },
        orderBy: { createdAt: 'asc' },
      });

      const formatted = variants.map((v) => {
        const totalStock = v.inventory.reduce((sum: number, inv) => sum + Number(inv.quantity), 0);
        return {
          id: v.id,
          productId: v.productId,
          name: v.name,
          sku: v.sku,
          barcode: v.barcode,
          size: v.size,
          color: v.color,
          weight: v.weight,
          model: v.model,
          costPriceUSD: Number(v.costPriceUSD),
          sellingPriceUSD: Number(v.sellingPriceUSD),
          sellingPriceKHR: Number(v.sellingPriceKHR),
          isActive: v.isActive,
          stockQuantity: totalStock,
          inventory: v.inventory.map((inv) => ({
            locationId: inv.locationId,
            locationName: inv.location.name,
            quantity: Number(inv.quantity),
          })),
        };
      });

      res.status(200).json({
        success: true,
        data: formatted,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * POST /api/catalog/products/:productId/variants
 * Create a new variant (size, color, weight, model, etc.)
 */
catalogRouter.post(
  '/products/:productId/variants',
  requireAuth,
  requirePermission(PERMISSIONS.PRODUCTS_CREATE),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const productId = String(req.params.productId);

      const product = await prisma.product.findFirst({
        where: { id: productId, businessId: user.businessId, deletedAt: null },
      });
      if (!product) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Parent product not found' },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const parsed = createVariantSchema.safeParse({ ...req.body, productId });
      if (!parsed.success) {
        res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message || 'Invalid variant data' },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const input = parsed.data;

      // Check variant SKU uniqueness within product
      const dup = await prisma.productVariant.findFirst({
        where: { productId, sku: input.sku, deletedAt: null },
      });
      if (dup) {
        res.status(409).json({
          success: false,
          error: { code: 'DUPLICATE_SKU', message: `Variant with SKU "${input.sku}" already exists` },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const variant = await prisma.$transaction(async (tx) => {
        const created = await tx.productVariant.create({
          data: {
            productId,
            name: input.name,
            sku: input.sku,
            barcode: input.barcode || null,
            size: input.size || null,
            color: input.color || null,
            weight: input.weight || null,
            model: input.model || null,
            costPriceUSD: input.costPriceUSD,
            sellingPriceUSD: input.sellingPriceUSD,
            sellingPriceKHR: input.sellingPriceKHR || Math.round(input.sellingPriceUSD * 4100),
            isActive: input.isActive ?? true,
          },
        });

        if (input.initialStock && input.initialStock > 0) {
          let locationId = input.initialLocationId;
          let storeId = user.storeId;

          if (!locationId) {
            const defaultLoc = await tx.inventoryLocation.findFirst({
              where: { store: { businessId: user.businessId }, isDefault: true },
            });
            if (defaultLoc) {
              locationId = defaultLoc.id;
              storeId = defaultLoc.storeId;
            }
          }

          if (locationId && storeId) {
            await tx.inventory.create({
              data: {
                storeId,
                locationId,
                productId,
                variantId: created.id,
                quantity: input.initialStock,
                minStockLevel: 5,
              },
            });

            await tx.stockMovement.create({
              data: {
                storeId,
                locationId,
                productId,
                variantId: created.id,
                type: 'PURCHASE',
                quantityChange: input.initialStock,
                quantityBefore: 0,
                quantityAfter: input.initialStock,
                unitCost: input.costPriceUSD,
                referenceType: 'INITIAL_STOCK',
                notes: 'Initial stock entered on variant creation',
                createdById: user.userId,
              },
            });
          }
        }

        return created;
      });

      res.status(201).json({
        success: true,
        data: variant,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * PUT /api/catalog/variants/:id
 * Update a variant
 */
catalogRouter.put(
  '/variants/:id',
  requireAuth,
  requirePermission(PERMISSIONS.PRODUCTS_UPDATE),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const variantId = String(req.params.id);

      const existing = await prisma.productVariant.findFirst({
        where: {
          id: variantId,
          product: { businessId: user.businessId },
          deletedAt: null,
        },
      });
      if (!existing) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Variant not found' },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const parsed = updateVariantSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message || 'Invalid variant data' },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const input = parsed.data;

      const updated = await prisma.productVariant.update({
        where: { id: variantId },
        data: {
          name: input.name ?? existing.name,
          sku: input.sku ?? existing.sku,
          barcode: input.barcode !== undefined ? input.barcode : existing.barcode,
          size: input.size !== undefined ? input.size : existing.size,
          color: input.color !== undefined ? input.color : existing.color,
          weight: input.weight !== undefined ? input.weight : existing.weight,
          model: input.model !== undefined ? input.model : existing.model,
          costPriceUSD: input.costPriceUSD !== undefined ? input.costPriceUSD : existing.costPriceUSD,
          sellingPriceUSD: input.sellingPriceUSD !== undefined ? input.sellingPriceUSD : existing.sellingPriceUSD,
          sellingPriceKHR:
            input.sellingPriceKHR !== undefined
              ? input.sellingPriceKHR
              : input.sellingPriceUSD !== undefined
                ? Math.round(input.sellingPriceUSD * 4100)
                : existing.sellingPriceKHR,
          isActive: input.isActive !== undefined ? input.isActive : existing.isActive,
        },
      });

      res.status(200).json({
        success: true,
        data: updated,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * DELETE /api/catalog/variants/:id
 * Soft-delete a variant
 */
catalogRouter.delete(
  '/variants/:id',
  requireAuth,
  requirePermission(PERMISSIONS.PRODUCTS_DELETE),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const variantId = String(req.params.id);

      const existing = await prisma.productVariant.findFirst({
        where: {
          id: variantId,
          product: { businessId: user.businessId },
          deletedAt: null,
        },
      });
      if (!existing) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Variant not found' },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      await prisma.productVariant.update({
        where: { id: variantId },
        data: { deletedAt: new Date() },
      });

      res.status(200).json({
        success: true,
        data: { message: `Variant "${existing.name}" successfully deleted` },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  },
);

// ==============================================================================
// 3. CATEGORIES MANAGEMENT
// ==============================================================================

catalogRouter.get(
  '/categories',
  requireAuth,
  requirePermission(PERMISSIONS.PRODUCTS_VIEW),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const categories = await prisma.category.findMany({
        where: { businessId: user.businessId, deletedAt: null },
        include: {
          _count: { select: { products: { where: { deletedAt: null } } } },
        },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      });

      const formatted = categories.map((c) => ({
        id: c.id,
        businessId: c.businessId,
        name: c.name,
        code: c.code,
        parentId: c.parentId,
        color: c.color,
        icon: c.icon,
        sortOrder: c.sortOrder,
        isActive: c.isActive,
        productCount: c._count.products,
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
      }));

      res.status(200).json({
        success: true,
        data: formatted,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  },
);

catalogRouter.post(
  '/categories',
  requireAuth,
  requirePermission(PERMISSIONS.PRODUCTS_CREATE),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const parsed = categorySchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message || 'Invalid category' },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const input = parsed.data;
      const category = await prisma.category.create({
        data: {
          businessId: user.businessId,
          name: input.name,
          code: input.code || null,
          parentId: input.parentId || null,
          color: input.color || '#4f46e5',
          icon: input.icon || null,
          sortOrder: input.sortOrder ?? 0,
          isActive: input.isActive ?? true,
        },
      });

      res.status(201).json({
        success: true,
        data: category,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  },
);

catalogRouter.put(
  '/categories/:id',
  requireAuth,
  requirePermission(PERMISSIONS.PRODUCTS_UPDATE),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const categoryId = String(req.params.id);

      const category = await prisma.category.findFirst({
        where: { id: categoryId, businessId: user.businessId, deletedAt: null },
      });
      if (!category) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Category not found' },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const parsed = categorySchema.partial().safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message || 'Invalid category' },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const updated = await prisma.category.update({
        where: { id: categoryId },
        data: parsed.data,
      });

      res.status(200).json({
        success: true,
        data: updated,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  },
);

catalogRouter.delete(
  '/categories/:id',
  requireAuth,
  requirePermission(PERMISSIONS.PRODUCTS_DELETE),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const categoryId = String(req.params.id);

      const category = await prisma.category.findFirst({
        where: { id: categoryId, businessId: user.businessId, deletedAt: null },
      });
      if (!category) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Category not found' },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      await prisma.category.update({
        where: { id: categoryId },
        data: { deletedAt: new Date() },
      });

      res.status(200).json({
        success: true,
        data: { message: `Category "${category.name}" successfully deleted` },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  },
);

// ==============================================================================
// 4. BRANDS MANAGEMENT
// ==============================================================================

catalogRouter.get(
  '/brands',
  requireAuth,
  requirePermission(PERMISSIONS.PRODUCTS_VIEW),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const brands = await prisma.brand.findMany({
        where: { businessId: user.businessId, deletedAt: null },
        include: {
          _count: { select: { products: { where: { deletedAt: null } } } },
        },
        orderBy: { name: 'asc' },
      });

      const formatted = brands.map((b) => ({
        id: b.id,
        businessId: b.businessId,
        name: b.name,
        description: b.description,
        isActive: b.isActive,
        productCount: b._count.products,
        createdAt: b.createdAt.toISOString(),
        updatedAt: b.updatedAt.toISOString(),
      }));

      res.status(200).json({
        success: true,
        data: formatted,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  },
);

catalogRouter.post(
  '/brands',
  requireAuth,
  requirePermission(PERMISSIONS.PRODUCTS_CREATE),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const parsed = brandSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message || 'Invalid brand' },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const brand = await prisma.brand.create({
        data: {
          businessId: user.businessId,
          name: parsed.data.name,
          description: parsed.data.description || null,
          isActive: parsed.data.isActive ?? true,
        },
      });

      res.status(201).json({
        success: true,
        data: brand,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  },
);

catalogRouter.put(
  '/brands/:id',
  requireAuth,
  requirePermission(PERMISSIONS.PRODUCTS_UPDATE),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const brandId = String(req.params.id);

      const brand = await prisma.brand.findFirst({
        where: { id: brandId, businessId: user.businessId, deletedAt: null },
      });
      if (!brand) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Brand not found' },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const parsed = brandSchema.partial().safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message || 'Invalid brand' },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const updated = await prisma.brand.update({
        where: { id: brandId },
        data: parsed.data,
      });

      res.status(200).json({
        success: true,
        data: updated,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  },
);

catalogRouter.delete(
  '/brands/:id',
  requireAuth,
  requirePermission(PERMISSIONS.PRODUCTS_DELETE),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const brandId = String(req.params.id);

      const brand = await prisma.brand.findFirst({
        where: { id: brandId, businessId: user.businessId, deletedAt: null },
      });
      if (!brand) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Brand not found' },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      await prisma.brand.update({
        where: { id: brandId },
        data: { deletedAt: new Date() },
      });

      res.status(200).json({
        success: true,
        data: { message: `Brand "${brand.name}" successfully deleted` },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  },
);

// ==============================================================================
// 5. SUPPLIERS MANAGEMENT
// ==============================================================================

catalogRouter.get(
  '/suppliers',
  requireAuth,
  requirePermission(PERMISSIONS.PRODUCTS_VIEW),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const suppliers = await prisma.supplier.findMany({
        where: { businessId: user.businessId, deletedAt: null },
        include: {
          _count: { select: { products: { where: { deletedAt: null } } } },
        },
        orderBy: { name: 'asc' },
      });

      const formatted = suppliers.map((s) => ({
        id: s.id,
        businessId: s.businessId,
        name: s.name,
        contactPerson: s.contactPerson,
        phone: s.phone,
        email: s.email,
        address: s.address,
        taxId: s.taxId,
        isActive: s.isActive,
        productCount: s._count.products,
        createdAt: s.createdAt.toISOString(),
        updatedAt: s.updatedAt.toISOString(),
      }));

      res.status(200).json({
        success: true,
        data: formatted,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  },
);

catalogRouter.post(
  '/suppliers',
  requireAuth,
  requirePermission(PERMISSIONS.PRODUCTS_CREATE),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const parsed = supplierSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message || 'Invalid supplier' },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const input = parsed.data;
      const supplier = await prisma.supplier.create({
        data: {
          businessId: user.businessId,
          name: input.name,
          contactPerson: input.contactPerson || null,
          phone: input.phone || null,
          email: input.email || null,
          address: input.address || null,
          taxId: input.taxId || null,
          isActive: input.isActive ?? true,
        },
      });

      res.status(201).json({
        success: true,
        data: supplier,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  },
);

catalogRouter.put(
  '/suppliers/:id',
  requireAuth,
  requirePermission(PERMISSIONS.PRODUCTS_UPDATE),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const supplierId = String(req.params.id);

      const supplier = await prisma.supplier.findFirst({
        where: { id: supplierId, businessId: user.businessId, deletedAt: null },
      });
      if (!supplier) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Supplier not found' },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const parsed = supplierSchema.partial().safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message || 'Invalid supplier' },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const updated = await prisma.supplier.update({
        where: { id: supplierId },
        data: parsed.data,
      });

      res.status(200).json({
        success: true,
        data: updated,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  },
);

catalogRouter.delete(
  '/suppliers/:id',
  requireAuth,
  requirePermission(PERMISSIONS.PRODUCTS_DELETE),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const supplierId = String(req.params.id);

      const supplier = await prisma.supplier.findFirst({
        where: { id: supplierId, businessId: user.businessId, deletedAt: null },
      });
      if (!supplier) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Supplier not found' },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      await prisma.supplier.update({
        where: { id: supplierId },
        data: { deletedAt: new Date() },
      });

      res.status(200).json({
        success: true,
        data: { message: `Supplier "${supplier.name}" successfully deleted` },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  },
);
