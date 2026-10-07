import { prisma } from '../../config/prisma.js';
import { SessionStatus, CashMovementType } from '@prisma/client';
import { OpenSessionInput, CloseSessionInput, CashMovementInput } from './register.schema.js';
import { roundUSD, roundKHR } from '../../utils/calculator.js';

export class RegisterService {
  static async listRegisters(storeId: string) {
    const registers = await prisma.cashRegister.findMany({
      where: { storeId, isActive: true },
      include: {
        sessions: {
          where: { status: SessionStatus.OPEN },
          include: {
            cashier: { select: { id: true, fullName: true, username: true } },
          },
          take: 1,
        },
      },
    });

    return registers.map((reg) => ({
      id: reg.id,
      name: reg.name,
      code: reg.code,
      activeSession: reg.sessions[0]
        ? {
            id: reg.sessions[0].id,
            cashier: reg.sessions[0].cashier,
            openedAt: reg.sessions[0].openedAt,
            openingFloatUSD: Number(reg.sessions[0].openingFloatUSD),
            openingFloatKHR: Number(reg.sessions[0].openingFloatKHR),
            expectedCashUSD: Number(reg.sessions[0].expectedCashUSD),
            expectedCashKHR: Number(reg.sessions[0].expectedCashKHR),
            totalSalesCount: reg.sessions[0].totalSalesCount,
          }
        : null,
    }));
  }

  static async getCurrentSession(cashierId: string, storeId: string) {
    const session = await prisma.registerSession.findFirst({
      where: {
        cashierId,
        status: SessionStatus.OPEN,
        register: { storeId },
      },
      include: {
        register: true,
        cashMovements: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!session) return null;

    return {
      id: session.id,
      registerId: session.registerId,
      registerName: session.register.name,
      registerCode: session.register.code,
      openedAt: session.openedAt,
      status: session.status,
      openingFloatUSD: Number(session.openingFloatUSD),
      openingFloatKHR: Number(session.openingFloatKHR),
      expectedCashUSD: Number(session.expectedCashUSD),
      expectedCashKHR: Number(session.expectedCashKHR),
      totalSalesCount: session.totalSalesCount,
      totalSalesAmountUSD: Number(session.totalSalesAmountUSD),
      totalSalesAmountKHR: Number(session.totalSalesAmountKHR),
      cashMovements: session.cashMovements.map((cm) => ({
        id: cm.id,
        type: cm.type,
        amountUSD: Number(cm.amountUSD),
        amountKHR: Number(cm.amountKHR),
        reason: cm.reason,
        createdAt: cm.createdAt,
      })),
    };
  }

  static async openSession(cashierId: string, businessId: string, storeId: string, input: OpenSessionInput) {
    const existingOpen = await prisma.registerSession.findFirst({
      where: { registerId: input.registerId, status: SessionStatus.OPEN },
    });

    if (existingOpen) {
      throw { statusCode: 409, code: 'SESSION_ALREADY_OPEN', message: 'An active session is already open for this cash register' };
    }

    return prisma.$transaction(async (tx) => {
      const session = await tx.registerSession.create({
        data: {
          registerId: input.registerId,
          cashierId,
          status: SessionStatus.OPEN,
          openingFloatUSD: input.openingFloatUSD,
          openingFloatKHR: input.openingFloatKHR,
          expectedCashUSD: input.openingFloatUSD,
          expectedCashKHR: input.openingFloatKHR,
        },
      });

      if (input.openingFloatUSD > 0 || input.openingFloatKHR > 0) {
        await tx.cashMovement.create({
          data: {
            sessionId: session.id,
            cashierId,
            type: CashMovementType.FLOAT_ADD,
            amountUSD: input.openingFloatUSD,
            amountKHR: input.openingFloatKHR,
            reason: input.notes || 'Opening shift cash float',
          },
        });
      }

      await tx.auditLog.create({
        data: {
          businessId,
          storeId,
          userId: cashierId,
          action: 'REGISTER_SESSION_OPENED',
          entityType: 'RegisterSession',
          entityId: session.id,
          metadata: {
            registerId: input.registerId,
            openingFloatUSD: input.openingFloatUSD,
            openingFloatKHR: input.openingFloatKHR,
          },
        },
      });

      return session;
    });
  }

  static async recordCashMovement(sessionId: string, cashierId: string, businessId: string, storeId: string, input: CashMovementInput) {
    const session = await prisma.registerSession.findUnique({
      where: { id: sessionId },
    });

    if (!session || session.status !== SessionStatus.OPEN) {
      throw { statusCode: 400, code: 'SESSION_NOT_OPEN', message: 'Session is not open or does not exist' };
    }

    return prisma.$transaction(async (tx) => {
      const movement = await tx.cashMovement.create({
        data: {
          sessionId,
          cashierId,
          type: input.type,
          amountUSD: input.amountUSD,
          amountKHR: input.amountKHR,
          reason: input.reason,
          referenceNumber: input.referenceNumber,
        },
      });

      // Update expected cash
      const isPositive = input.type === CashMovementType.CASH_IN || input.type === CashMovementType.FLOAT_ADD;
      const usdDelta = isPositive ? input.amountUSD : -input.amountUSD;
      const khrDelta = isPositive ? input.amountKHR : -input.amountKHR;

      const newExpectedUSD = Math.max(0, roundUSD(Number(session.expectedCashUSD) + usdDelta));
      const newExpectedKHR = Math.max(0, roundKHR(Number(session.expectedCashKHR) + khrDelta));

      await tx.registerSession.update({
        where: { id: sessionId },
        data: {
          expectedCashUSD: newExpectedUSD,
          expectedCashKHR: newExpectedKHR,
        },
      });

      await tx.auditLog.create({
        data: {
          businessId,
          storeId,
          userId: cashierId,
          action: 'CASH_MOVEMENT',
          entityType: 'CashMovement',
          entityId: movement.id,
          metadata: { type: input.type, amountUSD: input.amountUSD, amountKHR: input.amountKHR, reason: input.reason },
        },
      });

      return movement;
    });
  }

  static async closeSession(sessionId: string, cashierId: string, businessId: string, storeId: string, input: CloseSessionInput) {
    const session = await prisma.registerSession.findUnique({
      where: { id: sessionId },
    });

    if (!session || session.status !== SessionStatus.OPEN) {
      throw { statusCode: 400, code: 'SESSION_NOT_OPEN', message: 'Session is not currently open' };
    }

    const expectedUSD = Number(session.expectedCashUSD);
    const expectedKHR = Number(session.expectedCashKHR);
    const diffUSD = roundUSD(input.actualCashUSD - expectedUSD);
    const diffKHR = roundKHR(input.actualCashKHR - expectedKHR);

    return prisma.$transaction(async (tx) => {
      const closed = await tx.registerSession.update({
        where: { id: sessionId },
        data: {
          status: SessionStatus.CLOSED,
          closedAt: new Date(),
          actualCashUSD: input.actualCashUSD,
          actualCashKHR: input.actualCashKHR,
          differenceUSD: diffUSD,
          differenceKHR: diffKHR,
          closingNotes: input.closingNotes,
        },
      });

      await tx.auditLog.create({
        data: {
          businessId,
          storeId,
          userId: cashierId,
          action: 'REGISTER_SESSION_CLOSED',
          entityType: 'RegisterSession',
          entityId: sessionId,
          metadata: {
            expectedUSD,
            expectedKHR,
            actualUSD: input.actualCashUSD,
            actualKHR: input.actualCashKHR,
            differenceUSD: diffUSD,
            differenceKHR: diffKHR,
          },
        },
      });

      return closed;
    });
  }
}
