import { readFileSync, writeFileSync } from "fs";

const env = Object.fromEntries(
  readFileSync(".env", "utf-8")
    .split("\n")
    .filter((line) => line.includes("="))
    .map((line) => {
      const [key, ...rest] = line.split("=");
      return [key.trim(), rest.join("=").trim()];
    })
);

const config = `window.CONFIG = {
  SUPABASE_URL: "${env.SUPABASE_URL}",
  SUPABASE_ANON_KEY: "${env.SUPABASE_ANON_KEY}",
};
`;

writeFileSync("js/config.js", config);
console.log("Generated js/config.js from .env");
