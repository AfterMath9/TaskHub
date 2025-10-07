const displayName = (input) => {
  if (!input) return "";
  if (typeof input === "string") return input;
  return input.nickname || input.name || input.username || input.email || "";
};

const initials = (input) => {
  const base = displayName(input);
  const trimmed = (base || "").trim();
  if (!trimmed) return "";
  const parts = trimmed.split(/\s+/).slice(0, 2);
  return parts
    .map((segment) => segment[0] || "")
    .join("")
    .toUpperCase()
    .slice(0, 2);
};

export const hbsHelpers = {
  eq: (a, b) => a === b,
  and: (a, b) => a && b,
  or: (a, b) => a || b,
  not: (a) => !a,
  gt: (a,b) => a > b,
  lt: (a,b) => a < b,
  plus: (a,b) => a + b,
  minus: (a,b) => a - b,
  json: (c) => JSON.stringify(c),
  displayName,
  initials
};
