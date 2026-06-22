import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../../services/prisma/prisma.service";
import { CreatePostDto } from "./posts.dto";
import { createHash } from "crypto";

@Injectable()
export class PostsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(threadId: string, dto: CreatePostDto, ip: string) {
    const thread = await this.prisma.thread.findUnique({
      where: { id: threadId },
      include: { board: true },
    });
    if (!thread) throw new NotFoundException("Thread not found");
    if (thread.isLocked) throw new BadRequestException("Thread is locked");

    const ipHash = createHash("sha256").update(ip).digest("hex").slice(0, 16);
    const nextPostNumber = await this.getNextPostNumber(thread.boardId);

    const post = await this.prisma.post.create({
      data: {
        threadId,
        postNumber: nextPostNumber,
        name: dto.name ?? "Anonymous",
        message: dto.message,
        isSpoilered: dto.isSpoilered ?? false,
        ipHash,
      },
      include: { files: true },
    });

    const postCount = await this.prisma.post.count({ where: { threadId } });
    if (postCount <= thread.board.bumpLimit) {
      await this.prisma.thread.update({
        where: { id: threadId },
        data: { bumpedAt: new Date() },
      });
    }

    return post;
  }

  async findOne(id: string) {
    const post = await this.prisma.post.findUnique({
      where: { id },
      include: { files: true },
    });
    if (!post) throw new NotFoundException("Post not found");
    return post;
  }

  async softDelete(id: string) {
    await this.findOne(id);
    return this.prisma.post.update({
      where: { id },
      data: { isDeleted: true },
    });
  }

  async deleteFileOnly(id: string) {
    await this.findOne(id);
    await this.prisma.file.deleteMany({ where: { postId: id } });
    return { message: "Files removed" };
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
