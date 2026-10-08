import { IsEmail, IsNotEmpty, IsString, MinLength } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class LoginDto {
  @ApiProperty({ example: "user@example.com" })
  @IsEmail()
  email: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  password: string;
}

export class RegisterDto {
  @ApiProperty({ example: "anon" })
  @IsString()
  @MinLength(3)
  username: string;

  @ApiProperty({ example: "user@example.com" })
  @IsEmail()
  email: string;

  @ApiProperty()
  @IsString()
  @MinLength(8)
  password: string;
}

export class RefreshDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  refresh_token: string;
}

export class Verify2FADto {
  @ApiProperty({ description: "6-digit TOTP code" })
  @IsString()
  @IsNotEmpty()
  code: string;
}

export class TwoFactorChallengeDto {
  @ApiProperty({ description: "Challenge token returned by /auth/login" })
  @IsString()
  @IsNotEmpty()
  challenge_token: string;

  @ApiProperty({
    description: "6-digit TOTP code or a single-use backup code",
  })
  @IsString()
  @IsNotEmpty()
  code: string;
}

export class PasswordConfirmDto {
  @ApiProperty({ description: "Current account password" })
  @IsString()
  @IsNotEmpty()
  password: string;
}
