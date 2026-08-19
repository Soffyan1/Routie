import { renderMedia, selectComposition } from "@remotion/renderer";
import type { BrandShortProps } from "./template";

export async function renderBrandShort(serveUrl: string, outputLocation: string, inputProps: BrandShortProps) {
  const serializedProps = { ...inputProps } as Record<string, unknown>;
  const composition = await selectComposition({ serveUrl, id: "BrandShort", inputProps: serializedProps });
  await renderMedia({ composition, serveUrl, codec: "h264", outputLocation, inputProps: serializedProps, imageFormat: "jpeg", crf: 18 });
  return { outputLocation, durationSeconds: composition.durationInFrames / composition.fps, width: composition.width, height: composition.height };
}
