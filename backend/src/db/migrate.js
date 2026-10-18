
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pool from "./pool.js";

const currentFile = fileURLToPath(import.meta.url);
const currentDir = path.dirname(currentFile);

async function migrate() {
  try {
    console.log("Starting Sapience database migration...");

    const schemaPath = path.resolve(
      currentDir,
      "../../../database/schema.sql"
    );

    const schema = await readFile(schemaPath, "utf8");

    await pool.query(schema);

    console.log("Database migration completed successfully.");
  } catch (error) {
    console.error("Migration failed:", error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

migrate();