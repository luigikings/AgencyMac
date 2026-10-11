import { describe, expect, it } from "vitest";
import { browserStatus, findHeadlessShell } from "./check-browser.mjs";

const PATH =
  "/home/dev/.cache/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-linux64/chrome-headless-shell";

describe("browserStatus", () => {
  it("is ok when the Playwright headless shell executable exists", () => {
    expect(browserStatus({ executablePath: PATH, exists: true })).toEqual({
      ok: true,
    });
  });

  it("fails when the headless shell is missing and names the install command", () => {
    const status = browserStatus({ executablePath: PATH, exists: false });
    expect(status.ok).toBe(false);
    expect(status.message).toContain("chrome-headless-shell");
    expect(status.message).toContain("pnpm browsers:install");
    expect(status.message).toContain(PATH);
  });

  it("fails with the install command when the path is unknown", () => {
    const status = browserStatus({ executablePath: "", exists: false });
    expect(status.ok).toBe(false);
    expect(status.message).toContain("pnpm browsers:install");
  });
});

describe("findHeadlessShell", () => {
  const entries = [
    "chromium-1248",
    "chromium_headless_shell-1200",
    "chromium_headless_shell-1248",
    "chromium_headless_shell-999",
    "ffmpeg-1013",
    "winldd-1007",
  ];

  it("picks the highest headless shell version on Windows", () => {
    expect(
      findHeadlessShell({
        browsersDir: "D:\\pw-browsers\\ms-playwright",
        platform: "win32",
        entries,
      }),
    ).toBe(
      "D:\\pw-browsers\\ms-playwright\\chromium_headless_shell-1248\\chrome-headless-shell-win64\\chrome-headless-shell.exe",
    );
  });

  it("builds the Linux executable path", () => {
    expect(
      findHeadlessShell({
        browsersDir: "/home/dev/.cache/ms-playwright",
        platform: "linux",
        entries,
      }),
    ).toBe(
      "/home/dev/.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell",
    );
  });

  it("builds the macOS executable path for the given architecture", () => {
    const base = {
      browsersDir: "/Users/dev/Library/Caches/ms-playwright",
      platform: "darwin",
      entries,
    };
    expect(findHeadlessShell({ ...base, arch: "arm64" })).toBe(
      "/Users/dev/Library/Caches/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-mac-arm64/chrome-headless-shell",
    );
    expect(findHeadlessShell({ ...base, arch: "x64" })).toBe(
      "/Users/dev/Library/Caches/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-mac-x64/chrome-headless-shell",
    );
  });

  it("returns null when no headless shell folder exists", () => {
    expect(
      findHeadlessShell({
        browsersDir: "/home/dev/.cache/ms-playwright",
        platform: "linux",
        entries: ["chromium-1248", "ffmpeg-1013"],
      }),
    ).toBeNull();
    expect(
      findHeadlessShell({
        browsersDir: "/home/dev/.cache/ms-playwright",
        platform: "linux",
        entries: [],
      }),
    ).toBeNull();
  });

  it("returns null on an unsupported platform", () => {
    expect(
      findHeadlessShell({ browsersDir: "/x", platform: "aix", entries }),
    ).toBeNull();
  });
});
