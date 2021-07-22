import { parentPort, workerData } from 'worker_threads';
import { ChildMessageType, ParentMessageType } from './enums';

export class PrimeWorker {
  private static readonly SUB_BLOCK_SIZE = 500;
  private readonly workerId;
  private primes = [];

  constructor() {
    this.workerId = workerData.workerId;

    parentPort.on('message', async message => {
      switch (message.type) {
        case ParentMessageType.ProcessNewBlock: {
          await this.processNewBlock(message.data);
          break;
        }
        case ParentMessageType.Kill: {
          // This eventHandler (parentPort.on('message', ...)) prevent the thread to terminate.
          parentPort.unref();
          break;
        }
        default: {
          break;
        }
      }
    });
  }

  private async processNewBlock(data: any) {
    this.primes = [];

    const start = process.hrtime();

    // Split block in sub block
    let subBlockCount = Math.trunc(data.size / PrimeWorker.SUB_BLOCK_SIZE);
    const hasReminder = PrimeWorker.SUB_BLOCK_SIZE * subBlockCount < data.size;
    if (hasReminder) {
      ++subBlockCount;
    }

    for (let i = 0; i < subBlockCount; ++i) {
      if (i === subBlockCount - 1 && hasReminder) {
        // If this is last block and its a reminder
        this.check(
          data.start + i * PrimeWorker.SUB_BLOCK_SIZE,
          data.start + data.size - 1,
        );
      } else {
        this.check(
          data.start + i * PrimeWorker.SUB_BLOCK_SIZE,
          data.start + ((i + 1) * PrimeWorker.SUB_BLOCK_SIZE - 1),
        );
      }
    }

    const end = process.hrtime(start);

    // Send results to parent thread
    parentPort.postMessage({
      type: ChildMessageType.BlockDone,
      data: {
        workerId: workerData.workerId,
        start: data.start,
        size: data.size,
        time: (end[0] * 1e9 + end[1]) / 1000000,
        primeNumbers: this.primes,
      },
    });
  }

  private check(start, limit) {
    // For start number to limit number
    for (let i = start; i < limit; ++i) {
      // If i is prime
      if (this.isPrime(i)) {
        // Store it
        this.primes.push(i);
      }
    }
  }

  private isPrime(n) {
    // Iterate from 2 to number N
    for (let i = 2; i < n; ++i) {
      // If number N % i is equal to 0, return false
      if (n % i === 0) {
        return false;
      }
    }
    return true;
  }
}

const primeWorker = new PrimeWorker();
