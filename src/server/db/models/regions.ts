import { Database } from 'better-sqlite3';
import { Region, RegionTreeItem } from '@shared/types';

export class RegionModel {
  constructor(private db: Database) {}

  createRegion(data: {
    name: string;
    parent_id?: number | null;
    type?: number;
    lat?: number | null;
    lon?: number | null;
    external_fs_bezirk_id?: number | null;
  }): Region {
    const stmt = this.db.prepare(`
      INSERT INTO fs_bezirk (name, parent_id, type, lat, lon, external_fs_bezirk_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      data.name,
      data.parent_id ?? null,
      data.type ?? 1,
      data.lat ?? null,
      data.lon ?? null,
      data.external_fs_bezirk_id ?? null
    );

    const newId = Number(result.lastInsertRowid);
    this.refreshClosureForNode(newId, data.parent_id ?? null);

    return this.getRegionById(newId)!;
  }

  getRegionById(id: number): Region | null {
    const stmt = this.db.prepare('SELECT * FROM fs_bezirk WHERE id = ?');
    return (stmt.get(id) as Region) || null;
  }

  getAllRegions(): Region[] {
    const stmt = this.db.prepare('SELECT * FROM fs_bezirk ORDER BY type ASC, name ASC');
    return stmt.all() as Region[];
  }

  // Returns all ancestor region IDs (including self)
  getRegionAncestorIds(regionId: number): number[] {
    const stmt = this.db.prepare(`
      WITH RECURSIVE RegionTree AS (
        SELECT id, parent_id FROM fs_bezirk WHERE id = ?
        UNION ALL
        SELECT b.id, b.parent_id FROM fs_bezirk b
        JOIN RegionTree rt ON b.id = rt.parent_id
      )
      SELECT id FROM RegionTree
    `);
    const rows = stmt.all(regionId) as { id: number }[];
    return rows.map(r => r.id);
  }

  // Returns all descendant region IDs (including self)
  getRegionDescendantIds(regionId: number): number[] {
    const stmt = this.db.prepare(`
      WITH RECURSIVE RegionTree AS (
        SELECT id FROM fs_bezirk WHERE id = ?
        UNION ALL
        SELECT b.id FROM fs_bezirk b
        JOIN RegionTree rt ON b.parent_id = rt.id
      )
      SELECT id FROM RegionTree
    `);
    const rows = stmt.all(regionId) as { id: number }[];
    return rows.map(r => r.id);
  }

  getTree(): RegionTreeItem[] {
    const regions = this.getAllRegions();
    const map = new Map<number, RegionTreeItem>();
    const roots: RegionTreeItem[] = [];

    for (const r of regions) {
      map.set(r.id, { ...r, children: [] });
    }

    for (const r of regions) {
      const item = map.get(r.id)!;
      if (r.parent_id && map.has(r.parent_id)) {
        map.get(r.parent_id)!.children!.push(item);
      } else {
        roots.push(item);
      }
    }

    return roots;
  }

  private refreshClosureForNode(nodeId: number, parentId: number | null): void {
    // Insert self-reference
    this.db.prepare(`
      INSERT OR IGNORE INTO fs_bezirk_closure (ancestor_id, descendant_id, depth)
      VALUES (?, ?, 0)
    `).run(nodeId, nodeId);

    if (parentId !== null) {
      // Copy ancestor relationships from parent with depth + 1
      this.db.prepare(`
        INSERT OR IGNORE INTO fs_bezirk_closure (ancestor_id, descendant_id, depth)
        SELECT ancestor_id, ?, depth + 1
        FROM fs_bezirk_closure
        WHERE descendant_id = ?
      `).run(nodeId, parentId);
    }
  }
}
