import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  FEATURE_KEYS,
  defaultFeatureVector,
  fallbackRiskScoreFromFeatures,
  featureVectorToPayload,
  type FeatureVector,
} from "../featureVector";

describe("FEATURE_KEYS", () => {
  it("defines exactly eight production features in stable order", () => {
    assert.equal(FEATURE_KEYS.length, 8);
    assert.equal(new Set(FEATURE_KEYS).size, 8);
    assert.equal(FEATURE_KEYS[0], "previous_delays_count");
    assert.equal(FEATURE_KEYS[7], "course_engagement");
  });
});

describe("defaultFeatureVector", () => {
  it("returns all zeros keyed by FEATURE_KEYS", () => {
    const v = defaultFeatureVector();
    for (const k of FEATURE_KEYS) {
      assert.equal(v[k], 0);
    }
  });
});

describe("fallbackRiskScoreFromFeatures", () => {
  it("returns a score in [0, 1] for a zero vector", () => {
    const s = fallbackRiskScoreFromFeatures(defaultFeatureVector());
    assert.ok(s >= 0 && s <= 1);
  });

  it("increases when delay, non-submission, and workload signals increase", () => {
    const low: FeatureVector = {
      ...defaultFeatureVector(),
      previous_delays_count: 0,
      non_submission_count: 0,
      workload_level: 0,
    };
    const high: FeatureVector = {
      ...defaultFeatureVector(),
      previous_delays_count: 20,
      non_submission_count: 10,
      workload_level: 1.5,
    };
    assert.ok(fallbackRiskScoreFromFeatures(high) > fallbackRiskScoreFromFeatures(low));
  });

  it("saturates contributing terms so the result does not exceed 1", () => {
    const v: FeatureVector = {
      ...defaultFeatureVector(),
      previous_delays_count: 1000,
      non_submission_count: 1000,
      workload_level: 10,
    };
    assert.ok(fallbackRiskScoreFromFeatures(v) <= 1);
  });
});

describe("featureVectorToPayload", () => {
  it("emits one numeric entry per FEATURE_KEYS in object form", () => {
    const v: FeatureVector = {
      ...defaultFeatureVector(),
      assignments_count: 3.5,
    };
    const p = featureVectorToPayload(v);
    for (const k of FEATURE_KEYS) {
      assert.ok(Object.prototype.hasOwnProperty.call(p, k));
      assert.equal(typeof p[k], "number");
    }
    assert.equal(p.assignments_count, 3.5);
  });

  it("replaces non-finite values with 0", () => {
    const v = {
      ...defaultFeatureVector(),
      workload_level: Number.NaN,
    } as FeatureVector;
    const p = featureVectorToPayload(v);
    assert.equal(p.workload_level, 0);
  });
});
