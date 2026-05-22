/**
 * בדיקות קלילות לפני העלאת תמונה בדפדפן (חדות + בהירות ממוצעת).
 * לא דיוק מלא — מסייע להפחית קבלות שלא יזוהו טוב.
 */

/**
 * מתחת לערך זה — נחשב כמטושטש (variance of Laplacian אחרי downscale).
 * סף גבוה יותר = יותר תמונות יסומנו כלא חדות; נמוך יותר = פחות התראות טשטוש.
 */
export const DEFAULT_BLUR_VARIANCE_THRESHOLD = 80;

/**
 * מתחת לממוצע זה (0–255 על פיקסלים באפור) — נחשב כחשוך מדי.
 * סף **גבוה יותר** = יותר תמונות יסומנו כחשוכות (מחמירים).
 * סף **נמוך יותר** = פחות התראות על חשיכה (סובלים יותר).
 */
export const DEFAULT_DARK_MEAN_THRESHOLD = 62;

export type ImagePreUploadQualityResult =
  | {
      ok: true;
      laplacianVariance: number;
      meanLuminance: number;
      likelyBlurry: boolean;
      likelyTooDark: boolean;
    }
  | { ok: false; reason: string };

const ANALYSIS_MAX_EDGE_PX = 480;

function rgbToGray(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

function laplacianVariance(
  gray: Float64Array,
  width: number,
  height: number,
): number {
  let sum = 0;
  let sumSq = 0;
  let n = 0;
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const i = y * width + x;
      const L =
        4 * gray[i] -
        gray[i - 1] -
        gray[i + 1] -
        gray[i - width] -
        gray[i + width];
      sum += L;
      sumSq += L * L;
      n += 1;
    }
  }
  if (n === 0) return 0;
  const mean = sum / n;
  return sumSq / n - mean * mean;
}

function meanGrayLevel(gray: Float64Array): number {
  if (gray.length === 0) return 0;
  let s = 0;
  for (let i = 0; i < gray.length; i += 1) {
    s += gray[i];
  }
  return s / gray.length;
}

export type PreUploadQualityOptions = {
  blurVarianceThreshold?: number;
  /** פיקסלים ממוצעים בגוונאי אפור מתחת לערך זה = חשוך */
  darkMeanThreshold?: number;
};

/**
 * הערכה אחת לתמונה: חדות + האם נראית חשוכה מדי (ממוצע בהירות נמוך).
 */
export async function assessImagePreUploadQuality(
  file: File,
  options: PreUploadQualityOptions = {},
): Promise<ImagePreUploadQualityResult> {
  const blurTh =
    options.blurVarianceThreshold ?? DEFAULT_BLUR_VARIANCE_THRESHOLD;
  const darkTh = options.darkMeanThreshold ?? DEFAULT_DARK_MEAN_THRESHOLD;

  if (typeof document === "undefined") {
    return { ok: false, reason: "no-document" };
  }

  try {
    const bmp = await createImageBitmap(file);
    try {
      const w0 = bmp.width;
      const h0 = bmp.height;
      if (w0 < 3 || h0 < 3) {
        return { ok: false, reason: "too-small" };
      }
      const scale = Math.min(1, ANALYSIS_MAX_EDGE_PX / Math.max(w0, h0));
      const cw = Math.max(32, Math.round(w0 * scale));
      const ch = Math.max(32, Math.round(h0 * scale));

      const canvas = document.createElement("canvas");
      canvas.width = cw;
      canvas.height = ch;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        return { ok: false, reason: "no-2d-context" };
      }
      ctx.drawImage(bmp, 0, 0, cw, ch);
      const imageData = ctx.getImageData(0, 0, cw, ch);
      const { data, width, height } = imageData;

      const gray = new Float64Array(width * height);
      for (let i = 0, p = 0; i < data.length; i += 4, p += 1) {
        gray[p] = rgbToGray(data[i], data[i + 1], data[i + 2]);
      }

      const variance = laplacianVariance(gray, width, height);
      if (!Number.isFinite(variance) || variance < 0) {
        return { ok: false, reason: "invalid-variance" };
      }

      const meanLum = meanGrayLevel(gray);
      if (!Number.isFinite(meanLum)) {
        return { ok: false, reason: "invalid-luminance" };
      }

      return {
        ok: true,
        laplacianVariance: variance,
        meanLuminance: meanLum,
        likelyBlurry: variance < blurTh,
        likelyTooDark: meanLum < darkTh,
      };
    } finally {
      bmp.close?.();
    }
  } catch {
    return { ok: false, reason: "decode-failed" };
  }
}

/** תאימות לאחור — רק הערכת טשטוש */
export async function assessImageBlurLikelihood(
  file: File,
  threshold: number = DEFAULT_BLUR_VARIANCE_THRESHOLD,
): Promise<
  | { ok: true; variance: number; likelyBlurry: boolean }
  | { ok: false; reason: string }
> {
  const r = await assessImagePreUploadQuality(file, {
    blurVarianceThreshold: threshold,
  });
  if (!r.ok) return r;
  return {
    ok: true,
    variance: r.laplacianVariance,
    likelyBlurry: r.likelyBlurry,
  };
}

/**
 * פרמטרים אופציונליים מ־Env (צד לקוח). הגדר ב־`.env.local` כ־NEXT_PUBLIC_*:
 * `NEXT_PUBLIC_UPLOAD_IMAGE_DARK_MEAN_THRESHOLD`
 * `NEXT_PUBLIC_UPLOAD_IMAGE_BLUR_VARIANCE_THRESHOLD`
 */
export function preUploadQualityOptionsFromPublicEnv(): PreUploadQualityOptions {
  const o: PreUploadQualityOptions = {};
  if (typeof process === "undefined") return o;

  const blurRaw =
    process.env.NEXT_PUBLIC_UPLOAD_IMAGE_BLUR_VARIANCE_THRESHOLD?.trim();
  if (blurRaw !== undefined && blurRaw !== "") {
    const n = Number(blurRaw);
    if (Number.isFinite(n) && n >= 10 && n <= 5000) {
      o.blurVarianceThreshold = n;
    }
  }

  const darkRaw =
    process.env.NEXT_PUBLIC_UPLOAD_IMAGE_DARK_MEAN_THRESHOLD?.trim();
  if (darkRaw !== undefined && darkRaw !== "") {
    const n = Number(darkRaw);
    if (Number.isFinite(n) && n >= 1 && n <= 254) {
      o.darkMeanThreshold = n;
    }
  }

  return o;
}
