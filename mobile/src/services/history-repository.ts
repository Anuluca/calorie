import { Capacitor } from "@capacitor/core";
import { Preferences } from "@capacitor/preferences";
import type { FoodQueryResult } from "@/types";

const storageKey = "calorie-history-v1";
const databaseName = "calorie_history";

interface HistoryBackend {
  list(): Promise<FoodQueryResult[]>;
  add(item: FoodQueryResult): Promise<void>;
  remove(id: string): Promise<void>;
  clear(): Promise<void>;
}

const preferencesBackend: HistoryBackend = {
  async list() {
    const { value } = await Preferences.get({ key: storageKey });
    if (!value) return [];

    try {
      const parsed = JSON.parse(value) as FoodQueryResult[];
      const retained = parsed.slice(0, 200);
      if (retained.length !== parsed.length) {
        await Preferences.set({ key: storageKey, value: JSON.stringify(retained) });
      }
      return retained;
    } catch {
      return [];
    }
  },
  async add(item) {
    const existing = await this.list();
    const next = [item, ...existing].slice(0, 200);
    await Preferences.set({ key: storageKey, value: JSON.stringify(next) });
  },
  async remove(id) {
    const existing = await this.list();
    const next = existing.filter((item) => item.id !== id);
    await Preferences.set({ key: storageKey, value: JSON.stringify(next) });
  },
  async clear() {
    await Preferences.remove({ key: storageKey });
  }
};

async function createNativeBackend(): Promise<HistoryBackend> {
  const { CapacitorSQLite, SQLiteConnection } = await import(
    "@capacitor-community/sqlite"
  );
  const sqlite = new SQLiteConnection(CapacitorSQLite);
  const db = await sqlite.createConnection(
    databaseName,
    false,
    "no-encryption",
    1,
    false
  );

  await db.open();
  await db.execute(`
    CREATE TABLE IF NOT EXISTS food_history (
      id TEXT PRIMARY KEY NOT NULL,
      payload TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
  `);

  async function pruneHistoryRows() {
    const result = await db.query(
      "SELECT id FROM food_history ORDER BY created_at DESC"
    );
    const excessIds = (result.values ?? [])
      .slice(200)
      .map((row) => String(row.id));

    for (const id of excessIds) {
      await db.run("DELETE FROM food_history WHERE id = ?", [id]);
    }
  }

  return {
    async list() {
      await pruneHistoryRows();
      const result = await db.query(
        "SELECT payload FROM food_history ORDER BY created_at DESC LIMIT 200"
      );
      return (result.values ?? []).flatMap((row) => {
        try {
          return [JSON.parse(String(row.payload)) as FoodQueryResult];
        } catch {
          return [];
        }
      });
    },
    async add(item) {
      await db.run(
        "INSERT OR REPLACE INTO food_history (id, payload, created_at) VALUES (?, ?, ?)",
        [item.id, JSON.stringify(item), item.createdAt]
      );
      // 查询历史上限为 200 条，同时清理 SQLite 中不再展示的旧记录。
      await pruneHistoryRows();
    },
    async remove(id) {
      await db.run("DELETE FROM food_history WHERE id = ?", [id]);
    },
    async clear() {
      await db.execute("DELETE FROM food_history;");
    }
  };
}

let backendPromise: Promise<HistoryBackend> | null = null;

async function backend(): Promise<HistoryBackend> {
  if (!backendPromise) {
    backendPromise =
      Capacitor.getPlatform() === "web"
        ? Promise.resolve(preferencesBackend)
        : createNativeBackend().catch(() => preferencesBackend);
  }
  return backendPromise;
}

export const historyRepository = {
  async list() {
    return (await backend()).list();
  },
  async add(item: FoodQueryResult) {
    return (await backend()).add(item);
  },
  async remove(id: string) {
    return (await backend()).remove(id);
  },
  async clear() {
    return (await backend()).clear();
  }
};
