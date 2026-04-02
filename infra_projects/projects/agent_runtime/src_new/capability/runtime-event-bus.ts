import type { RuntimeEvent } from "./runtime-event.js";

export interface RuntimeEventListener {
  onEvent(event: RuntimeEvent): Promise<void> | void;
}

export class RuntimeEventBus {
  private readonly listeners: Set<RuntimeEventListener>;

  constructor(initialListeners: RuntimeEventListener[] = []) {
    this.listeners = new Set(initialListeners);
  }

  subscribe(listener: RuntimeEventListener): void {
    this.listeners.add(listener);
  }

  unsubscribe(listener: RuntimeEventListener): void {
    this.listeners.delete(listener);
  }

  async publish(event: RuntimeEvent): Promise<void> {
    for (const listener of [...this.listeners]) {
      await listener.onEvent(event);
    }
  }
}
