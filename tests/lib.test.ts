import { describe, expect, it } from "vitest";
import { formatBytes, lightroomFilter, toCsv } from "@/lib/format";
import { isValidSlug, slugify } from "@/lib/slug";

describe("slugify", () => {
  it("transliterates Russian titles", () => {
    expect(slugify("Свадьба Анны и Ильи")).toBe("svadba-anny-i-ili");
  });
  it("handles Latin, digits and punctuation", () => {
    expect(slugify("  Family shoot, 2026!  ")).toBe("family-shoot-2026");
  });
  it("falls back when nothing is left", () => {
    expect(slugify("!!!")).toBe("gallery");
  });
  it("produces valid slugs", () => {
    for (const t of ["Свадьба Анны и Ильи", "a".repeat(100), "x - y"]) expect(isValidSlug(slugify(t))).toBe(true);
  });
});

describe("isValidSlug", () => {
  it("rejects bad slugs", () => {
    expect(isValidSlug("-a")).toBe(false);
    expect(isValidSlug("A")).toBe(false);
    expect(isValidSlug("a b")).toBe(false);
    expect(isValidSlug("ok-1")).toBe(true);
  });
});

describe("format", () => {
  it("formats bytes in Russian units", () => {
    expect(formatBytes(500)).toBe("500 Б");
    expect(formatBytes(1536)).toBe("1.5 КБ");
    expect(formatBytes(120 * 1024 ** 3)).toBe("120 ГБ");
  });
  it("builds a Lightroom filter string", () => {
    expect(lightroomFilter(["IMG_0001.jpg", "DSC_12.CR3", "noext"])).toBe("IMG_0001, DSC_12, noext");
  });
  it("escapes CSV cells and adds a BOM", () => {
    expect(toCsv([["a", 'b"c', "d,e"]])).toBe('﻿a,"b""c","d,e"\r\n');
  });
});
