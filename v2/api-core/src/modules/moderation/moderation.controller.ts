import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  Req,
  Ip,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { ModerationService } from "./moderation.service";
import {
  CreateReportDto,
  ResolveReportDto,
  CreateBanDto,
  AppealBanDto,
  ResolveAppealDto,
  CreateWordFilterDto,
} from "./moderation.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard, Roles } from "../auth/roles.guard";
import { Role } from "@prisma/client";

@ApiTags("moderation")
@Controller("moderation")
export class ModerationController {
  constructor(private readonly moderationService: ModerationService) {}

  // --- Reports ---

  @Post("reports")
  @ApiOperation({ summary: "Submit a report (anonymous)" })
  createReport(@Body() dto: CreateReportDto, @Ip() ip: string) {
    return this.moderationService.createReport(dto, ip);
  }

  @Get("reports")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.JANITOR, Role.MODERATOR, Role.ADMIN)
  @ApiOperation({ summary: "List reports (staff only)" })
  findReports(@Query("resolved") resolved?: string) {
    const flag = resolved === undefined ? undefined : resolved === "true";
    return this.moderationService.findReports(flag);
  }

  @Put("reports/:id/resolve")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.JANITOR, Role.MODERATOR, Role.ADMIN)
  @ApiOperation({ summary: "Resolve or unresolve a report" })
  resolveReport(
    @Param("id") id: string,
    @Body() dto: ResolveReportDto,
    @Req() req: any,
  ) {
    return this.moderationService.resolveReport(id, dto, req.user.id);
  }

  // --- Bans ---

  @Post("bans")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.MODERATOR, Role.ADMIN)
  @ApiOperation({ summary: "Create a ban" })
  createBan(@Body() dto: CreateBanDto, @Req() req: any) {
    return this.moderationService.createBan(dto, req.user.id);
  }

  @Get("bans")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.MODERATOR, Role.ADMIN)
  @ApiOperation({ summary: "List bans" })
  findBans(@Query("active") active?: string) {
    const flag = active === undefined ? undefined : active === "true";
    return this.moderationService.findBans(flag);
  }

  @Put("bans/:id/revoke")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.MODERATOR, Role.ADMIN)
  @ApiOperation({ summary: "Revoke a ban" })
  revokeBan(@Param("id") id: string) {
    return this.moderationService.revokeBan(id);
  }

  @Post("bans/:id/appeal")
  @ApiOperation({ summary: "Submit a ban appeal (anonymous)" })
  appealBan(@Param("id") id: string, @Body() dto: AppealBanDto) {
    return this.moderationService.appealBan(id, dto);
  }

  @Put("bans/:id/appeal")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.MODERATOR, Role.ADMIN)
  @ApiOperation({ summary: "Resolve a ban appeal" })
  resolveAppeal(@Param("id") id: string, @Body() dto: ResolveAppealDto) {
    return this.moderationService.resolveAppeal(id, dto);
  }

  @Get("bans/check/:ipHash")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.MODERATOR, Role.ADMIN)
  @ApiOperation({ summary: "Check if an IP hash is banned" })
  checkBan(
    @Param("ipHash") ipHash: string,
    @Query("boardId") boardId?: string,
  ) {
    return this.moderationService.checkBan(ipHash, boardId);
  }

  // --- Word Filters ---

  @Post("wordfilters")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.MODERATOR, Role.ADMIN)
  @ApiOperation({ summary: "Create a word filter" })
  createWordFilter(@Body() dto: CreateWordFilterDto) {
    return this.moderationService.createWordFilter(dto);
  }

  @Get("wordfilters")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.JANITOR, Role.MODERATOR, Role.ADMIN)
  @ApiOperation({ summary: "List word filters" })
  findWordFilters(@Query("boardId") boardId?: string) {
    return this.moderationService.findWordFilters(boardId);
  }

  @Delete("wordfilters/:id")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.MODERATOR, Role.ADMIN)
  @ApiOperation({ summary: "Delete a word filter" })
  removeWordFilter(@Param("id") id: string) {
    return this.moderationService.removeWordFilter(id);
  }

  // --- Audit Log ---

  @Get("audit")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: "View audit log (admin only)" })
  getAuditLog(@Query("page") page?: string, @Query("limit") limit?: string) {
    return this.moderationService.getAuditLog(
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 50,
    );
  }
}
