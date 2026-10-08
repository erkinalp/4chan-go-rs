import { Test, TestingModule } from "@nestjs/testing";
import { FilesService } from "./files.service";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../../services/prisma/prisma.service";
import {
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
} from "@nestjs/common";
import { FileMetadataDto } from "./files.dto";

const mockPrisma = {
  file: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
  },
};

const mockConfig = {
  get: jest.fn().mockImplementation((key: string, fallback?: unknown) => {
    const map: Record<string, unknown> = {
      FILE_SERVICE_URL: "http://files:8080",
    };
    return map[key] ?? fallback;
  }),
};

const sampleDto: FileMetadataDto = {
  filename: "cat.jpg",
  storedFilename: "s1.jpg",
  filesize: 1000,
  width: 800,
  height: 600,
  thumbnailFilename: "t1.jpg",
  mimeType: "image/jpeg",
  md5Hash: "deadbeef",
  sha256Hash: "cafe",
  postId: "post-1",
};

describe("FilesService", () => {
  let service: FilesService;
  const mockFetch = jest.fn();

  beforeEach(async () => {
    jest.clearAllMocks();
    global.fetch = mockFetch as unknown as typeof fetch;
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FilesService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();
    service = module.get<FilesService>(FilesService);
  });

  describe("createMetadata", () => {
    it("should create a file record from the dto", async () => {
      mockPrisma.file.findFirst.mockResolvedValue(null);
      mockPrisma.file.create.mockImplementation(({ data }) =>
        Promise.resolve({ id: "f1", ...data }),
      );

      const result = await service.createMetadata(sampleDto);
      expect(result.id).toBe("f1");
      expect(mockPrisma.file.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          filename: "cat.jpg",
          storedFilename: "s1.jpg",
          md5Hash: "deadbeef",
          isSpoilered: false,
          postId: "post-1",
        }),
      });
    });

    it("should reuse stored/thumbnail names of an existing duplicate hash", async () => {
      mockPrisma.file.findFirst.mockResolvedValue({
        storedFilename: "existing.jpg",
        thumbnailFilename: "existing-thumb.jpg",
      });
      mockPrisma.file.create.mockImplementation(({ data }) =>
        Promise.resolve({ id: "f2", ...data }),
      );

      await service.createMetadata(sampleDto);
      expect(mockPrisma.file.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          storedFilename: "existing.jpg",
          thumbnailFilename: "existing-thumb.jpg",
        }),
      });
    });
  });

  describe("findOne", () => {
    it("should return the file when found", async () => {
      mockPrisma.file.findUnique.mockResolvedValue({ id: "f1" });
      const result = await service.findOne("f1");
      expect(result).toEqual({ id: "f1" });
    });

    it("should throw NotFoundException when missing", async () => {
      mockPrisma.file.findUnique.mockResolvedValue(null);
      await expect(service.findOne("nope")).rejects.toThrow(NotFoundException);
    });
  });

  describe("findByPost", () => {
    it("should delegate to prisma findMany", async () => {
      mockPrisma.file.findMany.mockResolvedValue([{ id: "f1" }]);
      const result = await service.findByPost("post-1");
      expect(result).toHaveLength(1);
      expect(mockPrisma.file.findMany).toHaveBeenCalledWith({
        where: { postId: "post-1" },
      });
    });
  });

  describe("remove", () => {
    it("should delete remotely then remove the record", async () => {
      mockPrisma.file.findUnique.mockResolvedValue({
        id: "f1",
        storedFilename: "s1.jpg",
      });
      mockFetch.mockResolvedValue({ ok: true });
      mockPrisma.file.delete.mockResolvedValue({ id: "f1" });

      const result = await service.remove("f1");
      expect(result).toEqual({ id: "f1" });
      expect(mockFetch).toHaveBeenCalledWith("http://files:8080/files/s1.jpg", {
        method: "DELETE",
      });
      expect(mockPrisma.file.delete).toHaveBeenCalledWith({
        where: { id: "f1" },
      });
    });

    it("should still delete the record when remote deletion fails", async () => {
      mockPrisma.file.findUnique.mockResolvedValue({
        id: "f1",
        storedFilename: "s1.jpg",
      });
      mockFetch.mockRejectedValue(new Error("unreachable"));
      mockPrisma.file.delete.mockResolvedValue({ id: "f1" });

      const result = await service.remove("f1");
      expect(result).toEqual({ id: "f1" });
      expect(mockPrisma.file.delete).toHaveBeenCalled();
    });

    it("should throw NotFoundException for a missing file", async () => {
      mockPrisma.file.findUnique.mockResolvedValue(null);
      await expect(service.remove("nope")).rejects.toThrow(NotFoundException);
      expect(mockPrisma.file.delete).not.toHaveBeenCalled();
    });
  });

  describe("uploadFile", () => {
    const file = {
      buffer: Buffer.from("data"),
      originalname: "cat.jpg",
      mimetype: "image/jpeg",
    };

    it("should throw InternalServerErrorException when file-service is unreachable", async () => {
      mockFetch.mockRejectedValue(new Error("ECONNREFUSED"));
      await expect(service.uploadFile(file, "post-1")).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it("should throw BadRequestException on a non-OK upload response", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        text: () => Promise.resolve("file too large"),
      });
      await expect(service.uploadFile(file, "post-1")).rejects.toThrow(
        BadRequestException,
      );
    });

    it("should register metadata after a successful upload", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            storedFilename: "stored.jpg",
            thumbnailFilename: "thumb.jpg",
            md5Hash: "abc123",
            sha256Hash: "def456",
            width: 100,
            height: 100,
            filesize: 42,
          }),
      });
      mockPrisma.file.findFirst.mockResolvedValue(null);
      mockPrisma.file.create.mockImplementation(({ data }) =>
        Promise.resolve({ id: "f9", ...data }),
      );

      const result = await service.uploadFile(file, "post-1");
      expect(result.id).toBe("f9");
      expect(mockPrisma.file.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          storedFilename: "stored.jpg",
          md5Hash: "abc123",
          postId: "post-1",
        }),
      });
    });
  });

  describe("checkBannedHash", () => {
    it("should report hashes as not banned (empty banlist)", async () => {
      await expect(service.checkBannedHash("whatever")).resolves.toBe(false);
    });
  });
});
