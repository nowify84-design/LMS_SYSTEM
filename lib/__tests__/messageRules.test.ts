import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getMessageForLevel,
  getMessageLines,
  type PredictionLevel,
} from "../messageRules";

describe("getMessageForLevel", () => {
  it("Low level message references commitment", () => {
    assert.match(getMessageForLevel("Low"), /commitment and consistency/);
  });

  it("Medium level message references starting early", () => {
    assert.match(getMessageForLevel("Medium"), /starting early/);
  });

  it("High level message references immediate action", () => {
    assert.match(getMessageForLevel("High"), /Immediate action/);
  });

  it("returns defensive copy for invalid level", () => {
    const msg = getMessageForLevel("Unknown" as PredictionLevel);
    assert.ok(msg.length > 0);
    assert.match(msg, /Review/);
  });
});

describe("getMessageLines", () => {
  it("returns two lines for Low level", () => {
    const [a, b] = getMessageLines("Low");
    assert.ok(a);
    assert.ok(b);
  });

  it("returns a single primary line for Medium and High", () => {
    assert.equal(getMessageLines("Medium")[1], null);
    assert.equal(getMessageLines("High")[1], null);
  });
});
