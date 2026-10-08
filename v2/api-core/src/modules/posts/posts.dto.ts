import { IsString, IsOptional, IsBoolean, MaxLength } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class CreatePostDto {
  @ApiPropertyOptional({ example: "Anonymous", maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiProperty({ description: "Post message body" })
  @IsString()
  message: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isSpoilered?: boolean;
}

export class DeletePostDto {
  @ApiPropertyOptional({
    description: "If true, only delete the file attachment",
  })
  @IsOptional()
  @IsBoolean()
  fileOnly?: boolean;
}
