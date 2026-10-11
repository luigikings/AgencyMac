import { describe, expect, it } from "vitest";
import { findHexColors } from "./hex-colors";

describe("findHexColors (RF-17)", () => {
  it.each([
    ["color: #fff;", ["#fff"]],
    ["color: #FFF8;", ["#FFF8"]],
    ["background: #34006f;", ["#34006f"]],
    ["background: #34006F80;", ["#34006F80"]],
  ])("finds the hex in %j", (source, expected) => {
    expect(findHexColors(source)).toEqual(expected);
  });

  it("finds every hex in a source, in order", () => {
    expect(
      findHexColors(
        '<svg fill="#123456"><style>a{color:#abc}</style></svg>\n#ABCDEF',
      ),
    ).toEqual(["#123456", "#abc", "#ABCDEF"]);
  });

  it.each([
    ["an HTML numeric entity", "It&#8217;s"],
    ["an HTML hex entity", "It&#x2019;s"],
    ["an anchor", '<a href="#content">Skip</a>'],
    ["a fragment in a URL", "https://agencymac.com/#main"],
    ["a too long hex", "#1234567"],
    ["a too short hex", "#12"],
    ["a hash inside a word", "issue#123"],
    ["no hex at all", "color: var(--color-text);"],
  ])("ignores %s", (_label, source) => {
    expect(findHexColors(source)).toEqual([]);
  });
});
