import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiConsumes,
} from "@nestjs/swagger";
import { FilesService } from "./files.service";
import { FileMetadataDto } from "./files.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard, Roles } from "../auth/roles.guard";
import { Role } from "@prisma/client";

@ApiTags("files")
@Controller("files")
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Post("upload")
  @ApiConsumes("multipart/form-data")
  @UseInterceptors(FileInterceptor("file"))
  @ApiOperation({ summary: "Upload a file (proxied to file-service)" })
  upload(
    @UploadedFile()
    file: { buffer: Buffer; originalname: string; mimetype: string },
    @Body("postId") postId: string,
  ) {
    return this.filesService.uploadFile(file, postId);
  }

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
