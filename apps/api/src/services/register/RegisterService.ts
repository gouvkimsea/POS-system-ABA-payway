import { prisma } from '../../db/index.js';
import { Prisma, SessionStatus, CashMovementType, OrderStatus } from '@prisma/client';
import {
  RegisterSessionSummary,
  CashMovementRecord,
  OpenRegisterInput,
  CashMovementInput,
  CloseRegisterInput,
  RegisterReportFilters,
  RegisterReportSummary,
} from '@pos/types';
import { logger } from '../../logger/index.js';

export class RegisterServiceError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 400,
  ) {
    super(message);
    this.name = 'RegisterServiceError';
  }
}

export class RegisterService {
  /**
   * Open a new register session for a cashier
   */
  public static async openSession(
    businessId: string,
    storeId: string,
    userId: string,
    input: OpenRegisterInput,
  ): Promise<RegisterSessionSummary> {
    // 1. Verify register exists and belongs to the store
    const register = await prisma.cashRegister.findFirst({
      where: { id: input.registerId, storeId, isActive: true },
      include: { store: true },
    });

    if (!register) {
      throw new RegisterServiceError(
        'REGISTER_NOT_FOUND',
        `Cash register with ID "${input.registerId}" was not found or is inactive.`,
        404,
      );
    }

    // 2. Prevent invalid state: Register must not already have an OPEN session
    const existingOpenSession = await prisma.registerSession.findFirst({
      where: { registerId: register.id, status: SessionStatus.OPEN },
    });

    if (existingOpenSession) {
      throw new RegisterServiceError(
        'REGISTER_ALREADY_OPEN',
        `Cash register "${register.name}" (${register.code}) already has an active open session (ID: ${existingOpenSession.id}). Please close it before opening a new one.`,
        409,
      );
    }

    const openingFloatUSD = Number(input.openingFloatUSD || 0);
    const openingFloatKHR = Number(input.openingFloatKHR || 0);

    // 3. Atomically open session, record initial cash movement, and create audit log
    const session = await prisma.$transaction(async (tx: any) => {
      const newSession = await tx.registerSession.create({
        data: {
          registerId: register.id,
          cashierId: userId,
          status: SessionStatus.OPEN,
          openedAt: new Date(),
          openingFloatUSD: new Prisma.Decimal(openingFloatUSD),
          openingFloatKHR: new Prisma.Decimal(openingFloatKHR),
          expectedCashUSD: new Prisma.Decimal(openingFloatUSD),
          expectedCashKHR: new Prisma.Decimal(openingFloatKHR),
          closingNotes: input.notes || null,
        },
        include: {
          register: { include: { store: true } },
          cashier: true,
        },
      });

      // Record immutable audit record
      await tx.auditLog.create({
        data: {
          businessId,
          storeId,
          userId,
          action: 'REGISTER_OPENED',
          entityType: 'RegisterSession',
          entityId: newSession.id,
          details: {
            sessionId: newSession.id,
            registerId: register.id,
            registerCode: register.code,
            storeId,
            openingFloatUSD,
            openingFloatKHR,
            notes: input.notes || null,
          },
        },
      });

      return newSession;
    });

    logger.info(
      `[RegisterService] Session opened: ${session.id} on register ${register.code} by user ${userId}`,
    );

    return this.mapSessionSummary(session, {
      cashSalesUSD: 0,
      cashSalesKHR: 0,
      cashRefundsUSD: 0,
      cashRefundsKHR: 0,
      cashInUSD: 0,
      cashInKHR: 0,
      cashOutUSD: 0,
      cashOutKHR: 0,
      expensesUSD: 0,
      expensesKHR: 0,
      expectedCashUSD: openingFloatUSD,
      expectedCashKHR: openingFloatKHR,
    });
  }

  /**
   * Retrieve the current active OPEN session for a register / store
   */
  public static async getCurrentSession(
    storeId: string,
    registerId?: string,
  ): Promise<{ session: RegisterSessionSummary; movements: CashMovementRecord[] } | null> {
    const session = await prisma.registerSession.findFirst({
      where: {
        status: SessionStatus.OPEN,
        register: {
          storeId,
          ...(registerId ? { id: registerId } : { isActive: true }),
        },
      },
      include: {
        register: { include: { store: true } },
        cashier: true,
        cashMovements: {
          include: { cashier: true },
          orderBy: { createdAt: 'desc' },
        },
        orders: {
          where: {
            status: { in: [OrderStatus.PAID, OrderStatus.COMPLETED, OrderStatus.PARTIALLY_PAID] },
          },
          include: {
            payments: {
              where: { status: 'COMPLETED' },
              include: { paymentMethod: true },
            },
          },
        },
      },
      orderBy: { openedAt: 'desc' },
    });

    if (!session) {
      return null;
    }

    // Compute live real-time breakdown
    const liveCalculations = this.calculateSessionFinancials(session);

    const mappedMovements: CashMovementRecord[] = session.cashMovements.map((m) => ({
      id: m.id,
      sessionId: m.sessionId,
      type: m.type as any,
      amountUSD: Number(m.amountUSD),
      amountKHR: Number(m.amountKHR),
      reason: m.reason,
      referenceNumber: m.referenceNumber,
      createdAt: m.createdAt.toISOString(),
      cashierId: m.cashierId,
      cashierName: m.cashier?.fullName || m.cashier?.username || 'Cashier',
      registerId: session.register.id,
      registerCode: session.register.code,
      storeId: session.register.storeId,
      storeName: session.register.store.name,
    }));

    return {
      session: this.mapSessionSummary(session, liveCalculations),
      movements: mappedMovements,
    };
  }

  /**
   * Record a mid-shift cash movement: Cash In, Cash Out, Float Add, Pay Out, or Expense
   */
  public static async recordCashMovement(
    businessId: string,
    storeId: string,
    userId: string,
    input: CashMovementInput,
  ): Promise<{ movement: CashMovementRecord; session: RegisterSessionSummary }> {
    // 1. Resolve active session
    let sessionId = input.sessionId;
    if (!sessionId && input.registerId) {
      const active = await prisma.registerSession.findFirst({
        where: { registerId: input.registerId, status: SessionStatus.OPEN },
      });
      if (active) sessionId = active.id;
    }

    if (!sessionId) {
      throw new RegisterServiceError(
        'SESSION_REQUIRED',
        'An active register session ID is required to record cash movements.',
        400,
      );
    }

    const session = await prisma.registerSession.findUnique({
      where: { id: sessionId },
      include: {
        register: { include: { store: true } },
        cashier: true,
        cashMovements: { include: { cashier: true } },
        orders: {
          where: {
            status: { in: [OrderStatus.PAID, OrderStatus.COMPLETED, OrderStatus.PARTIALLY_PAID] },
          },
          include: { payments: { include: { paymentMethod: true } } },
        },
      },
    });

    if (!session) {
      throw new RegisterServiceError('SESSION_NOT_FOUND', 'Register session not found.', 404);
    }

    // 2. Prevent invalid state: Session must be OPEN
    if (session.status !== SessionStatus.OPEN) {
      throw new RegisterServiceError(
        'INVALID_REGISTER_STATE',
        `Cannot perform cash movement on a ${session.status} session. Register must be OPEN.`,
        409,
      );
    }

    const amountUSD = Number(input.amountUSD || 0);
    const amountKHR = Number(input.amountKHR || 0);

    if (amountUSD <= 0 && amountKHR <= 0) {
      throw new RegisterServiceError(
        'INVALID_AMOUNT',
        'Cash movement amount must be greater than zero.',
        400,
      );
    }

    // 3. Atomically record movement, update expected cash, log expense if applicable, and write audit log
    const { createdMovement, updatedSession } = await prisma.$transaction(async (tx: any) => {
      // Create CashMovement record
      const movement = await tx.cashMovement.create({
        data: {
          sessionId: session.id,
          cashierId: userId,
          type: input.type as any,
          amountUSD: new Prisma.Decimal(amountUSD),
          amountKHR: new Prisma.Decimal(amountKHR),
          reason: input.reason.trim(),
          referenceNumber: input.referenceNumber?.trim() || null,
        },
        include: { cashier: true },
      });

      // If EXPENSE, create Store Expense record
      if (input.type === 'EXPENSE') {
        await tx.expense.create({
          data: {
            businessId,
            storeId,
            recordedById: userId,
            category: input.category || 'Store Operations',
            amountUSD: new Prisma.Decimal(amountUSD),
            amountKHR: new Prisma.Decimal(amountKHR),
            description: `[Register #${session.register.code}] ${input.reason}`,
          },
        });
      }

      // Compute current live financials including the new movement
      const tempSession = {
        ...session,
        cashMovements: [...session.cashMovements, movement],
      };
      const financials = this.calculateSessionFinancials(tempSession);

      // Update expected cash on session record
      const refreshedSession = await tx.registerSession.update({
        where: { id: session.id },
        data: {
          expectedCashUSD: new Prisma.Decimal(financials.expectedCashUSD),
          expectedCashKHR: new Prisma.Decimal(financials.expectedCashKHR),
        },
        include: {
          register: { include: { store: true } },
          cashier: true,
        },
      });

      // Write immutable audit log
      const auditLog = await tx.auditLog.create({
        data: {
          businessId,
          storeId,
          userId,
          action: input.type,
          entityType: 'CashMovement',
          entityId: movement.id,
          details: {
            movementId: movement.id,
            sessionId: session.id,
            registerId: session.register.id,
            registerCode: session.register.code,
            storeId,
            storeName: session.register.store.name,
            type: input.type,
            amountUSD,
            amountKHR,
            reason: input.reason,
            referenceNumber: input.referenceNumber || null,
            expectedCashAfterUSD: financials.expectedCashUSD,
            expectedCashAfterKHR: financials.expectedCashKHR,
          },
        },
      });

      return {
        createdMovement: { ...movement, auditLogId: auditLog.id },
        updatedSession: refreshedSession,
      };
    });

    const liveFinancials = this.calculateSessionFinancials({
      ...session,
      cashMovements: [...session.cashMovements, createdMovement],
    });

    return {
      movement: {
        id: createdMovement.id,
        sessionId: createdMovement.sessionId,
        type: createdMovement.type as any,
        amountUSD: Number(createdMovement.amountUSD),
        amountKHR: Number(createdMovement.amountKHR),
        reason: createdMovement.reason,
        referenceNumber: createdMovement.referenceNumber,
        createdAt: createdMovement.createdAt.toISOString(),
        cashierId: createdMovement.cashierId,
        cashierName:
          createdMovement.cashier?.fullName || createdMovement.cashier?.username || 'User',
        registerId: session.register.id,
        registerCode: session.register.code,
        storeId: session.register.storeId,
        storeName: session.register.store.name,
        auditLogId: createdMovement.auditLogId,
      },
      session: this.mapSessionSummary(updatedSession, liveFinancials),
    };
  }

  /**
   * Close a register session with physical cash count reconciliation
   */
  public static async closeSession(
    businessId: string,
    storeId: string,
    userId: string,
    input: CloseRegisterInput,
  ): Promise<RegisterSessionSummary> {
    const session = await prisma.registerSession.findUnique({
      where: { id: input.sessionId },
      include: {
        register: { include: { store: true } },
        cashier: true,
        cashMovements: { include: { cashier: true } },
        orders: {
          where: {
            status: { in: [OrderStatus.PAID, OrderStatus.COMPLETED, OrderStatus.PARTIALLY_PAID] },
          },
          include: { payments: { include: { paymentMethod: true } } },
        },
      },
    });

    if (!session) {
      throw new RegisterServiceError('SESSION_NOT_FOUND', 'Register session not found.', 404);
    }

    // Prevent invalid state: Cannot close an already closed session
    if (session.status === SessionStatus.CLOSED) {
      throw new RegisterServiceError(
        'SESSION_ALREADY_CLOSED',
        `Register session is already closed (Closed at: ${session.closedAt?.toISOString()}).`,
        409,
      );
    }

    // Compute final expected cash
    const financials = this.calculateSessionFinancials(session);
    const actualCashUSD = Number(input.actualCashUSD || 0);
    const actualCashKHR = Number(input.actualCashKHR || 0);

    const differenceUSD = Number((actualCashUSD - financials.expectedCashUSD).toFixed(2));
    const differenceKHR = Math.round(actualCashKHR - financials.expectedCashKHR);

    // Atomically close session and write audit log
    const closedSession = await prisma.$transaction(async (tx: any) => {
      const closed = await tx.registerSession.update({
        where: { id: session.id },
        data: {
          status: SessionStatus.CLOSED,
          closedAt: new Date(),
          closedById: userId,
          expectedCashUSD: new Prisma.Decimal(financials.expectedCashUSD),
          expectedCashKHR: new Prisma.Decimal(financials.expectedCashKHR),
          actualCashUSD: new Prisma.Decimal(actualCashUSD),
          actualCashKHR: new Prisma.Decimal(actualCashKHR),
          differenceUSD: new Prisma.Decimal(differenceUSD),
          differenceKHR: new Prisma.Decimal(differenceKHR),
          totalSalesCount: financials.totalSalesCount,
          totalSalesUSD: new Prisma.Decimal(financials.totalSalesUSD),
          totalSalesKHR: new Prisma.Decimal(financials.totalSalesKHR),
          closingNotes: input.closingNotes?.trim() || null,
          denominationBreakdown: input.denominationBreakdown || null,
        },
        include: {
          register: { include: { store: true } },
          cashier: true,
        },
      });

      // Immutable closing audit log
      await tx.auditLog.create({
        data: {
          businessId,
          storeId,
          userId,
          action: 'REGISTER_CLOSED',
          entityType: 'RegisterSession',
          entityId: session.id,
          details: {
            sessionId: session.id,
            registerId: session.register.id,
            registerCode: session.register.code,
            storeId,
            openedAt: session.openedAt.toISOString(),
            closedAt: closed.closedAt?.toISOString(),
            expectedCashUSD: financials.expectedCashUSD,
            expectedCashKHR: financials.expectedCashKHR,
            actualCashUSD,
            actualCashKHR,
            differenceUSD,
            differenceKHR,
            totalSalesCount: financials.totalSalesCount,
            totalSalesUSD: financials.totalSalesUSD,
            closingNotes: input.closingNotes || null,
          },
        },
      });

      return closed;
    });

    logger.info(
      `[RegisterService] Session closed: ${session.id} on ${session.register.code}. Diff: $${differenceUSD} USD / ${differenceKHR} KHR`,
    );

    return this.mapSessionSummary(closedSession, {
      ...financials,
      actualCashUSD,
      actualCashKHR,
      differenceUSD,
      differenceKHR,
    });
  }

  /**
   * Manager / Admin Register Session Reporting
   */
  public static async getSessionReport(
    businessId: string,
    filters: RegisterReportFilters = {},
  ): Promise<{ summary: RegisterReportSummary; sessions: RegisterSessionSummary[] }> {
    const whereClause: Prisma.RegisterSessionWhereInput = {
      register: {
        store: {
          businessId,
          ...(filters.storeId ? { id: filters.storeId } : {}),
        },
        ...(filters.registerId ? { id: filters.registerId } : {}),
      },
      ...(filters.cashierId ? { cashierId: filters.cashierId } : {}),
      ...(filters.status ? { status: filters.status as any } : {}),
      ...(filters.startDate || filters.endDate
        ? {
            openedAt: {
              ...(filters.startDate ? { gte: new Date(filters.startDate) } : {}),
              ...(filters.endDate ? { lte: new Date(filters.endDate) } : {}),
            },
          }
        : {}),
    };

    const sessions = await prisma.registerSession.findMany({
      where: whereClause,
      include: {
        register: { include: { store: true } },
        cashier: true,
        cashMovements: { include: { cashier: true } },
        orders: {
          where: {
            status: { in: [OrderStatus.PAID, OrderStatus.COMPLETED, OrderStatus.PARTIALLY_PAID] },
          },
          include: { payments: { include: { paymentMethod: true } } },
        },
      },
      orderBy: { openedAt: 'desc' },
      take: 150,
    });

    let totalSalesCount = 0;
    let totalSalesUSD = 0;
    let totalCashSalesUSD = 0;
    let totalCashInUSD = 0;
    let totalCashOutUSD = 0;
    let totalExpensesUSD = 0;
    let totalExpectedCashUSD = 0;
    let totalActualCashUSD = 0;
    let totalDifferenceUSD = 0;
    let openCount = 0;
    let closedCount = 0;

    const mappedSessions: RegisterSessionSummary[] = sessions.map((s) => {
      const financials = this.calculateSessionFinancials(s);

      totalSalesCount += financials.totalSalesCount;
      totalSalesUSD += financials.totalSalesUSD;
      totalCashSalesUSD += financials.cashSalesUSD;
      totalCashInUSD += financials.cashInUSD;
      totalCashOutUSD += financials.cashOutUSD;
      totalExpensesUSD += financials.expensesUSD;
      totalExpectedCashUSD += financials.expectedCashUSD;

      if (s.status === SessionStatus.CLOSED) {
        closedCount++;
        const act = s.actualCashUSD !== null ? Number(s.actualCashUSD) : financials.expectedCashUSD;
        const diff = s.differenceUSD !== null ? Number(s.differenceUSD) : 0;
        totalActualCashUSD += act;
        totalDifferenceUSD += diff;
      } else {
        openCount++;
      }

      return this.mapSessionSummary(s, financials);
    });

    const summary: RegisterReportSummary = {
      totalSessions: sessions.length,
      openSessions: openCount,
      closedSessions: closedCount,
      totalSalesCount,
      totalSalesUSD: Number(totalSalesUSD.toFixed(2)),
      totalCashSalesUSD: Number(totalCashSalesUSD.toFixed(2)),
      totalCashInUSD: Number(totalCashInUSD.toFixed(2)),
      totalCashOutUSD: Number(totalCashOutUSD.toFixed(2)),
      totalExpensesUSD: Number(totalExpensesUSD.toFixed(2)),
      totalExpectedCashUSD: Number(totalExpectedCashUSD.toFixed(2)),
      totalActualCashUSD: Number(totalActualCashUSD.toFixed(2)),
      totalDifferenceUSD: Number(totalDifferenceUSD.toFixed(2)),
    };

    return { summary, sessions: mappedSessions };
  }

  /**
   * Retrieve full details of a specific session (including all cash movements & audit log)
   */
  public static async getSessionDetails(
    businessId: string,
    sessionId: string,
  ): Promise<{
    session: RegisterSessionSummary;
    movements: CashMovementRecord[];
    auditLogs: any[];
  }> {
    const session = await prisma.registerSession.findFirst({
      where: { id: sessionId, register: { store: { businessId } } },
      include: {
        register: { include: { store: true } },
        cashier: true,
        cashMovements: {
          include: { cashier: true },
          orderBy: { createdAt: 'desc' },
        },
        orders: {
          where: {
            status: { in: [OrderStatus.PAID, OrderStatus.COMPLETED, OrderStatus.PARTIALLY_PAID] },
          },
          include: { payments: { include: { paymentMethod: true } } },
        },
      },
    });

    if (!session) {
      throw new RegisterServiceError('SESSION_NOT_FOUND', 'Register session not found', 404);
    }

    const financials = this.calculateSessionFinancials(session);
    const mappedSession = this.mapSessionSummary(session, financials);

    const movements: CashMovementRecord[] = session.cashMovements.map((m) => ({
      id: m.id,
      sessionId: m.sessionId,
      type: m.type as any,
      amountUSD: Number(m.amountUSD),
      amountKHR: Number(m.amountKHR),
      reason: m.reason,
      referenceNumber: m.referenceNumber,
      createdAt: m.createdAt.toISOString(),
      cashierId: m.cashierId,
      cashierName: m.cashier?.fullName || m.cashier?.username || 'Cashier',
      registerId: session.register.id,
      registerCode: session.register.code,
      storeId: session.register.storeId,
      storeName: session.register.store.name,
    }));

    const auditLogs = await prisma.auditLog.findMany({
      where: {
        entityType: { in: ['RegisterSession', 'CashMovement'] },
        OR: [{ entityId: sessionId }, { details: { path: ['sessionId'], equals: sessionId } }],
      },
      include: { user: true },
      orderBy: { createdAt: 'asc' },
    });

    return {
      session: mappedSession,
      movements,
      auditLogs: auditLogs.map((a) => ({
        id: a.id,
        action: a.action,
        entityType: a.entityType,
        entityId: a.entityId,
        userName: a.user?.fullName || a.user?.username || 'System',
        createdAt: a.createdAt.toISOString(),
        details: a.details,
      })),
    };
  }

  // --------------------------------------------------------------------------
  // FINANCIAL CALCULATION HELPERS
  // --------------------------------------------------------------------------

  private static calculateSessionFinancials(session: any) {
    const openingFloatUSD = Number(session.openingFloatUSD || 0);
    const openingFloatKHR = Number(session.openingFloatKHR || 0);

    let cashSalesUSD = 0;
    let cashSalesKHR = 0;
    const cashRefundsUSD = 0;
    const cashRefundsKHR = 0;
    let totalSalesUSD = 0;
    let totalSalesKHR = 0;
    const totalSalesCount = session.orders ? session.orders.length : 0;

    if (session.orders) {
      for (const order of session.orders) {
        totalSalesUSD += Number(order.totalUSD || 0);
        totalSalesKHR += Number(order.totalKHR || 0);

        if (order.payments) {
          for (const payment of order.payments) {
            const isCash =
              payment.paymentMethod?.type === 'CASH' || payment.paymentMethod?.code === 'CASH';

            if (isCash) {
              const netPaidUSD = Number(payment.amountUSD || 0);
              const netPaidKHR = Number(payment.amountKHR || 0);
              cashSalesUSD += Math.max(0, netPaidUSD);
              cashSalesKHR += Math.max(0, netPaidKHR);
            }
          }
        }
      }
    }

    let cashInUSD = 0;
    let cashInKHR = 0;
    let cashOutUSD = 0;
    let cashOutKHR = 0;
    let expensesUSD = 0;
    let expensesKHR = 0;

    if (session.cashMovements) {
      for (const m of session.cashMovements) {
        const u = Number(m.amountUSD || 0);
        const k = Number(m.amountKHR || 0);

        if (m.type === CashMovementType.CASH_IN) {
          cashInUSD += u;
          cashInKHR += k;
        } else if (m.type === CashMovementType.CASH_OUT || m.type === CashMovementType.PAY_OUT) {
          cashOutUSD += u;
          cashOutKHR += k;
        } else if (m.type === CashMovementType.EXPENSE) {
          expensesUSD += u;
          expensesKHR += k;
        }
      }
    }

    // Expected Cash Formula:
    // Opening Float + Cash Sales - Refunds + Cash In - Cash Out - Expenses
    const expectedCashUSD = Number(
      (
        openingFloatUSD +
        cashSalesUSD -
        cashRefundsUSD +
        cashInUSD -
        cashOutUSD -
        expensesUSD
      ).toFixed(2),
    );

    const expectedCashKHR = Math.round(
      openingFloatKHR + cashSalesKHR - cashRefundsKHR + cashInKHR - cashOutKHR - expensesKHR,
    );

    return {
      openingFloatUSD,
      openingFloatKHR,
      cashSalesUSD: Number(cashSalesUSD.toFixed(2)),
      cashSalesKHR: Math.round(cashSalesKHR),
      cashRefundsUSD: Number(cashRefundsUSD.toFixed(2)),
      cashRefundsKHR: Math.round(cashRefundsKHR),
      cashInUSD: Number(cashInUSD.toFixed(2)),
      cashInKHR: Math.round(cashInKHR),
      cashOutUSD: Number(cashOutUSD.toFixed(2)),
      cashOutKHR: Math.round(cashOutKHR),
      expensesUSD: Number(expensesUSD.toFixed(2)),
      expensesKHR: Math.round(expensesKHR),
      expectedCashUSD,
      expectedCashKHR,
      totalSalesCount,
      totalSalesUSD: Number(totalSalesUSD.toFixed(2)),
      totalSalesKHR: Math.round(totalSalesKHR),
    };
  }

  private static mapSessionSummary(session: any, financials: any): RegisterSessionSummary {
    return {
      id: session.id,
      registerId: session.register?.id || session.registerId,
      registerName: session.register?.name || 'Cash Register',
      registerCode: session.register?.code || 'REG-01',
      storeId: session.register?.store?.id || session.register?.storeId,
      storeName: session.register?.store?.name || 'Store',
      cashierId: session.cashier?.id || session.cashierId,
      cashierName: session.cashier?.fullName || session.cashier?.username || 'Cashier',
      openedAt: session.openedAt.toISOString(),
      closedAt: session.closedAt ? session.closedAt.toISOString() : null,
      status: session.status as any,
      openingFloatUSD: financials.openingFloatUSD ?? Number(session.openingFloatUSD || 0),
      openingFloatKHR: financials.openingFloatKHR ?? Number(session.openingFloatKHR || 0),
      cashSalesUSD: financials.cashSalesUSD ?? 0,
      cashSalesKHR: financials.cashSalesKHR ?? 0,
      cashRefundsUSD: financials.cashRefundsUSD ?? 0,
      cashRefundsKHR: financials.cashRefundsKHR ?? 0,
      cashInUSD: financials.cashInUSD ?? 0,
      cashInKHR: financials.cashInKHR ?? 0,
      cashOutUSD: financials.cashOutUSD ?? 0,
      cashOutKHR: financials.cashOutKHR ?? 0,
      expensesUSD: financials.expensesUSD ?? 0,
      expensesKHR: financials.expensesKHR ?? 0,
      expectedCashUSD: financials.expectedCashUSD ?? Number(session.expectedCashUSD || 0),
      expectedCashKHR: financials.expectedCashKHR ?? Number(session.expectedCashKHR || 0),
      actualCashUSD:
        session.actualCashUSD !== null && session.actualCashUSD !== undefined
          ? Number(session.actualCashUSD)
          : (financials.actualCashUSD ?? null),
      actualCashKHR:
        session.actualCashKHR !== null && session.actualCashKHR !== undefined
          ? Number(session.actualCashKHR)
          : (financials.actualCashKHR ?? null),
      differenceUSD:
        session.differenceUSD !== null && session.differenceUSD !== undefined
          ? Number(session.differenceUSD)
          : (financials.differenceUSD ?? null),
      differenceKHR:
        session.differenceKHR !== null && session.differenceKHR !== undefined
          ? Number(session.differenceKHR)
          : (financials.differenceKHR ?? null),
      totalSalesCount: financials.totalSalesCount ?? session.totalSalesCount,
      totalSalesUSD: financials.totalSalesUSD ?? Number(session.totalSalesUSD || 0),
      totalSalesKHR: financials.totalSalesKHR ?? Number(session.totalSalesKHR || 0),
      closingNotes: session.closingNotes,
      denominationBreakdown: session.denominationBreakdown,
      closedById: session.closedById || null,
      closedByName: null,
    };
  }
}
