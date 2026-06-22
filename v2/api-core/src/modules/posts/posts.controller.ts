import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
  Ip,
  Query,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { PostsService } from "./posts.service";
import { CreatePostDto, DeletePostDto } from "./posts.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard, Roles } from "../auth/roles.guard";
import { Role } from "@prisma/client";

@ApiTags("posts")
@Controller()
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @Post("threads/:threadId/posts")
  @ApiOperation({ summary: "Reply to a thread" })
  create(
    @Param("threadId") threadId: string,
    @Body() dto: CreatePostDto,
    @Ip() ip: string,
  ) {
    return this.postsService.create(threadId, dto, ip);
  }

  @Get("threads/:threadId/posts")
  @ApiOperation({ summary: "Get posts for a thread (paginated)" })
  getPostsByThread(
    @Param("threadId") threadId: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
  ) {
    return this.postsService.getPostsByThread(
      threadId,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 100,
    );
  }

  @Get("posts/:id")
  @ApiOperation({ summary: "Get a single post by ID" })
  findOne(@Param("id") id: string) {
    return this.postsService.findOne(id);
  }

  @Delete("posts/:id")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.JANITOR, Role.MODERATOR, Role.ADMIN)
  @ApiOperation({ summary: "Soft-delete a post (staff only)" })
  remove(@Param("id") id: string, @Query() query: DeletePostDto) {
    if (query.fileOnly) {
      return this.postsService.deleteFileOnly(id);
    }
    return this.postsService.softDelete(id);
  }
}
