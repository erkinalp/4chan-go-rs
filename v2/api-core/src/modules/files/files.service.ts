import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../../services/prisma/prisma.service";
import { FileMetadataDto } from "./files.dto";

const BANNED_HASHES: Set<string> = new Set();

@Injectable()
export class FilesService {
  constructor(private readonly prisma: PrismaService) {}

  async createMetadata(dto: FileMetadataDto) {
    if (BANNED_HASHES.has(dto.md5Hash)) {
      throw new BadRequestException("This file has been banned");
    }

    const duplicate = await this.prisma.file.findFirst({
      where: { md5Hash: dto.md5Hash },
    });

    return this.prisma.file.create({
      data: {
        filename: dto.filename,
        storedFilename: duplicate?.storedFilename ?? dto.storedFilename,
        filesize: dto.filesize,
        width: dto.width,
        height: dto.height,
        thumbnailFilename:
          duplicate?.thumbnailFilename ?? dto.thumbnailFilename,
        mimeType: dto.mimeType,
        md5Hash: dto.md5Hash,
        sha256Hash: dto.sha256Hash,
        isSpoilered: dto.isSpoilered ?? false,
        postId: dto.postId,
      },
    });
  }

  async findOne(id: string) {
    const file = await this.prisma.file.findUnique({ where: { id } });
    if (!file) throw new NotFoundException("File not found");
    return file;
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.file.delete({ where: { id } });
  }

  async findByPost(postId: string) {
    return this.prisma.file.findMany({ where: { postId } });
  }
}
