import { Module } from "@nestjs/common";
import { BoardsController } from "./boards.controller";
import { BoardsService } from "./boards.service";

@Module({
  controllers: [BoardsController],
  providers: [BoardsService],
  exports: [BoardsService],
})
export class BoardsModule {}
