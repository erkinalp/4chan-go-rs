import { Test, TestingModule } from "@nestjs/testing";
import { BoardsService } from "./boards.service";
import { PrismaService } from "../../services/prisma/prisma.service";
import { NotFoundException } from "@nestjs/common";

const mockPrisma = {
  board: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  category: {
    findMany: jest.fn(),
    create: jest.fn(),
  },
};

describe("BoardsService", () => {
  let service: BoardsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BoardsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get<BoardsService>(BoardsService);
  });

  describe("findAll", () => {
    it("should return non-archived boards ordered by name", async () => {
      const boards = [{ id: "b", name: "Random", isArchived: false }];
      mockPrisma.board.findMany.mockResolvedValue(boards);
      const result = await service.findAll();
      expect(result).toEqual(boards);
      expect(mockPrisma.board.findMany).toHaveBeenCalledWith({
        where: { isArchived: false },
        include: { category: true },
        orderBy: { name: "asc" },
      });
    });
  });

  describe("findOne", () => {
    it("should return a board by id", async () => {
      const board = { id: "b", name: "Random" };
      mockPrisma.board.findUnique.mockResolvedValue(board);
      const result = await service.findOne("b");
      expect(result).toEqual(board);
    });

    it("should throw NotFoundException for missing board", async () => {
      mockPrisma.board.findUnique.mockResolvedValue(null);
      await expect(service.findOne("xyz")).rejects.toThrow(NotFoundException);
    });
  });

  describe("create", () => {
    it("should create and return a board", async () => {
      const dto = { id: "g", name: "Technology", categoryId: "cat1" };
      const created = { ...dto, isNsfw: false };
      mockPrisma.board.create.mockResolvedValue(created);
      const result = await service.create(dto);
      expect(result).toEqual(created);
      expect(mockPrisma.board.create).toHaveBeenCalledWith({ data: dto });
    });
  });

  describe("update", () => {
    it("should update a board", async () => {
      const board = { id: "b", name: "Random" };
      mockPrisma.board.findUnique.mockResolvedValue(board);
      mockPrisma.board.update.mockResolvedValue({ ...board, name: "Updated" });
      const result = await service.update("b", { name: "Updated" });
      expect(result.name).toBe("Updated");
    });

    it("should throw if board not found", async () => {
      mockPrisma.board.findUnique.mockResolvedValue(null);
      await expect(service.update("xyz", { name: "X" })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("remove", () => {
    it("should delete a board", async () => {
      mockPrisma.board.findUnique.mockResolvedValue({ id: "b" });
      mockPrisma.board.delete.mockResolvedValue({ id: "b" });
      const result = await service.remove("b");
      expect(result).toEqual({ id: "b" });
    });
  });

  describe("findAllCategories", () => {
    it("should return categories with boards", async () => {
      const categories = [{ id: "c1", name: "Tech", boards: [] }];
      mockPrisma.category.findMany.mockResolvedValue(categories);
      const result = await service.findAllCategories();
      expect(result).toEqual(categories);
    });
  });

  describe("createCategory", () => {
    it("should create a category", async () => {
      const dto = { name: "Japanese Culture" };
      mockPrisma.category.create.mockResolvedValue({ id: "c1", ...dto });
      const result = await service.createCategory(dto);
      expect(result.name).toBe("Japanese Culture");
    });
  });
});
