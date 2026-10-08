import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  Ip,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { ThreadsService } from "./threads.service";
import {
  CreateThreadDto,
  UpdateThreadDto,
  ThreadQueryDto,
} from "./threads.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard, Roles } from "../auth/roles.guard";
import { Role } from "@prisma/client";

@ApiTags("threads")
@Controller()
export class ThreadsController {
  constructor(private readonly threadsService: ThreadsService) {}

  @Get("boards/:boardId/threads")
  @ApiOperation({ summary: "List threads in a board (paginated)" })
  findByBoard(
    @Param("boardId") boardId: string,
    @Query() query: ThreadQueryDto,
  ) {
    return this.threadsService.findByBoard(boardId, query.page, query.limit);
  }

  @Get("boards/:boardId/catalog")
  @ApiOperation({ summary: "Get board catalog view" })
  catalog(@Param("boardId") boardId: string) {
    return this.threadsService.catalog(boardId);
  }

  @Get("threads/:id")
  @ApiOperation({ summary: "Get a thread with all its posts" })
  findOne(@Param("id") id: string) {
    return this.threadsService.findOne(id);
  }

  @Post("boards/:boardId/threads")
  @ApiOperation({ summary: "Create a new thread" })
  create(
    @Param("boardId") boardId: string,
    @Body() dto: CreateThreadDto,
    @Ip() ip: string,
  ) {
    dto.boardId = boardId;
    return this.threadsService.create(dto, ip);
  }

  @Patch("threads/:id")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.MODERATOR, Role.ADMIN)
  @ApiOperation({ summary: "Update thread properties (mod/admin)" })
  update(@Param("id") id: string, @Body() dto: UpdateThreadDto) {
    return this.threadsService.update(id, dto);
  }

  @Patch("threads/:id/lock")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.MODERATOR, Role.ADMIN)
  @ApiOperation({ summary: "Toggle thread lock" })
  lock(@Param("id") id: string) {
    return this.threadsService.lockThread(id);
  }

  @Patch("threads/:id/unlock")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.MODERATOR, Role.ADMIN)
  @ApiOperation({ summary: "Unlock a thread" })
  unlock(@Param("id") id: string) {
    return this.threadsService.unlockThread(id);
  }

  @Patch("threads/:id/sticky")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.MODERATOR, Role.ADMIN)
  @ApiOperation({ summary: "Toggle thread sticky" })
  sticky(@Param("id") id: string) {
    return this.threadsService.stickyThread(id);
  }

  @Patch("threads/:id/archive")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.MODERATOR, Role.ADMIN)
  @ApiOperation({ summary: "Archive a thread" })
  archive(@Param("id") id: string) {
    return this.threadsService.archiveThread(id);
  }

  @Delete("threads/:id")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.MODERATOR, Role.ADMIN)
  @ApiOperation({ summary: "Delete a thread (mod/admin)" })
  remove(@Param("id") id: string) {
    return this.threadsService.remove(id);
  }
}
