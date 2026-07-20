const IMAGE_EXTENSIONS = new Set(["avif", "bmp", "gif", "heic", "heif", "jpeg", "jpg", "png", "svg", "webp"]);

/** Accept valid image MIME types and mobile-provider files with a missing MIME. */
export function isSupportedImageFile(file) {
  if (!file) return false;
  const type = typeof file.type === "string" ? file.type.toLowerCase() : "";
  if (type.startsWith("image/")) return true;
  const name = typeof file.name === "string" ? file.name.toLowerCase() : "";
  const extension = name.split(".").pop();
  return IMAGE_EXTENSIONS.has(extension) && (!type || type === "application/octet-stream" || type === "binary/octet-stream");
}

export function imageDisplayName(name = "") {
  const value = typeof name === "string" ? name.replace(/\.[^/.]+$/, "").trim() : "";
  return value.slice(0, 80) || "Reference image";
}
