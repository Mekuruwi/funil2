import type { IpcMainInvokeEvent } from 'electron';

export type IpcRegistrar = <TArgs extends unknown[]>(
  channel: string,
  handler: (event: IpcMainInvokeEvent, ...args: TArgs) => unknown,
) => void;
