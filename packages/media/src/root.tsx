import React from "react";
import { Composition } from "remotion";
import { BrandShort, type BrandShortProps } from "./template";

const defaultProps: BrandShortProps = {
  title: "Konten yang konsisten, tanpa lembur.",
  subtitle: "Routie mengubah satu ide menjadi konten lintas channel.",
  imageUrl: "https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=1080&q=80",
  primaryColor: "#0c2f2a",
  accentColor: "#edff8f"
};

export function RemotionRoot() {
  return <Composition
    id="BrandShort"
    component={BrandShort}
    durationInFrames={900}
    fps={30}
    width={1080}
    height={1920}
    defaultProps={defaultProps}
  />;
}
