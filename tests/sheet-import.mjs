import assert from "node:assert/strict";
import { strToU8, zipSync } from "fflate";
import { POST } from "../app/api/ai/import/route.js";
import { xlsxToText } from "../sheet-xlsx.js";

delete process.env.OPENAI_API_KEY;
let requestedUrl = "";
const originalFetch = globalThis.fetch;
const workbook = zipSync({
  "xl/workbook.xml": strToU8(
    '<workbook xmlns:r="relationships"><sheets><sheet name="第一天" sheetId="1" r:id="rId1"/><sheet name="第二天" sheetId="2" r:id="rId2"/></sheets></workbook>',
  ),
  "xl/_rels/workbook.xml.rels": strToU8(
    '<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Target="worksheets/sheet2.xml"/></Relationships>',
  ),
  "xl/worksheets/sheet1.xml": strToU8(
    '<worksheet><sheetData><row><c r="A1" t="inlineStr"><is><t>日期</t></is></c><c r="B1" t="inlineStr"><is><t>景點</t></is></c></row><row><c r="A2" t="inlineStr"><is><t>8/1</t></is></c><c r="B2" t="inlineStr"><is><t>台北車站</t></is></c></row></sheetData></worksheet>',
  ),
  "xl/worksheets/sheet2.xml": strToU8(
    '<worksheet><sheetData><row><c r="A1" t="inlineStr"><is><t>8/2</t></is></c><c r="B1" t="inlineStr"><is><t>故宮博物院</t></is></c></row></sheetData></worksheet>',
  ),
});
const workbookBuffer = workbook.buffer.slice(
  workbook.byteOffset,
  workbook.byteOffset + workbook.byteLength,
);
const parsedWorkbook = xlsxToText(workbookBuffer);
assert.match(parsedWorkbook, /工作表：第一天/);
assert.match(parsedWorkbook, /台北車站/);
assert.match(parsedWorkbook, /工作表：第二天/);
assert.match(parsedWorkbook, /故宮博物院/);
const limitedWorkbook = xlsxToText(workbookBuffer, 100);
assert.match(limitedWorkbook, /工作表：第一天/);
assert.match(limitedWorkbook, /工作表：第二天/);

try {
  globalThis.fetch = async (url) => {
    requestedUrl = String(url);
    return new Response(workbook, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      },
    });
  };
  const response = await POST(
    new Request("http://localhost/api/ai/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rawText: "https://docs.google.com/spreadsheets/d/abc_DEF-123/edit#gid=456",
        destination: "台北",
      }),
    }),
  );
  assert.equal(response.status, 503);
  assert.equal(
    requestedUrl,
    "https://docs.google.com/spreadsheets/d/abc_DEF-123/export?format=xlsx",
  );

  globalThis.fetch = async () =>
    new Response("<!doctype html><html><form>Google login</form></html>", { status: 200 });
  const privateResponse = await POST(
    new Request("http://localhost/api/ai/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rawText: "https://docs.google.com/spreadsheets/d/private-sheet/edit#gid=0",
      }),
    }),
  );
  assert.equal(privateResponse.status, 400);
  assert.match((await privateResponse.json()).error, /知道連結的任何人可檢視/);
  console.log("Sheet import source test passed.");
} finally {
  globalThis.fetch = originalFetch;
}
