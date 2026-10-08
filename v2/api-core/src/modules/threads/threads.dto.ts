import {
  IsString,
  IsOptional,
  IsBoolean,
  IsInt,
  Min,
  MaxLength,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class CreateThreadDto {
  @ApiProperty({ description: "Board short code", example: "b" })
  @IsString()
  boardId: string;

  @ApiPropertyOptional({ maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  subject?: string;

  @ApiProperty({ description: "Opening post message" })
  @IsString()
  message: string;

  @ApiPropertyOptional({ example: "Anonymous" })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;
}

export class ThreadQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @IsInt()
  @Min(1)
  limit?: number;
}

export class UpdateThreadDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isSticky?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isLocked?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isCyclic?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  cycleLimit?: number;
}
