import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../../services/prisma/prisma.service";
import { CreateThreadDto, UpdateThreadDto } from "./threads.dto";
import { createHash } from "crypto";

@Injectable()
export class ThreadsService {
  constructor(private readonly prisma: PrismaService) {}

  async findByBoard(boardId: string, page = 1, limit = 20) {
    const board = await this.prisma.board.findUnique({
      where: { id: boardId },
    });
    if (!board) throw new NotFoundException(`Board /${boardId}/ not found`);

    const skip = (page - 1) * limit;
    const [threads, total] = await Promise.all([
      this.prisma.thread.findMany({
        where: { boardId },
        include: {
          posts: {
            orderBy: { createdAt: "asc" },
            take: 1,
            include: { files: true },
          },
          _count: { select: { posts: true } },
        },
        orderBy: [{ isSticky: "desc" }, { bumpedAt: "desc" }],
        skip,
        take: limit,
      }),
      this.prisma.thread.count({ where: { boardId } }),
    ]);

    return { threads, total, page, limit };
  }

  async catalog(boardId: string) {
    const board = await this.prisma.board.findUnique({
      where: { id: boardId },
    });
    if (!board) throw new NotFoundException(`Board /${boardId}/ not found`);

    return this.prisma.thread.findMany({
      where: { boardId },
      include: {
        posts: {
          orderBy: { createdAt: "asc" },
          take: 1,
          include: { files: true },
        },
        _count: { select: { posts: true } },
      },
      orderBy: [{ isSticky: "desc" }, { bumpedAt: "desc" }],
    });
  }

  async findOne(id: string) {
    const thread = await this.prisma.thread.findUnique({
      where: { id },
      include: {
        posts: {
          where: { isDeleted: false },
          orderBy: { createdAt: "asc" },
          include: { files: true },
        },
        board: true,
      },
    });
    if (!thread) throw new NotFoundException("Thread not found");
    return thread;
  }

  async create(dto: CreateThreadDto, ip: string) {
    const board = await this.prisma.board.findUnique({
      where: { id: dto.boardId },
    });
    if (!board) throw new NotFoundException(`Board /${dto.boardId}/ not found`);
    if (board.isArchived) throw new BadRequestException("Board is archived");

    const ipHash = createHash("sha256").update(ip).digest("hex").slice(0, 16);

    const nextPostNumber = await this.getNextPostNumber(dto.boardId);

    return this.prisma.thread.create({
      data: {
        boardId: dto.boardId,
        subject: dto.subject,
        ipHash,
        posts: {
          create: {
            postNumber: nextPostNumber,
            name: dto.name ?? "Anonymous",
            message: dto.message,
            ipHash,
          },
        },
      },
      include: { posts: true },
    });
  }

  async update(id: string, dto: UpdateThreadDto) {
    await this.findOne(id);
    return this.prisma.thread.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.thread.delete({ where: { id } });
  }

  private async getNextPostNumber(boardId: string): Promise<number> {
    const lastPost = await this.prisma.post.findFirst({
      where: { thread: { boardId } },
      orderBy: { postNumber: "desc" },
      select: { postNumber: true },
    });
    return (lastPost?.postNumber ?? 0) + 1;
  }
}
