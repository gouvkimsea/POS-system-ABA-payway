import { prisma } from '../../config/prisma.js';
import { ProductQueryInput, CreateProductInput } from './product.schema.js';
import { convertUSDtoKHR } from '../../utils/calculator.js';

export class ProductService {
  static async listProducts(businessId: string, storeId?: string, query?: ProductQueryInput) {
    const page = query?.page || 1;
    const limit = query?.limit || 50;
    const skip = (page - 1) * limit;

    const where: any = {
      businessId,
      isActive: true,
    };

    if (query?.categoryId) {
      where.categoryId = query.categoryId;
    }

    if (query?.search && query.search.trim()) {
      const s = query.search.trim();
      where.OR = [
        { name: { contains: s, mode: 'insensitive' } },
        { sku: { contains: s, mode: 'insensitive' } },
        { barcode: { contains: s, mode: 'insensitive' } },
      ];
    }

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: 'asc' },
        include: {
          category: {
            select: { id: true, name: true, color: true, icon: true },
          },
          inventory: storeId
            ? {
                where: { storeId },
                select: { quantity: true, minStockLevel: true },
              }
            : false,
        },
      }),
      prisma.product.count({ where }),
    ]);

    const formatted = products.map((p) => {
      const stock = p.inventory && p.inventory.length > 0 ? Number(p.inventory[0].quantity) : 0;
      return {
        id: p.id,
        name: p.name,
        sku: p.sku,
        barcode: p.barcode,
        costPrice: Number(p.costPrice),
        sellingPriceUSD: Number(p.sellingPriceUSD),
        sellingPriceKHR: Number(p.sellingPriceKHR),
        taxRate: Number(p.taxRate),
        isTaxInclusive: p.isTaxInclusive,
        unit: p.unit,
        imageUrl: p.imageUrl,
        category: p.category,
        stockQuantity: stock,
        isLowStock: stock <= p.alertLowStock,
      };
    });

    return {
      items: formatted,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  static async lookupBarcode(businessId: string, barcode: string, storeId?: string) {
    const product = await prisma.product.findFirst({
      where: {
        businessId,
        barcode: barcode.trim(),
        isActive: true,
      },
      include: {
        category: true,
        inventory: storeId
          ? {
              where: { storeId },
              select: { quantity: true, minStockLevel: true },
            }
          : false,
      },
    });

    if (!product) {
      return null;
    }

    const stock = product.inventory && product.inventory.length > 0 ? Number(product.inventory[0].quantity) : 0;

    return {
      id: product.id,
      name: product.name,
      sku: product.sku,
      barcode: product.barcode,
      costPrice: Number(product.costPrice),
      sellingPriceUSD: Number(product.sellingPriceUSD),
      sellingPriceKHR: Number(product.sellingPriceKHR),
      taxRate: Number(product.taxRate),
      isTaxInclusive: product.isTaxInclusive,
      unit: product.unit,
      category: product.category,
      stockQuantity: stock,
      isLowStock: stock <= product.alertLowStock,
    };
  }

  static async listCategories(businessId: string) {
    return prisma.category.findMany({
      where: {
        businessId,
        isActive: true,
      },
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: { products: true },
        },
      },
    });
  }

  static async createProduct(businessId: string, storeId: string, input: CreateProductInput) {
    const sellingPriceKHR = input.sellingPriceKHR || convertUSDtoKHR(input.sellingPriceUSD);

    return prisma.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          businessId,
          name: input.name,
          sku: input.sku,
          barcode: input.barcode,
          categoryId: input.categoryId,
          costPrice: input.costPrice,
          sellingPriceUSD: input.sellingPriceUSD,
          sellingPriceKHR,
          taxRate: input.taxRate,
          isTaxInclusive: input.isTaxInclusive,
          unit: input.unit,
          alertLowStock: input.alertLowStock,
        },
      });

      if (input.initialStock > 0) {
        await tx.inventory.create({
          data: {
            storeId,
            productId: product.id,
            quantity: input.initialStock,
            minStockLevel: input.alertLowStock,
          },
        });
      }

      return product;
    });
  }
}
