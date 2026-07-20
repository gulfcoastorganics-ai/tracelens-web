import test from "node:test";
import assert from "node:assert/strict";
import { imageDisplayName, isSupportedImageFile } from "../image-import.js";

test("image import accepts mobile files with missing or generic MIME types", () => {
  assert.equal(isSupportedImageFile({ name: "reference.jpg", type: "" }), true);
  assert.equal(isSupportedImageFile({ name: "reference.webp", type: "application/octet-stream" }), true);
  assert.equal(isSupportedImageFile({ name: "reference.txt", type: "application/octet-stream" }), false);
  assert.equal(isSupportedImageFile({ name: "reference.png", type: "image/png" }), true);
});

test("image display names are bounded and have a fallback", () => {
  assert.equal(imageDisplayName("reference.png"), "reference");
  assert.equal(imageDisplayName(""), "Reference image");
  assert.equal(imageDisplayName("a".repeat(100) + ".jpg").length, 80);
});
