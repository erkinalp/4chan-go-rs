import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../../services/prisma/prisma.service";
import { AppealStatus, Prisma } from "@prisma/client";
import {
  CreateReportDto,
  ResolveReportDto,
  CreateBanDto,
  AppealBanDto,
  ResolveAppealDto,
  CreateWordFilterDto,
} from "./moderation.dto";

@Injectable()
export class ModerationService {
  constructor(private readonly prisma: PrismaService) {}

  // --- Reports ---

  async createReport(dto: CreateReportDto, ip: string) {
    if (!dto.postId && !dto.threadId) {
      throw new BadRequestException("Either postId or threadId is required");
    }
    const { createHash } = await import("crypto");
    const ipHash = createHash("sha256").update(ip).digest("hex").slice(0, 16);
    return this.prisma.report.create({
      data: {
        reason: dto.reason,
        additionalInfo: dto.additionalInfo,
        ipHash,
        postId: dto.postId,
        threadId: dto.threadId,
      },
    });
  }

  async findReports(resolved?: boolean) {
    return this.prisma.report.findMany({
      where: resolved !== undefined ? { isResolved: resolved } : undefined,
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }

  async getReports(status?: string, page = 1, limit = 50) {
    const skip = (page - 1) * limit;
    const where =
      status === "resolved"
        ? { isResolved: true }
        : status === "pending"
          ? { isResolved: false }
          : undefined;
    const [reports, total] = await Promise.all([
      this.prisma.report.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      this.prisma.report.count({ where }),
    ]);
    return { reports, total, page, limit };
  }

  async resolveReport(id: string, dto: ResolveReportDto, userId: string) {
    const report = await this.prisma.report.findUnique({ where: { id } });
    if (!report) throw new NotFoundException("Report not found");
    return this.prisma.report.update({
      where: { id },
      data: {
        isResolved: dto.isResolved,
        resolvedBy: userId,
        resolvedAt: dto.isResolved ? new Date() : null,
      },
    });
  }

  // --- Bans ---

  async createBan(dto: CreateBanDto, createdBy: string) {
    return this.prisma.ban.create({
      data: {
        ipHash: dto.ipHash,
        reason: dto.reason,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        boardId: dto.boardId,
        createdBy,
      },
    });
  }

  async findBans(active?: boolean) {
    const where: { isActive?: boolean } = {};
    if (active !== undefined) {
      where.isActive = active;
    }
    return this.prisma.ban.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }

  async unbanUser(id: string) {
    return this.revokeBan(id);
  }

  async revokeBan(id: string) {
    const ban = await this.prisma.ban.findUnique({ where: { id } });
    if (!ban) throw new NotFoundException("Ban not found");
    return this.prisma.ban.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async checkBan(ipHash: string, boardId?: string) {
    const ban = await this.prisma.ban.findFirst({
      where: {
        ipHash,
        isActive: true,
        AND: [
          { OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
          boardId
            ? { OR: [{ boardId: null }, { boardId }] }
            : { boardId: null },
        ],
      },
    });
    return { banned: !!ban, ban };
  }

  async appealBan(id: string, dto: AppealBanDto) {
    const ban = await this.prisma.ban.findUnique({ where: { id } });
    if (!ban) throw new NotFoundException("Ban not found");
    if (ban.appealStatus !== AppealStatus.NONE) {
      throw new BadRequestException("Appeal already submitted");
    }
    return this.prisma.ban.update({
      where: { id },
      data: {
        appealReason: dto.appealReason,
        appealStatus: AppealStatus.PENDING,
      },
    });
  }

  async resolveAppeal(id: string, dto: ResolveAppealDto) {
    const ban = await this.prisma.ban.findUnique({ where: { id } });
    if (!ban) throw new NotFoundException("Ban not found");
    const data: { appealStatus: typeof dto.appealStatus; isActive?: boolean } =
      {
        appealStatus: dto.appealStatus,
      };
    if (dto.appealStatus === AppealStatus.APPROVED) {
      data.isActive = false;
    }
    return this.prisma.ban.update({ where: { id }, data });
  }

  async getModLog(page = 1) {
    return this.getAuditLog(page, 50);
  }

  // --- Word Filters ---

  async createWordFilter(dto: CreateWordFilterDto) {
    return this.prisma.wordFilter.create({ data: dto });
  }

  async findWordFilters(boardId?: string) {
    return this.prisma.wordFilter.findMany({
      where: {
        isActive: true,
        ...(boardId ? { OR: [{ boardId: null }, { boardId }] } : {}),
      },
    });
  }

  async removeWordFilter(id: string) {
    const filter = await this.prisma.wordFilter.findUnique({ where: { id } });
    if (!filter) throw new NotFoundException("Word filter not found");
    return this.prisma.wordFilter.delete({ where: { id } });
  }

  // --- Audit Log ---

  async logAction(
    action: string,
    entityType: string,
    entityId: string,
    userId: string,
    details?: Prisma.InputJsonValue,
    ipAddress?: string,
  ) {
    return this.prisma.auditLog.create({
      data: { action, entityType, entityId, userId, details, ipAddress },
    });
  }

  async getAuditLog(page = 1, limit = 50) {
    const skip = (page - 1) * limit;
    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        include: { user: { select: { id: true, username: true, role: true } } },
      }),
      this.prisma.auditLog.count(),
    ]);
    return { logs, total, page, limit };
  }
}
