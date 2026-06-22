import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { FilesService } from "./files.service";
import { FileMetadataDto } from "./files.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard, Roles } from "../auth/roles.guard";
import { Role } from "@prisma/client";

@ApiTags("files")
@Controller("files")
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Post("metadata")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Register file metadata after upload (internal)" })
  createMetadata(@Body() dto: FileMetadataDto) {
    return this.filesService.createMetadata(dto);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get file metadata by ID" })
  findOne(@Param("id") id: string) {
    return this.filesService.findOne(id);
  }

  @Get("post/:postId")
  @ApiOperation({ summary: "Get all files for a post" })
  findByPost(@Param("postId") postId: string) {
    return this.filesService.findByPost(postId);
  }

  @Delete(":id")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.MODERATOR, Role.ADMIN)
  @ApiOperation({ summary: "Delete a file record (mod/admin)" })
  remove(@Param("id") id: string) {
    return this.filesService.remove(id);
  }
}
