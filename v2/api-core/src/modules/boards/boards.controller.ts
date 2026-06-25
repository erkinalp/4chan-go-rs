import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { BoardsService } from "./boards.service";
import {
  CreateBoardDto,
  UpdateBoardDto,
  CreateCategoryDto,
} from "./boards.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard, Roles } from "../auth/roles.guard";
import { Role } from "@prisma/client";

@ApiTags("boards")
@Controller("boards")
export class BoardsController {
  constructor(private readonly boardsService: BoardsService) {}

  @Get()
  @ApiOperation({ summary: "List all active boards" })
  findAll() {
    return this.boardsService.findAll();
  }

  @Get("categories")
  @ApiOperation({ summary: "List all categories with their boards" })
  findAllCategories() {
    return this.boardsService.findAllCategories();
  }

  @Get(":id")
  @ApiOperation({ summary: "Get a board by its short code" })
  findOne(@Param("id") id: string) {
    return this.boardsService.findOne(id);
  }

  @Post()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: "Create a new board (admin only)" })
  create(@Body() dto: CreateBoardDto) {
    return this.boardsService.create(dto);
  }

  @Patch(":id")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: "Update a board (admin only)" })
  update(@Param("id") id: string, @Body() dto: UpdateBoardDto) {
    return this.boardsService.update(id, dto);
  }

  @Delete(":id")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: "Delete a board (admin only)" })
  remove(@Param("id") id: string) {
    return this.boardsService.remove(id);
  }

  @Post("categories")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: "Create a new category (admin only)" })
  createCategory(@Body() dto: CreateCategoryDto) {
    return this.boardsService.createCategory(dto);
  }
}
