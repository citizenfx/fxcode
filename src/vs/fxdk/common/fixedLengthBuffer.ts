import { IDisposable } from "vs/base/common/lifecycle";

export type FixedLiengthBufferRemoveListener<ItemType> = (item: ItemType) => void;

export class FixedLengthBuffer<ItemType> implements IDisposable {
  protected nextKey = 0;
  protected firstKey = 0;
  protected currentLength = 0;
  protected buffer: Record<number, ItemType> = Object.create(null);
  protected removeListeners: Set<FixedLiengthBufferRemoveListener<ItemType>> = new Set();

  constructor(
    protected readonly maxLength: number,
  ) { }

  get length(): number {
    return this.currentLength;
  }

	reset() {
		this.nextKey = 0;
		this.firstKey = 0;
		this.currentLength = 0;
		this.buffer = Object.create(null);
	}

  push(...items: ItemType[]) {
    for (const item of items) {
      this.pushOne(item);
    }
  }

  onRemove(listener: FixedLiengthBufferRemoveListener<ItemType>) {
    this.removeListeners.add(listener);
  }

  dispose() {
    this.buffer = {};
    this.removeListeners = new Set();
  }

  protected pushOne(item: ItemType) {
    if (this.currentLength >= this.maxLength) {
      const keyToDrop = this.firstKey++;
      const itemToDrop = this.buffer[keyToDrop];

      delete this.buffer[keyToDrop];

      this.removeListeners.forEach((listener) => listener(itemToDrop));
    } else {
      this.currentLength++;
    }

    const key = this.nextKey++;

    this.buffer[key] = item;
  }
}
