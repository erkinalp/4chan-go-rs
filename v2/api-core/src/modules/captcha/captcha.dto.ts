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

export class RedeemPowChallengeDto {
  @ApiProperty({ description: "Challenge ID from /captcha/pow/challenge" })
  @IsString()
  challenge_id: string;

  @ApiProperty({
    description:
      "Nonce such that sha256(`${challenge}:${nonce}`) meets the difficulty",
  })
  @IsString()
  nonce: string;
}

export class VerifyPowTokenDto {
  @ApiProperty({ description: "Token returned by /captcha/pow/redeem" })
  @IsString()
  token: string;
}
