import { IsString, IsOptional, IsBoolean, IsInt, Min } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class CreateBoardDto {
  @ApiProperty({ example: "b", description: "Short board code" })
  @IsString()
  id: string;

  @ApiProperty({ example: "Random" })
  @IsString()
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty()
  @IsString()
  categoryId: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isNsfw?: boolean;

  @ApiPropertyOptional({ default: 200 })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxThreads?: number;

  @ApiPropertyOptional({ default: 300 })
  @IsOptional()
  @IsInt()
  @Min(1)
  bumpLimit?: number;
}

export class UpdateBoardDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isNsfw?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isArchived?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  maxThreads?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  bumpLimit?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  cooldownThreads?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  cooldownReplies?: number;
}

export class CreateCategoryDto {
  @ApiProperty({ example: "Japanese Culture" })
  @IsString()
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;
}
