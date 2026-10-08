import { Test, TestingModule } from "@nestjs/testing";
import { PostsService } from "./posts.service";
import { PrismaService } from "../../services/prisma/prisma.service";
import { NotFoundException, BadRequestException } from "@nestjs/common";

const mockPrisma = {
  thread: { findUnique: jest.fn(), update: jest.fn() },
  post: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
  },
  file: { deleteMany: jest.fn() },
};

describe("PostsService", () => {
  let service: PostsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PostsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get<PostsService>(PostsService);
  });

  describe("create", () => {
    it("should throw if thread not found", async () => {
      mockPrisma.thread.findUnique.mockResolvedValue(null);
      await expect(
        service.create("t1", { message: "hi" }, "127.0.0.1"),
      ).rejects.toThrow(NotFoundException);
    });

    it("should throw if thread is locked", async () => {
      mockPrisma.thread.findUnique.mockResolvedValue({
        id: "t1",
        isLocked: true,
        board: { bumpLimit: 300, id: "b" },
      });
      await expect(
        service.create("t1", { message: "hi" }, "127.0.0.1"),
      ).rejects.toThrow(BadRequestException);
    });

    it("should create a post with tripcode when name contains #", async () => {
      mockPrisma.thread.findUnique.mockResolvedValue({
        id: "t1",
        isLocked: false,
        boardId: "b",
        board: { bumpLimit: 300, id: "b" },
      });
      mockPrisma.post.findFirst.mockResolvedValue(null);
      mockPrisma.post.create.mockImplementation(
        async (args: { data: Record<string, unknown> }) => ({
          id: "p1",
          ...args.data,
          files: [],
        }),
      );
      mockPrisma.post.count.mockResolvedValue(1);
      mockPrisma.thread.update.mockResolvedValue({});

      const result = await service.create(
        "t1",
        { message: "hello", name: "User#secret" },
        "127.0.0.1",
      );
      expect(result.name).toBe("User");
      expect(result.tripcode).toMatch(/^!/);
    });

    it("should wrap greentext lines in span tags", async () => {
      mockPrisma.thread.findUnique.mockResolvedValue({
        id: "t1",
        isLocked: false,
        boardId: "b",
        board: { bumpLimit: 300, id: "b" },
      });
      mockPrisma.post.findFirst.mockResolvedValue(null);
      mockPrisma.post.create.mockImplementation(
        async (args: { data: Record<string, unknown> }) => ({
          id: "p1",
          ...args.data,
          files: [],
        }),
      );
      mockPrisma.post.count.mockResolvedValue(1);
      mockPrisma.thread.update.mockResolvedValue({});

      const result = await service.create(
        "t1",
        { message: ">implying\nnormal line\n>>12345" },
        "127.0.0.1",
      );
      const msg = result.message as string;
      expect(msg).toContain('<span class="greentext">>implying</span>');
      expect(msg).toContain("normal line");
      expect(msg).toContain(">>12345");
      expect(msg).not.toContain('<span class="greentext">>>12345</span>');
    });

    it("should not bump when message contains sage", async () => {
      mockPrisma.thread.findUnique.mockResolvedValue({
        id: "t1",
        isLocked: false,
        boardId: "b",
        board: { bumpLimit: 300, id: "b" },
      });
      mockPrisma.post.findFirst.mockResolvedValue(null);
      mockPrisma.post.create.mockImplementation(
        async (args: { data: Record<string, unknown> }) => ({
          id: "p1",
          ...args.data,
          files: [],
        }),
      );

      await service.create("t1", { message: "sage" }, "127.0.0.1");
      expect(mockPrisma.thread.update).not.toHaveBeenCalled();
    });

    it("should bump thread for non-sage posts within bump limit", async () => {
      mockPrisma.thread.findUnique.mockResolvedValue({
        id: "t1",
        isLocked: false,
        boardId: "b",
        board: { bumpLimit: 300, id: "b" },
      });
      mockPrisma.post.findFirst.mockResolvedValue(null);
      mockPrisma.post.create.mockImplementation(
        async (args: { data: Record<string, unknown> }) => ({
          id: "p1",
          ...args.data,
          files: [],
        }),
      );
      mockPrisma.post.count.mockResolvedValue(5);
      mockPrisma.thread.update.mockResolvedValue({});

      await service.create("t1", { message: "hello" }, "127.0.0.1");
      expect(mockPrisma.thread.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "t1" },
          data: { bumpedAt: expect.any(Date) },
        }),
      );
    });
  });

  describe("getPostsByThread", () => {
    it("should return paginated posts", async () => {
      mockPrisma.post.findMany.mockResolvedValue([{ id: "p1" }]);
      mockPrisma.post.count.mockResolvedValue(1);
      const result = await service.getPostsByThread("t1", 1, 100);
      expect(result.posts).toHaveLength(1);
      expect(result.total).toBe(1);
    });
  });

  describe("softDelete", () => {
    it("should mark post as deleted", async () => {
      mockPrisma.post.findUnique.mockResolvedValue({
        id: "p1",
        files: [],
      });
      mockPrisma.post.update.mockResolvedValue({
        id: "p1",
        isDeleted: true,
      });
      const result = await service.softDelete("p1");
      expect(result.isDeleted).toBe(true);
    });
  });

  describe("deleteFileOnly", () => {
    it("should delete files and return message", async () => {
      mockPrisma.post.findUnique.mockResolvedValue({
        id: "p1",
        files: [],
      });
      mockPrisma.file.deleteMany.mockResolvedValue({ count: 1 });
      const result = await service.deleteFileOnly("p1");
      expect(result.message).toBe("Files removed");
    });
  });
});
