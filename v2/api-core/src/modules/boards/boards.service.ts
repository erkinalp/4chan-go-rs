import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../services/prisma/prisma.service";
import {
  CreateBoardDto,
  UpdateBoardDto,
  CreateCategoryDto,
} from "./boards.dto";

@Injectable()
export class BoardsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.board.findMany({
      where: { isArchived: false },
      include: { category: true },
      orderBy: { name: "asc" },
    });
  }

  async findOne(id: string) {
    const board = await this.prisma.board.findUnique({
      where: { id },
      include: { category: true },
    });
    if (!board) throw new NotFoundException(`Board /${id}/ not found`);
    return board;
  }

  async create(dto: CreateBoardDto) {
    return this.prisma.board.create({ data: dto });
  }

  async update(id: string, dto: UpdateBoardDto) {
    await this.findOne(id);
    return this.prisma.board.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.board.delete({ where: { id } });
  }

  async findAllCategories() {
    return this.prisma.category.findMany({
      include: { boards: { where: { isArchived: false } } },
      orderBy: { order: "asc" },
    });
  }

  async createCategory(dto: CreateCategoryDto) {
    return this.prisma.category.create({ data: dto });
  }
}
