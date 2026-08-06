import {
  type AppError,
  congestionDatasetPayloadSchema,
  correctionDatasetPayloadSchema,
  createAppError,
  createDatasetResponseSchema,
  err,
  ok,
  type Result,
  timetableDatasetPayloadSchema,
} from "shared";
import type { ZodType } from "zod";

import { apiRequest } from "@/lib/api-client";
import { API_BASE_URL } from "@/lib/config";
import type {
  CongestionDatasetPayload,
  CorrectionDatasetPayload,
  DatasetStore,
  TimetableDatasetPayload,
} from "./dataset-store";

// design.md line 545: "データセット payload はスキーマバージョン
// (schemaVersion) を持ち、クライアントは未知バージョンを拒否して旧データで
// 継続する（前方互換）" -- bump these only when this client build actually
// gained support for reading the new shape.
const SUPPORTED_SCHEMA_VERSIONS = {
  timetable: 1,
  congestion: 1,
  correction: 1,
} as const;

// 5.8/15.2/15.3: syncs the 3 datasets from the backend into local storage
// (full replace on every version bump per design.md -- "データ量が小さい
// ため差分適用は行わない"), and continues serving whatever was already
// stored when sync fails (offline, server error, etc: 15.1/15.2).
export async function syncDatasets(store: DatasetStore): Promise<void> {
  await syncOne(
    store,
    "timetable",
    timetableDatasetPayloadSchema,
    (version, payload) => store.replaceTimetable(version, payload),
  );
  await syncOne(
    store,
    "congestion",
    congestionDatasetPayloadSchema,
    (version, payload) => store.replaceCongestion(version, payload),
  );
  await syncOne(
    store,
    "correction",
    correctionDatasetPayloadSchema,
    (version, payload) => store.replaceCorrection(version, payload),
  );
}

async function syncOne<T extends { schemaVersion: number }>(
  store: DatasetStore,
  name: "timetable" | "congestion" | "correction",
  payloadSchema: ZodType<T>,
  replace: (version: string, payload: T) => Promise<void>,
): Promise<void> {
  const meta = await store.getMeta(name);
  const query = meta ? `?since=${encodeURIComponent(meta.version)}` : "";
  const responseSchema = createDatasetResponseSchema(payloadSchema);
  const result = await apiRequest(
    `${API_BASE_URL}/v1/datasets/${name}${query}`,
    responseSchema,
  );

  if (!result.ok) {
    // Sync failure (offline, server down, etc.) -- keep whatever is already
    // stored and try again on the next sync cycle (15.1/15.2).
    return;
  }
  if ("notModified" in result.data) {
    return;
  }
  if (result.data.payload.schemaVersion !== SUPPORTED_SCHEMA_VERSIONS[name]) {
    // Unknown/newer schema this client build can't read -- reject and keep
    // serving the existing data rather than storing a shape we can't parse
    // back out later (forward compatibility, design.md line 545).
    return;
  }
  await replace(result.data.version, result.data.payload);
}

function missingDatasetError(name: string): AppError {
  return createAppError("dataset_missing", `${name} dataset not synced yet`);
}

export async function getTimetableData(
  store: DatasetStore,
): Promise<Result<TimetableDatasetPayload, AppError>> {
  const meta = await store.getMeta("timetable");
  if (!meta) {
    return err(missingDatasetError("timetable"));
  }
  return ok(await store.getTimetable());
}

export async function getCongestionData(
  store: DatasetStore,
): Promise<Result<CongestionDatasetPayload, AppError>> {
  const meta = await store.getMeta("congestion");
  if (!meta) {
    return err(missingDatasetError("congestion"));
  }
  return ok(await store.getCongestion());
}

export async function getCorrectionData(
  store: DatasetStore,
): Promise<Result<CorrectionDatasetPayload, AppError>> {
  const meta = await store.getMeta("correction");
  if (!meta) {
    return err(missingDatasetError("correction"));
  }
  return ok(await store.getCorrection());
}
