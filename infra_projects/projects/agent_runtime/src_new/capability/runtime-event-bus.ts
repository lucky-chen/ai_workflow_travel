import type { RuntimeEvent, RuntimeEventCallback } from "./runtime-event.js";

export interface RuntimeEventListener {
  onEvent(event: RuntimeEvent): Promise<void>;
}

export class RuntimeEventBus {
  constructor(private readonly listeners: RuntimeEventListener[]) {}

  async publish(event: RuntimeEvent): Promise<void> {
    for (const listener of this.listeners) {
      await listener.onEvent(event);
    }
  }
}

export class CallbackRuntimeEventListener implements RuntimeEventListener {
  constructor(private readonly callback: RuntimeEventCallback) {}

  async onEvent(event: RuntimeEvent): Promise<void> {
    await this.callback.onEvent(event);
  }
}
