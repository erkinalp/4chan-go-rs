import {
  IsString,
  IsOptional,
  IsBoolean,
  IsEnum,
  IsDateString,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { ReportReason, AppealStatus } from "@prisma/client";

export class CreateReportDto {
  @ApiProperty({ enum: ReportReason })
  @IsEnum(ReportReason)
  reason: ReportReason;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  additionalInfo?: string;

  @ApiPropertyOptional({ description: "Post ID to report" })
  @IsOptional()
  @IsString()
  postId?: string;

  @ApiPropertyOptional({ description: "Thread ID to report" })
  @IsOptional()
  @IsString()
  threadId?: string;
}

export class ResolveReportDto {
  @ApiProperty()
  @IsBoolean()
  isResolved: boolean;
}

export class CreateBanDto {
  @ApiProperty({ description: "IP hash of the user to ban" })
  @IsString()
  ipHash: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiPropertyOptional({ description: "Null for permanent bans" })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @ApiPropertyOptional({ description: "Null for global bans" })
  @IsOptional()
  @IsString()
  boardId?: string;
}

export class AppealBanDto {
  @ApiProperty()
  @IsString()
  appealReason: string;
}

export class ResolveAppealDto {
  @ApiProperty({ enum: [AppealStatus.APPROVED, AppealStatus.DENIED] })
  @IsEnum(AppealStatus)
  appealStatus: AppealStatus;
}

export class CreateWordFilterDto {
  @ApiProperty({ example: "badword" })
  @IsString()
  pattern: string;

  @ApiProperty({ example: "***" })
  @IsString()
  replacement: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isRegex?: boolean;

  @ApiPropertyOptional({ description: "Null for global filters" })
  @IsOptional()
  @IsString()
  boardId?: string;
}
