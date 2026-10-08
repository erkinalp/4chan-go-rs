import { Module } from "@nestjs/common";
import { ThreadsController } from "./threads.controller";
import { ThreadsService } from "./threads.service";

@Module({
  controllers: [ThreadsController],
  providers: [ThreadsService],
  exports: [ThreadsService],
})
export class ThreadsModule {}
