import { Worker } from 'worker_threads';
import { ChildMessageType, ParentMessageType } from './enums';

export class WorkerHost {
  private worker: Worker;
  private readonly workerId: number;
  private blockResult: any[] = [];
  private _isProcessingBlock: boolean = false;
  get isProcessingBlock(): boolean {
    return this._isProcessingBlock;
  }

  constructor(workerData: any) {
    this.workerId = workerData.workerId;
    this.worker = new Worker('./src/proxy.js', { workerData });
    this.bindSystemMessages();
    this.bindMessages();
  }

  private bindSystemMessages(): void {
    this.worker.on('online', () => {
      console.log(`[Main] Worker ${this.workerId} is online`);
    });

    this.worker.on('error', error => {
      console.log(
        `[Main] Worker ${this.workerId} catch an error ${
          error.stack || JSON.stringify(error)
        }`,
      );
    });

    this.worker.on('exit', code => {
      console.log(`[Main] Worker ${this.workerId} exited with code ${code}`);
    });
  }

  private bindMessages(): void {
    this.worker.on('message', message => {
      switch (message.type) {
        case ChildMessageType.BlockDone: {
          this.blockResult.push(message.data);
          this._isProcessingBlock = false;
          break;
        }
        default: {
          break;
        }
      }
    });
  }

  public sendBlockToProcess(start: any, size: number): void {
    this._isProcessingBlock = true;
    this.worker.postMessage({
      type: ParentMessageType.ProcessNewBlock,
      data: { start, size },
    });
  }

  public sendKill(): void {
    this.worker.postMessage({ type: ParentMessageType.Kill });
  }

  public getBlockResults(): any[] {
    const results = this.blockResult;
    this.blockResult = [];
    return results;
  }
}
