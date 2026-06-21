import { Injectable, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../../services/prisma/prisma.service";
import { createHash, randomBytes } from "crypto";

@Injectable()
export class CaptchaService {
  constructor(private readonly prisma: PrismaService) {}

  async generate(ip: string) {
    const ipHash = createHash("sha256").update(ip).digest("hex").slice(0, 16);
    const solution = randomBytes(3).toString("hex").toUpperCase();
    const hashedSolution = createHash("sha256").update(solution).digest("hex");

    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 5);

    const captcha = await this.prisma.captcha.create({
      data: { solution: hashedSolution, expiresAt, ipHash },
    });

    return {
      id: captcha.id,
      challenge: solution,
      expiresAt: captcha.expiresAt,
    };
  }

  async verify(id: string, solution: string): Promise<boolean> {
    const captcha = await this.prisma.captcha.findUnique({ where: { id } });
    if (!captcha) {
      throw new BadRequestException("Invalid captcha");
    }
    if (captcha.isUsed) {
      throw new BadRequestException("Captcha already used");
    }
    if (captcha.expiresAt < new Date()) {
      throw new BadRequestException("Captcha expired");
    }

    const hashedInput = createHash("sha256").update(solution).digest("hex");
    if (hashedInput !== captcha.solution) {
      throw new BadRequestException("Incorrect captcha solution");
    }

    await this.prisma.captcha.update({
      where: { id },
      data: { isUsed: true },
    });

    return true;
  }

  async cleanup() {
    const result = await this.prisma.captcha.deleteMany({
      where: {
        OR: [{ expiresAt: { lt: new Date() } }, { isUsed: true }],
      },
    });
    return { deleted: result.count };
  }
}
