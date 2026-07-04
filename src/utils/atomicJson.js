import fs from "fs-extra";
import path from "path";

export async function writeJsonAtomic(filePath, data, options = {}) {
  const spaces = options.spaces ?? 2;
  const tmpPath = `${filePath}.tmp`;
  await fs.ensureDir(path.dirname(filePath));
  await fs.writeFile(tmpPath, JSON.stringify(data, null, spaces), "utf8");
  await fs.move(tmpPath, filePath, { overwrite: true });
}

export async function readJsonSafe(filePath, fallback) {
  try {
    return await fs.readJSON(filePath);
  } catch {
    return fallback;
  }
}
