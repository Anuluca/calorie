import { Capacitor } from "@capacitor/core";
import { Preferences } from "@capacitor/preferences";
import type { IntakeRecord } from "@/types";

const storageKey = "calorie-intake-records-v1";
const databaseName = "calorie_intake";

interface IntakeBackend {
  list(): Promise<IntakeRecord[]>;
  add(record: IntakeRecord): Promise<void>;
}

const preferencesBackend: IntakeBackend = {
  async list() {
    const { value } = await Preferences.get({ key: storageKey });
    if (!value) return [];

    try {
      return JSON.parse(value) as IntakeRecord[];
    } catch {
      return [];
    }
  },
  async add(record) {
    const records = await this.list();
    await Preferences.set({
      key: storageKey,
      value: JSON.stringify([record, ...records])
    });
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
      note TEXT,
      source_result_id TEXT,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS intake_records_date_idx
      ON intake_records (date_key DESC, created_at DESC);
  `);

  return {
    async list() {
      const result = await db.query(`
        SELECT id, date_key, kind, name, quantity_text, calories, note,
               source_result_id, created_at
        FROM intake_records
        ORDER BY date_key DESC, created_at DESC
        LIMIT 2000
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
          return [{
            ...common,
            kind: "adjustment",
            note: String(row.note ?? "热量校准")
          }];
        }

        return [];
      });
    },
    async add(record) {
      await db.run(
        `INSERT INTO intake_records
          (id, date_key, kind, name, quantity_text, calories, note,
           source_result_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          record.id,
          record.dateKey,
          record.kind,
          record.kind === "food" ? record.name : null,
          record.kind === "food" ? record.quantityText : null,
          record.calories,
          record.kind === "adjustment" ? record.note : null,
          record.kind === "food" ? record.sourceResultId : null,
          record.createdAt
        ]
      );
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
  }
};
