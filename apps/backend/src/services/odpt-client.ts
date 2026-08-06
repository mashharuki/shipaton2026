import type { TRAIN_STATUSES } from "shared";

type TrainStatusValue = (typeof TRAIN_STATUSES)[number];

type OdptTrainStatus = {
  status: TrainStatusValue;
  delayMinutes: number;
};

export type OdptFetchResult =
  | { ok: true; data: OdptTrainStatus }
  | { ok: false; reason: "not_found" }
  | { ok: false; reason: "unavailable" };

/**
 * MVP scope is single-line (RAIL_CHUO, task 2.3's dataset generation) --
 * this is our own internal railwayId space, distinct from ODPT's
 * `odpt.Railway:*` resource identifiers, so the map doubles as that
 * translation. A railwayId missing from this map is treated as out of
 * MVP scope (`not_found`) without ever contacting ODPT.
 */
const ODPT_RAILWAY_IDS: Record<string, string> = {
  RAIL_CHUO: "odpt.Railway:JR-East.ChuoRapid",
};

const ODPT_BASE_URL = "https://api.odpt.org/api/v4/odpt:TrainInformation";

type OdptMultilingualText = { ja?: string; en?: string } | string;

type OdptTrainInformationEntry = {
  "odpt:trainInformationStatus"?: OdptMultilingualText;
  "odpt:trainInformationText"?: OdptMultilingualText;
};

function extractJa(value: OdptMultilingualText | undefined): string {
  if (typeof value === "string") {
    return value;
  }
  return value?.ja ?? "";
}

function parseDelayMinutes(text: string): number {
  const match = text.match(/(\d+)\s*分/);
  return match ? Number(match[1]) : 0;
}

function toTrainStatus(entries: OdptTrainInformationEntry[]): OdptTrainStatus {
  const entry = entries[0];
  if (!entry) {
    // Some ODPT operators only publish an entry when there is something to
    // report -- an empty result for a known railway is treated as normal
    // operation rather than an error.
    return { status: "normal", delayMinutes: 0 };
  }

  const statusText = extractJa(entry["odpt:trainInformationStatus"]);
  if (statusText.includes("見合わせ") || statusText.includes("運休")) {
    return { status: "suspended", delayMinutes: 0 };
  }
  if (statusText === "" || statusText.includes("平常")) {
    return { status: "normal", delayMinutes: 0 };
  }

  const infoText = extractJa(entry["odpt:trainInformationText"]);
  return {
    status: "delayed",
    delayMinutes: parseDelayMinutes(infoText || statusText),
  };
}

export async function fetchTrainInformation(
  env: { ODPT_TOKEN: string },
  railwayId: string,
): Promise<OdptFetchResult> {
  const odptRailwayId = ODPT_RAILWAY_IDS[railwayId];
  if (!odptRailwayId) {
    return { ok: false, reason: "not_found" };
  }

  const url = new URL(ODPT_BASE_URL);
  url.searchParams.set("odpt:railway", odptRailwayId);
  url.searchParams.set("acl:consumerKey", env.ODPT_TOKEN);

  try {
    const response = await fetch(url.toString());
    if (!response.ok) {
      return { ok: false, reason: "unavailable" };
    }
    const entries = (await response.json()) as OdptTrainInformationEntry[];
    return { ok: true, data: toTrainStatus(entries) };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}
