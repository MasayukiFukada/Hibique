import { Low } from 'lowdb';
import { RoutineTask, AppSettings } from '../types';
import { initialTasks } from '../mockData';
import { ResetState, getCurrentResetState } from './resetLogic';

export interface DatabaseSchema {
  tasks: RoutineTask[];
  settings: AppSettings;
  resetState?: ResetState;
}

const defaultData: DatabaseSchema = {
  tasks: initialTasks,
  settings: {
    dayResetHour: 4, // 深夜4時リセット
  },
  resetState: getCurrentResetState(),
};

// ブラウザ環境用 LocalStorage アダプタ
class BrowserLocalStorageAdapter {
  private key: string;

  constructor(key: string) {
    this.key = key;
  }

  async read(): Promise<DatabaseSchema | null> {
    const raw = localStorage.getItem(this.key);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as DatabaseSchema;
    } catch (err) {
      console.error('Failed to parse localStorage data:', err);
      return null;
    }
  }

  async write(data: DatabaseSchema): Promise<void> {
    localStorage.setItem(this.key, JSON.stringify(data, null, 2));
  }
}

// Tauri FS アダプタ（Tauri実行時）
class TauriFsAdapter {
  private filename: string;

  constructor(filename: string = 'hibique_data.json') {
    this.filename = filename;
  }

  async read(): Promise<DatabaseSchema | null> {
    try {
      const { readTextFile, BaseDirectory, exists } = await import('@tauri-apps/plugin-fs');
      const fileExists = await exists(this.filename, { baseDir: BaseDirectory.AppConfig });
      if (!fileExists) {
        return null;
      }
      const content = await readTextFile(this.filename, { baseDir: BaseDirectory.AppConfig });
      return JSON.parse(content) as DatabaseSchema;
    } catch (err) {
      console.warn('Tauri FS read error (falling back to default):', err);
      return null;
    }
  }

  async write(data: DatabaseSchema): Promise<void> {
    try {
      const { writeTextFile, BaseDirectory, mkdir, exists } = await import('@tauri-apps/plugin-fs');
      const dirExists = await exists('', { baseDir: BaseDirectory.AppConfig });
      if (!dirExists) {
        await mkdir('', { baseDir: BaseDirectory.AppConfig, recursive: true });
      }
      await writeTextFile(this.filename, JSON.stringify(data, null, 2), {
        baseDir: BaseDirectory.AppConfig,
      });
    } catch (err) {
      console.error('Tauri FS write error:', err);
    }
  }
}

// Tauri実行環境かどうかの判定
const isTauriEnvironment = (): boolean => {
  return typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window);
};

// Lowdb インスタンスの生成
export const createDbInstance = () => {
  const isTauri = isTauriEnvironment();
  const adapter = isTauri
    ? new TauriFsAdapter('hibique_data.json')
    : new BrowserLocalStorageAdapter('hibique_db_v1');

  return new Low<DatabaseSchema>(adapter, defaultData);
};

export const db = createDbInstance();

// ヘルパー関数群
export async function initializeDatabase(): Promise<DatabaseSchema> {
  await db.read();
  if (!db.data || !db.data.tasks || db.data.tasks.length === 0) {
    db.data = defaultData;
    await db.write();
  }
  return db.data;
}

export async function persistDatabase(): Promise<void> {
  await db.write();
}
