import { WorkerHost } from './worker-host';
import { Utils } from './utils';
import Colors = require('colors');

export class Core {
  // Number of thread to instanciate
  private static readonly THREAD_COUNT = 8;
  // Size of a block to process (from n to n + BLOCK_SIZE)
  private static readonly BLOCK_SIZE = 2500;
  // Max number to search for primes
  private static readonly MAX_NUMBER = 1000000;

  // Worker handle array
  private static workers: WorkerHost[] = [];
  // Array of block start
  private static alreadyProcessedBlocks: number[] = [];
  // Array of block results
  private static blockResults: any[] = [];

  // Must loop
  private static mustLoop: boolean = true;
  // Block processing cumulative time
  private static timeCumulation: number = 0;
  // Total number of primes numbers found
  private static totalFoundPrimes: number = 0;
  // Start of processing (realtime)
  private static start: any;
  // Time of processing (realtime)
  private static realtime: any;
  // Is primes processing over
  private static isOver: boolean = false;

  public static async init(): Promise<void> {
    console.log(`[Main] Run in ${process.env.NODE_ENV.trim()} env`);

    // Instantiate Workers
    for (let i = 0; i < Core.THREAD_COUNT; ++i) {
      Core.workers.push(new WorkerHost({ workerId: i + 1 }));
    }

    // Wait for all workers online, to not add wait time to execution time
    await Utils.sleep(2000);
  }

  public static async loop(): Promise<void> {
    Core.start = process.hrtime();
    // Loop during the process
    while (Core.mustLoop) {
      // For each thread
      for (let i = 0; i < Core.workers.length; ++i) {
        // Check if some has block results
        const processedBlocks = Core.workers[i].getBlockResults();

        if (processedBlocks.length > 0) {
          // If block result is the last one
          if (
            processedBlocks[0].start + processedBlocks[0].size >
            Core.MAX_NUMBER
          ) {
            Core.isOver = true;
          }

          // Add this block primes numbers count to Core.totalFoundPrimes
          Core.totalFoundPrimes += processedBlocks[0].primeNumbers.length;

          // Add this block processing time to Core.timeCumulation
          Core.timeCumulation += processedBlocks[0].time;

          // Log this block results
          console.log(
            '[Main] Worker [' +
              Colors.red(processedBlocks[0].workerId) +
              '] From [' +
              Colors.yellow(processedBlocks[0].start) +
              '] To [' +
              Colors.yellow(
                processedBlocks[0].start + processedBlocks[0].size,
              ) +
              '] Found [' +
              Colors.green(processedBlocks[0].primeNumbers.length) +
              '] primes in ' +
              Colors.cyan(processedBlocks[0].time.toFixed(3)) +
              ' ms',
          );

          // Store this block results
          Core.blockResults = Core.blockResults.concat(processedBlocks);
        }
        // If last block created is less than Core.MAX_NUMBER
        if (
          Core.alreadyProcessedBlocks.length === 0 ||
          Core.alreadyProcessedBlocks[Core.alreadyProcessedBlocks.length - 1] <
            Core.MAX_NUMBER
        ) {
          // If worker is not processing a block
          if (!Core.workers[i].isProcessingBlock) {
            // Send him a block to process
            Core.workers[i].sendBlockToProcess(
              Core.getBlockToProcess(),
              Core.BLOCK_SIZE,
            );
          }
        }
        // If last block to process have been processed, Core.isOver === true
        if (Core.isOver) {
          const end = process.hrtime(Core.start);
          Core.realtime = (end[0] * 1e9 + end[1]) / 1000000;
          const timeFaster = Core.timeCumulation / Core.realtime;
          console.log(
            '[Main] Results : From [' +
              Colors.yellow('2') +
              '] To [' +
              Colors.yellow(this.MAX_NUMBER.toString()) +
              '] Found [' +
              Colors.green(Core.totalFoundPrimes.toString()) +
              '] Primes in ' +
              Colors.cyan((Core.realtime / 1000).toFixed(3)) +
              ' s (Real Time) and in ' +
              Colors.cyan((Core.timeCumulation / 1000).toFixed(3)) +
              ' s (Cumulative Time) | ' +
              Colors.green(this.THREAD_COUNT.toString()) +
              ' Thread(s) are ' +
              Colors.green(timeFaster.toFixed(2)) +
              'x Faster than 1 Thread | Longer is the processing, better is the gain !',
          );

          // Kill all thread
          for (let j = 0; j < Core.workers.length; ++j) {
            Core.workers[j].sendKill();
          }

          console.log('[Main] Main Thread exit');
          return;
        }
      }
      // Sleep to allow this thread to I/O
      await Utils.sleep(1);
    }
  }

  private static getBlockToProcess(): number {
    let newBlock;
    // If there is already created block
    if (Core.alreadyProcessedBlocks.length > 0) {
      newBlock =
        Core.alreadyProcessedBlocks[Core.alreadyProcessedBlocks.length - 1] +
        Core.BLOCK_SIZE;
    } else {
      // Start with 2.
      newBlock = 2;
    }
    Core.alreadyProcessedBlocks.push(newBlock);
    return newBlock;
  }
}

(async () => {
  await Core.init();
  await Core.loop();
})();
