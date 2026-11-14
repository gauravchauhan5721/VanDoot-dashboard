// Static preview of the same application. Local API routes remain in the repository.
import { mkdtemp, cp, writeFile, symlink, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
const root = process.cwd();
const target = await mkdtemp(join(tmpdir(), "vandoot-preview-"));
try {
  for (const file of [
    "src",
    "public",
    "package.json",
    "tsconfig.json",
    "postcss.config.mjs",
    "next-env.d.ts",
  ])
    await cp(join(root, file), join(target, file), { recursive: true });
  await rm(join(target, "src/app/api"), { recursive: true });
  await symlink(
    join(root, "node_modules"),
    join(target, "node_modules"),
    "dir",
  );
  await writeFile(
    join(target, "next.config.mjs"),
    `export default {output:'export',images:{unoptimized:true},turbopack:{root:${JSON.stringify(root)}}};`,
  );
  const result = spawnSync(
    process.execPath,
    [join(root, "node_modules/next/dist/bin/next"), "build", "--webpack"],
    {
      cwd: target,
      stdio: "inherit",
      env: { ...process.env, NEXT_PUBLIC_STATIC_PREVIEW: "1" },
    },
  );
  if (result.status !== 0) throw Error("Preview build failed");
  await rm(resolve(root, "dist"), { recursive: true, force: true });
  await cp(join(target, "out"), join(root, "dist"), { recursive: true });
} finally {
  await rm(target, { recursive: true, force: true });
}
