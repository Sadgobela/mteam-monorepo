"use client";

import Image from "next/image";
import { useState } from "react";
import { thumbUrl } from "@mteam/shared";

/** A photo's small copy, filling its box. Falls back to the photo itself when the copy is missing, as it is for older uploads. */
export function Thumbnail({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  return <Image src={failed ? src : thumbUrl(src)} alt={alt} fill unoptimized onError={() => setFailed(true)} />;
}
