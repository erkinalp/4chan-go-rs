import {
  Injectable,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../../services/prisma/prisma.service";
import { FileMetadataDto } from "./files.dto";

const BANNED_HASHES: Set<string> = new Set();

@Injectable()
export class FilesService {
  private readonly fileServiceUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    const base = this.config.get<string>(
      "FILE_SERVICE_URL",
      "http://files:8080",
    );
    // file-service mounts its routes under <API_PREFIX>/<API_VERSION>
    // (default /api/v1); FILE_SERVICE_URL may already include that prefix.
    this.fileServiceUrl = base.replace(/\/$/, "");
  }

  private authHeaders(authorization?: string): Record<string, string> {
    // file-service upload/delete routes require auth; forward the caller's
    // bearer token so ownership/admin checks see the same identity.
    return authorization ? { Authorization: authorization } : {};
  }

  async uploadFile(
    file: { buffer: Buffer; originalname: string; mimetype: string },
    postId: string,
    authorization?: string,
  ) {
    const formData = new FormData();
    const blob = new Blob([file.buffer as unknown as ArrayBuffer], {
      type: file.mimetype,
    });
    formData.append("file", blob, file.originalname);
    formData.append("postId", postId);

    const response = await fetch(`${this.fileServiceUrl}/files/upload`, {
      method: "POST",
      headers: this.authHeaders(authorization),
      body: formData,
    }).catch((err: Error) => {
      throw new InternalServerErrorException(
        `File service unavailable: ${err.message}`,
      );
    });

    if (!response.ok) {
      const body = await response.text();
      throw new BadRequestException(`File upload failed: ${body}`);
    }

    const result = (await response.json()) as {
      storedFilename: string;
      thumbnailFilename: string;
      md5Hash: string;
      sha256Hash: string;
      width?: number;
      height?: number;
      filesize: number;
    };

    if (await this.checkBannedHash(result.md5Hash)) {
      throw new BadRequestException("This file has been banned");
    }

    return this.createMetadata({
      filename: file.originalname,
      storedFilename: result.storedFilename,
      thumbnailFilename: result.thumbnailFilename,
      mimeType: file.mimetype,
      md5Hash: result.md5Hash,
      sha256Hash: result.sha256Hash,
      width: result.width,
      height: result.height,
      filesize: result.filesize,
      postId,
    });
  }

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

  async remove(id: string, authorization?: string) {
    const file = await this.findOne(id);
    await fetch(`${this.fileServiceUrl}/files/${file.id}`, {
      method: "DELETE",
      headers: this.authHeaders(authorization),
    }).catch(() => {
      /* best-effort remote deletion */
    });
    return this.prisma.file.delete({ where: { id } });
  }

  async findByPost(postId: string) {
    return this.prisma.file.findMany({ where: { postId } });
  }

  async checkBannedHash(hash: string): Promise<boolean> {
    return BANNED_HASHES.has(hash);
  }
}
