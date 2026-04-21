import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { getVersion } from "@tauri-apps/api/app";

export type UpdateState =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "up_to_date"; checkedAt: number }
  | { kind: "available"; version: string; notes: string; update: Update; checkedAt: number }
  | { kind: "downloading"; version: string; downloaded: number; total: number }
  | { kind: "installing"; version: string }
  | { kind: "error"; message: string; checkedAt: number };

export async function getAppVersion(): Promise<string> {
  try {
    return await getVersion();
  } catch {
    return "unknown";
  }
}

export async function checkForUpdate(): Promise<UpdateState> {
  try {
    const update = await check();
    const checkedAt = Date.now();
    if (!update) return { kind: "up_to_date", checkedAt };
    return {
      kind: "available",
      version: update.version,
      notes: update.body ?? "",
      update,
      checkedAt,
    };
  } catch (err) {
    return {
      kind: "error",
      message: err instanceof Error ? err.message : String(err),
      checkedAt: Date.now(),
    };
  }
}

export async function downloadAndInstall(
  update: Update,
  onProgress: (downloaded: number, total: number) => void,
): Promise<void> {
  let downloaded = 0;
  let total = 0;
  await update.downloadAndInstall((event) => {
    switch (event.event) {
      case "Started":
        total = event.data.contentLength ?? 0;
        onProgress(0, total);
        break;
      case "Progress":
        downloaded += event.data.chunkLength;
        onProgress(downloaded, total);
        break;
      case "Finished":
        onProgress(total, total);
        break;
    }
  });
  await relaunch();
}
