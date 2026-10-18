/* eslint-disable */
import { Job } from 'bullmq';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { QUEUES, USER_JOBS } from '@common/constants';
import {
  FIREBASE_SERVICE,
  IFirebaseService,
} from '@src/infrastructure/firebase/firebase.service.interface';
import { Inject, Logger } from '@nestjs/common';

@Processor(QUEUES.USER)
export class UserProcessor extends WorkerHost {
  private readonly logger = new Logger(UserProcessor.name);

  constructor(
    @Inject(FIREBASE_SERVICE)
    private readonly firebaseService: IFirebaseService
  ) {
    super();
  }

  async process(job: Job<any, any>): Promise<void> {
    const { name } = job;

    switch (name) {
      case USER_JOBS.FIREBASE_ROLLBACK:
        await this.handleFirebaseRollback(job);
        break;

      default:
        this.logger.warn(`Job name not found: ${name}`);
        break;
    }
  }

  private async handleFirebaseRollback(job: Job<{ firebaseUid: string }>) {
    const { firebaseUid } = job.data;

    try {
      this.logger.log(
        `Attempting to delete ghost user from Firebase: ${firebaseUid}`
      );
      await this.firebaseService.deleteUser(firebaseUid);
      this.logger.log(`Successfully rolled back Firebase user: ${firebaseUid}`);
    } catch (error) {
      this.logger.error(
        `Failed to rollback Firebase user ${firebaseUid}. Attempt: ${job.attemptsMade + 1}`,
        error.stack
      );

      throw error;
    }
  }
}
