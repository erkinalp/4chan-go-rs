import { IsString, IsOptional, IsBoolean, IsInt, Min } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class FileMetadataDto {
  @ApiProperty()
  @IsString()
  filename: string;

  @ApiProperty()
  @IsString()
  storedFilename: string;

  @ApiProperty()
  @IsInt()
  @Min(0)
  filesize: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  width?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  height?: number;

  @ApiProperty()
  @IsString()
  thumbnailFilename: string;

  @ApiProperty()
  @IsString()
  mimeType: string;

  @ApiProperty()
  @IsString()
  md5Hash: string;

  @ApiProperty()
  @IsString()
  sha256Hash: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isSpoilered?: boolean;

  @ApiProperty()
  @IsString()
  postId: string;
}
