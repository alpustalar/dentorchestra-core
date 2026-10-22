import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import {
  removeOldestQuery,
  type PersistedClient,
} from '@tanstack/react-query-persist-client';

const DATABASE_NAME = 'mederp-offline-cache';
const DATABASE_VERSION = 1;
const STORE_NAME = 'query-cache';
const DATE_MARKER = '__mederp_date__';

export const OFFLINE_QUERY_CACHE_MAX_AGE = 1000 * 60 * 60 * 12;
export const OFFLINE_QUERY_CACHE_BUSTER = 'mederp-query-cache-v1';

type DateMarker = { [DATE_MARKER]: string };

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function runTransaction<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  const database = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, mode);
    const request = operation(transaction.objectStore(STORE_NAME));

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => database.close();
    transaction.onerror = () => {
      database.close();
      reject(transaction.error);
    };
  });
}

const indexedDbStorage =
  typeof indexedDB === 'undefined'
    ? undefined
    : {
        getItem: async (key: string) => {
          const value = await runTransaction('readonly', (store) =>
            store.get(key)
          );
          return typeof value === 'string' ? value : null;
        },
        setItem: (key: string, value: string) =>
          runTransaction('readwrite', (store) => store.put(value, key)).then(
            () => undefined
          ),
        removeItem: (key: string) =>
          runTransaction('readwrite', (store) => store.delete(key)).then(
            () => undefined
          ),
      };

function encode(value: unknown): unknown {
  if (value instanceof Date) return { [DATE_MARKER]: value.toISOString() };
  if (Array.isArray(value)) return value.map(encode);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [
        key,
        encode(nestedValue),
      ])
    );
  }
  return value;
}

function decode(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(decode);
  if (value && typeof value === 'object') {
    if (
      DATE_MARKER in value &&
      typeof (value as DateMarker)[DATE_MARKER] === 'string'
    ) {
      return new Date((value as DateMarker)[DATE_MARKER]);
    }
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [
        key,
        decode(nestedValue),
      ])
    );
  }
  return value;
}

export function makeOfflineQueryPersister() {
  return createAsyncStoragePersister({
    storage: indexedDbStorage,
    key: 'mederp-react-query-cache',
    throttleTime: 1_000,
    serialize: (client) => JSON.stringify(encode(client)),
    deserialize: (value) => decode(JSON.parse(value)) as PersistedClient,
    retry: removeOldestQuery,
  });
}
