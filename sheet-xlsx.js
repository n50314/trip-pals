import { strFromU8, unzipSync } from "fflate";

const readXml = (files, path) => (files[path] ? strFromU8(files[path]) : "");

function decodeXml(value) {
  return String(value || "")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'")
    .replaceAll("&amp;", "&");
}

function attribute(source, name) {
  return decodeXml(source.match(new RegExp(`\\b${name}="([^"]*)"`))?.[1] || "");
}

function textNodes(source) {
  return [...source.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)]
    .map((match) => decodeXml(match[1]))
    .join("");
}

function columnIndex(reference) {
  const letters = String(reference || "").match(/^[A-Z]+/)?.[0] || "A";
  let value = 0;
  for (const letter of letters) value = value * 26 + letter.charCodeAt(0) - 64;
  return value - 1;
}

function parseWorksheet(xml, sharedStrings) {
  const rows = [];
  for (const rowMatch of xml.matchAll(/<row(?:\s[^>]*)?>([\s\S]*?)<\/row>/g)) {
    const values = [];
    for (const cellMatch of rowMatch[1].matchAll(/<c(\s[^>]*)?>([\s\S]*?)<\/c>/g)) {
      const attrs = cellMatch[1] || "";
      const body = cellMatch[2];
      const type = attribute(attrs, "t");
      const index = columnIndex(attribute(attrs, "r"));
      const rawValue = body.match(/<v>([\s\S]*?)<\/v>/)?.[1] || "";
      let value;
      if (type === "s") {
        value = sharedStrings[Number(rawValue)] || "";
      } else if (type === "inlineStr") {
        value = textNodes(body);
      } else if (type === "b") {
        value = rawValue === "1" ? "TRUE" : "FALSE";
      } else {
        value = decodeXml(rawValue);
      }
      values[index] = value.replace(/\s+/g, " ").trim();
    }
    while (values.length && !values.at(-1)) values.pop();
    if (values.some(Boolean)) rows.push(values.map((value) => value || "").join("\t"));
  }
  return rows.join("\n");
}

export function xlsxToText(arrayBuffer, maxLength = 80000) {
  const files = unzipSync(new Uint8Array(arrayBuffer));
  const workbook = readXml(files, "xl/workbook.xml");
  const relationships = readXml(files, "xl/_rels/workbook.xml.rels");
  if (!workbook || !relationships) throw new Error("這不是可讀取的 Google Sheet 檔案。");

  const relationshipTargets = new Map(
    [...relationships.matchAll(/<Relationship(\s[^>]*)\/?>/g)].map((match) => {
      const attrs = match[1] || "";
      return [attribute(attrs, "Id"), attribute(attrs, "Target")];
    }),
  );
  const sharedStringsXml = readXml(files, "xl/sharedStrings.xml");
  const sharedStrings = [...sharedStringsXml.matchAll(/<si(?:\s[^>]*)?>([\s\S]*?)<\/si>/g)].map(
    (match) => textNodes(match[1]),
  );
  const sections = [];
  for (const match of workbook.matchAll(/<sheet(\s[^>]*)\/?>/g)) {
    const attrs = match[1] || "";
    const name = attribute(attrs, "name") || "未命名工作表";
    const relationshipId = attribute(attrs, "r:id");
    let target = relationshipTargets.get(relationshipId) || "";
    target = target.replace(/^\/?xl\//, "");
    const path = target.startsWith("worksheets/") ? `xl/${target}` : `xl/${target}`;
    const sheetXml = readXml(files, path);
    if (!sheetXml) continue;
    const content = parseWorksheet(sheetXml, sharedStrings);
    sections.push({ name, content: content || "（空白工作表）" });
  }
  if (!sections.length) throw new Error("這份 Google Sheet 沒有可讀取的工作表。");

  const render = (section, content = section.content) =>
    `--- 工作表：${section.name} ---\n${content}`;
  const joined = sections.map((section) => render(section)).join("\n\n");
  if (joined.length <= maxLength) return joined;

  const fixedLength = sections.reduce(
    (total, section) => total + render(section, "").length,
    Math.max(0, sections.length - 1) * 2,
  );
  const perSheetLimit = Math.max(
    0,
    Math.floor((maxLength - fixedLength) / sections.length) - 18,
  );
  return sections
    .map((section) => {
      const content =
        section.content.length > perSheetLimit
          ? `${section.content.slice(0, perSheetLimit)}\n（此工作表內容已截取）`
          : section.content;
      return render(section, content);
    })
    .join("\n\n")
    .slice(0, maxLength);
}
