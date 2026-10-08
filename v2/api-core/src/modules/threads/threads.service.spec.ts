import { Test, TestingModule } from "@nestjs/testing";
import { ThreadsService } from "./threads.service";
import { PrismaService } from "../../services/prisma/prisma.service";
import { NotFoundException, BadRequestException } from "@nestjs/common";

const mockPrisma = {
  board: { findUnique: jest.fn() },
  thread: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  post: { findFirst: jest.fn() },
};

describe("ThreadsService", () => {
  let service: ThreadsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ThreadsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get<ThreadsService>(ThreadsService);
  });

  describe("findByBoard", () => {
    it("should throw if board not found", async () => {
      mockPrisma.board.findUnique.mockResolvedValue(null);
      await expect(service.findByBoard("xyz")).rejects.toThrow(
        NotFoundException,
      );
    });

    it("should return paginated threads", async () => {
      mockPrisma.board.findUnique.mockResolvedValue({ id: "b" });
      mockPrisma.thread.findMany.mockResolvedValue([{ id: "t1" }]);
      mockPrisma.thread.count.mockResolvedValue(1);
      const result = await service.findByBoard("b", 1, 20);
      expect(result.threads).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
    });
  });

  describe("findOne", () => {
    it("should return a thread with posts", async () => {
      const thread = { id: "t1", posts: [], board: { id: "b" } };
      mockPrisma.thread.findUnique.mockResolvedValue(thread);
      const result = await service.findOne("t1");
      expect(result.id).toBe("t1");
    });

    it("should throw if thread not found", async () => {
      mockPrisma.thread.findUnique.mockResolvedValue(null);
      await expect(service.findOne("xyz")).rejects.toThrow(NotFoundException);
    });
  });

  describe("create", () => {
    it("should throw if board not found", async () => {
      mockPrisma.board.findUnique.mockResolvedValue(null);
      await expect(
        service.create({ boardId: "xyz", message: "test" }, "127.0.0.1"),
      ).rejects.toThrow(NotFoundException);
    });

    it("should throw if board is archived", async () => {
      mockPrisma.board.findUnique.mockResolvedValue({
        id: "b",
        isArchived: true,
      });
      await expect(
        service.create({ boardId: "b", message: "test" }, "127.0.0.1"),
      ).rejects.toThrow(BadRequestException);
    });

    it("should create a thread with OP post", async () => {
      mockPrisma.board.findUnique.mockResolvedValue({
        id: "b",
        isArchived: false,
      });
      mockPrisma.post.findFirst.mockResolvedValue(null);
      const created = { id: "t1", posts: [{ postNumber: 1 }] };
      mockPrisma.thread.create.mockResolvedValue(created);
      const result = await service.create(
        { boardId: "b", message: "hello" },
        "127.0.0.1",
      );
      expect(result.id).toBe("t1");
    });
  });

  describe("lockThread", () => {
    it("should lock a thread", async () => {
      mockPrisma.thread.findUnique.mockResolvedValue({
        id: "t1",
        posts: [],
        board: {},
      });
      mockPrisma.thread.update.mockResolvedValue({
        id: "t1",
        isLocked: true,
      });
      const result = await service.lockThread("t1");
      expect(result.isLocked).toBe(true);
    });
  });

  describe("unlockThread", () => {
    it("should unlock a thread", async () => {
      mockPrisma.thread.findUnique.mockResolvedValue({
        id: "t1",
        posts: [],
        board: {},
      });
      mockPrisma.thread.update.mockResolvedValue({
        id: "t1",
        isLocked: false,
      });
      const result = await service.unlockThread("t1");
      expect(result.isLocked).toBe(false);
    });
  });

  describe("stickyThread", () => {
    it("should toggle sticky", async () => {
      mockPrisma.thread.findUnique.mockResolvedValue({
        id: "t1",
        isSticky: false,
        posts: [],
        board: {},
      });
      mockPrisma.thread.update.mockResolvedValue({
        id: "t1",
        isSticky: true,
      });
      const result = await service.stickyThread("t1");
      expect(result.isSticky).toBe(true);
    });
  });

  describe("archiveThread", () => {
    it("should archive by locking", async () => {
      mockPrisma.thread.findUnique.mockResolvedValue({
        id: "t1",
        posts: [],
        board: {},
      });
      mockPrisma.thread.update.mockResolvedValue({
        id: "t1",
        isLocked: true,
      });
      const result = await service.archiveThread("t1");
      expect(result.isLocked).toBe(true);
    });
  });
});
