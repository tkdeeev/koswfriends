import { randomInt } from "node:crypto";
export function externalUsername(name: string, retry = false) {
  const letters = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");
  let username = (letters || "user").slice(0, retry ? 5 : 9);
  while (username.length < 9)
    username += String.fromCharCode(97 + randomInt(26));
  return username;
}
