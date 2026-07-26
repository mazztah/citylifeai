export interface SpatialItem<T> { x: number; y: number; radius: number; value: T }

export class SpatialHash<T> {
  private cells = new Map<string, SpatialItem<T>[]>();
  constructor(private cellSize = 96) {}
  clear() { this.cells.clear(); }
  insert(item: SpatialItem<T>) {
    const minX = Math.floor((item.x - item.radius) / this.cellSize);
    const maxX = Math.floor((item.x + item.radius) / this.cellSize);
    const minY = Math.floor((item.y - item.radius) / this.cellSize);
    const maxY = Math.floor((item.y + item.radius) / this.cellSize);
    for (let cy = minY; cy <= maxY; cy++) for (let cx = minX; cx <= maxX; cx++) {
      const key = `${cx}:${cy}`;
      const bucket = this.cells.get(key);
      if (bucket) bucket.push(item); else this.cells.set(key, [item]);
    }
  }
  query(x: number, y: number, radius: number): SpatialItem<T>[] {
    const out: SpatialItem<T>[] = [];
    const seen = new Set<SpatialItem<T>>();
    const minX = Math.floor((x - radius) / this.cellSize), maxX = Math.floor((x + radius) / this.cellSize);
    const minY = Math.floor((y - radius) / this.cellSize), maxY = Math.floor((y + radius) / this.cellSize);
    for (let cy = minY; cy <= maxY; cy++) for (let cx = minX; cx <= maxX; cx++) {
      for (const item of this.cells.get(`${cx}:${cy}`) ?? []) if (!seen.has(item)) { seen.add(item); out.push(item); }
    }
    return out;
  }
}
