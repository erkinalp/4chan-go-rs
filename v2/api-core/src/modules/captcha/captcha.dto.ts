import { IsString } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class VerifyCaptchaDto {
  @ApiProperty({ description: "Captcha ID" })
  @IsString()
  id: string;

  @ApiProperty({ description: "User-provided solution" })
  @IsString()
  solution: string;
}
