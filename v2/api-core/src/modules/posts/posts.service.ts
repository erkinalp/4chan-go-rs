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

    const { displayName, tripcode } = this.parseNameField(
      dto.name ?? "Anonymous",
    );
    const isSage = this.detectSage(dto.message);
    const formattedMessage = this.formatMessage(dto.message);

    const post = await this.prisma.post.create({
      data: {
        threadId,
        postNumber: nextPostNumber,
        name: displayName,
        tripcode,
        message: formattedMessage,
        isSpoilered: dto.isSpoilered ?? false,
        ipHash,
      },
      include: { files: true },
    });

    if (!isSage) {
      const postCount = await this.prisma.post.count({ where: { threadId } });
      if (postCount <= thread.board.bumpLimit) {
        await this.prisma.thread.update({
          where: { id: threadId },
          data: { bumpedAt: new Date() },
        });
      }
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

  async getPostsByThread(threadId: string, page = 1, limit = 100) {
    const skip = (page - 1) * limit;
    const [posts, total] = await Promise.all([
      this.prisma.post.findMany({
        where: { threadId, isDeleted: false },
        orderBy: { createdAt: "asc" },
        include: { files: true },
        skip,
        take: limit,
      }),
      this.prisma.post.count({ where: { threadId, isDeleted: false } }),
    ]);
    return { posts, total, page, limit };
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

  private parseNameField(name: string): {
    displayName: string;
    tripcode: string | null;
  } {
    const hashIndex = name.indexOf("#");
    if (hashIndex === -1) {
      return { displayName: name || "Anonymous", tripcode: null };
    }
    const displayName = name.slice(0, hashIndex) || "Anonymous";
    const tripPart = name.slice(hashIndex + 1);
    if (!tripPart) {
      return { displayName, tripcode: null };
    }
    const tripHash = createHash("sha256")
      .update(tripPart)
      .digest("base64")
      .slice(0, 10);
    return { displayName, tripcode: `!${tripHash}` };
  }

  private detectSage(message: string): boolean {
    return message.toLowerCase().includes("sage");
  }

  private formatMessage(message: string): string {
    return message
      .split("\n")
      .map((line) => {
        if (line.startsWith(">") && !line.startsWith(">>")) {
          return `<span class="greentext">${line}</span>`;
        }
        return line;
      })
      .join("\n");
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
