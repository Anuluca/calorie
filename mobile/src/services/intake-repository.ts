import { Capacitor } from "@capacitor/core";
import { Preferences } from "@capacitor/preferences";
import type { IntakeRecord } from "@/types";
import {
  intakeCutoffDateKey,
  retainRecentIntakeRecords
} from "@/services/intake-domain";

const storageKey = "calorie-intake-records-v1";
const databaseName = "calorie_intake";

interface IntakeBackend {
  list(): Promise<IntakeRecord[]>;
  add(record: IntakeRecord): Promise<void>;
  remove(id: string): Promise<void>;
  clear(): Promise<void>;
}

function normalizeRecord(record: IntakeRecord): IntakeRecord {
  if (record.kind !== "adjustment") return record;

  return {
    ...record,
    increaseCalories: record.increaseCalories ?? Math.max(record.calories, 0),
    decreaseCalories: record.decreaseCalories ?? Math.max(-record.calories, 0)
  };
}

const preferencesBackend: IntakeBackend = {
  async list() {
    const { value } = await Preferences.get({ key: storageKey });
    if (!value) return [];

    try {
      const parsed = (JSON.parse(value) as IntakeRecord[]).map(normalizeRecord);
      const retained = retainRecentIntakeRecords(parsed);
      if (retained.length !== parsed.length) {
        await Preferences.set({ key: storageKey, value: JSON.stringify(retained) });
      }
      return retained;
    } catch {
      return [];
    }
  },
  async add(record) {
    const records = retainRecentIntakeRecords([record, ...(await this.list())]);
    await Preferences.set({
      key: storageKey,
      value: JSON.stringify(records)
    });
  },
  async remove(id) {
    const records = (await this.list()).filter((record) => record.id !== id);
    await Preferences.set({
      key: storageKey,
      value: JSON.stringify(records)
    });
  },
  async clear() {
    await Preferences.remove({ key: storageKey });
  }
};

async function createNativeBackend(): Promise<IntakeBackend> {
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
    CREATE TABLE IF NOT EXISTS intake_records (
      id TEXT PRIMARY KEY NOT NULL,
      date_key TEXT NOT NULL,
      kind TEXT NOT NULL,
      name TEXT,
      quantity_text TEXT,
      calories INTEGER NOT NULL,
      increase_calories INTEGER,
      decrease_calories INTEGER,
      note TEXT,
      source_result_id TEXT,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS intake_records_date_idx
      ON intake_records (date_key DESC, created_at DESC);
  `);

  // 为已安装版本补齐新字段，保留既有摄入与校准记录。
  const columnResult = await db.query("PRAGMA table_info(intake_records)");
  const columnNames = new Set(
    (columnResult.values ?? []).map((column) => String(column.name))
  );
  if (!columnNames.has("increase_calories")) {
    await db.execute("ALTER TABLE intake_records ADD COLUMN increase_calories INTEGER;");
  }
  if (!columnNames.has("decrease_calories")) {
    await db.execute("ALTER TABLE intake_records ADD COLUMN decrease_calories INTEGER;");
  }

  return {
    async list() {
      await db.run("DELETE FROM intake_records WHERE date_key < ?", [
        intakeCutoffDateKey()
      ]);
      const result = await db.query(`
        SELECT id, date_key, kind, name, quantity_text, calories,
               increase_calories, decrease_calories, note,
               source_result_id, created_at
        FROM intake_records
        ORDER BY date_key DESC, created_at DESC
      `);

      return (result.values ?? []).flatMap((row): IntakeRecord[] => {
        const common = {
          id: String(row.id),
          dateKey: String(row.date_key),
          calories: Number(row.calories),
          createdAt: Number(row.created_at)
        };

        if (row.kind === "food") {
          return [{
            ...common,
            kind: "food",
            name: String(row.name ?? "未命名食物"),
            quantityText: String(row.quantity_text ?? "1份"),
            sourceResultId: String(row.source_result_id ?? "")
          }];
        }

        if (row.kind === "adjustment") {
          const increaseCalories = row.increase_calories == null
            ? Math.max(common.calories, 0)
            : Number(row.increase_calories);
          const decreaseCalories = row.decrease_calories == null
            ? Math.max(-common.calories, 0)
            : Number(row.decrease_calories);
          return [{
            ...common,
            kind: "adjustment",
            increaseCalories,
            decreaseCalories,
            note: String(row.note ?? "热量校准")
          }];
        }

        return [];
      });
    },
    async add(record) {
      await db.run(
        `INSERT INTO intake_records
          (id, date_key, kind, name, quantity_text, calories,
           increase_calories, decrease_calories, note, source_result_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          record.id,
          record.dateKey,
          record.kind,
          record.kind === "food" ? record.name : null,
          record.kind === "food" ? record.quantityText : null,
          record.calories,
          record.kind === "adjustment" ? record.increaseCalories ?? 0 : null,
          record.kind === "adjustment" ? record.decreaseCalories ?? 0 : null,
          record.kind === "adjustment" ? record.note : null,
          record.kind === "food" ? record.sourceResultId : null,
          record.createdAt
        ]
      );
      await db.run("DELETE FROM intake_records WHERE date_key < ?", [
        intakeCutoffDateKey()
      ]);
    },
    async remove(id) {
      await db.run("DELETE FROM intake_records WHERE id = ?", [id]);
    },
    async clear() {
      await db.execute("DELETE FROM intake_records;");
    }
  };
}

let backendPromise: Promise<IntakeBackend> | null = null;

async function backend(): Promise<IntakeBackend> {
  if (!backendPromise) {
    backendPromise =
      Capacitor.getPlatform() === "web"
        ? Promise.resolve(preferencesBackend)
        : createNativeBackend().catch(() => preferencesBackend);
  }
  return backendPromise;
}

export const intakeRepository = {
  async list() {
    return (await backend()).list();
  },
  async add(record: IntakeRecord) {
    return (await backend()).add(record);
  },
  async remove(id: string) {
    return (await backend()).remove(id);
  },
  async clear() {
    return (await backend()).clear();
  }
};
