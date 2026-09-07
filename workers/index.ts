import { closeDatabase } from "#backend/database";
import { logger } from "#backend/logger";
import {
  cleanupQueue,
  closeQueue,
  failedQueue,
  operationQueue,
  queue,
} from "#backend/queue";
import { cleanupExpiredRecords, failTask, runTask } from "#backend/tasks";
import type { TaskData } from "#shared/types";

const log = logger.child({ component: "worker" });

let stopping = false;

async function shutdown() {
  if (stopping) {
    return;
  }

  stopping = true;

  try {
    await closeQueue().finally(closeDatabase);

    log.info("后台任务已停止");
  } catch (err) {
    log.error({ err }, "后台任务关闭失败");
    process.exitCode = 1;
  }
}

try {
  const boss = await queue();

  await boss.work<TaskData>(
    operationQueue,
    { localConcurrency: 3, groupConcurrency: 1 },
    async ([task]) => {
      try {
        await runTask(task!);
      } catch (err) {
        log.error(
          {
            err,
            queue: operationQueue,
            queueId: task!.id,
            jobId: task!.data.jobId,
          },
          "任务执行失败",
        );

        throw err;
      }
    },
  );

  await boss.work<TaskData>(failedQueue, async ([task]) => {
    try {
      await failTask(task!.data);

      log.warn(
        { jobId: task!.data.jobId, queueId: task!.data.queueId },
        "任务重试已耗尽",
      );
    } catch (err) {
      log.error(
        { err, queue: failedQueue, queueId: task!.id, jobId: task!.data.jobId },
        "任务失败状态保存失败",
      );

      throw err;
    }
  });

  await boss.work(cleanupQueue, async ([task]) => {
    try {
      await cleanupExpiredRecords();
    } catch (err) {
      log.error(
        { err, queue: cleanupQueue, queueId: task!.id },
        "过期数据清理失败",
      );

      throw err;
    }
  });

  log.info("账户服务后台任务已启动");
} catch (err) {
  log.fatal({ err }, "后台任务启动失败");
  process.exitCode = 1;

  await shutdown();
}

process.on("SIGTERM", () => {
  void shutdown();
});

process.on("SIGINT", () => {
  void shutdown();
});
