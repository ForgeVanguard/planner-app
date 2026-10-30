import { Platform, Share } from "react-native";
import * as Clipboard from "expo-clipboard";
import { APP_NAME } from "../config";

export async function copyText(value: string): Promise<void> {
  await Clipboard.setStringAsync(value);
}

export async function shareText(value: string, title = APP_NAME): Promise<void> {
  if (Platform.OS === "web") {
    await copyText(value);
    return;
  }
  await Share.share({ message: value, title });
}

export async function downloadText(filename: string, contents: string, mime: string): Promise<void> {
  if (Platform.OS === "web") {
    const blob = new Blob([contents], { type: mime });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
    return;
  }
  const FileSystem = await import("expo-file-system");
  const Sharing = await import("expo-sharing");
  const file = new FileSystem.File(FileSystem.Paths.cache, filename);
  if (file.exists) file.delete();
  file.create();
  await file.write(contents);
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(file.uri);
}

export async function downloadShareCard(title: string, lines: string[]): Promise<void> {
  const body = lines.map((line) => escapeXml(line)).join("</tspan><tspan x=\"32\" dy=\"28\">");
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1200" viewBox="0 0 900 1200">
  <rect width="900" height="1200" fill="#10141A"/>
  <rect x="24" y="24" width="852" height="1152" rx="28" fill="#1C232E" stroke="#E4B56A"/>
  <text x="48" y="92" fill="#E4B56A" font-size="28" font-family="Georgia">${escapeXml(APP_NAME)}</text>
  <text x="48" y="150" fill="#F4F1EA" font-size="40" font-family="Georgia">${escapeXml(title)}</text>
  <text x="48" y="230" fill="#D5DCE6" font-size="22" font-family="Georgia"><tspan x="48">${body}</tspan></text>
</svg>`;
  if (Platform.OS === "web") {
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 900;
      canvas.height = 1200;
      const context = canvas.getContext("2d");
      context?.drawImage(image, 0, 0);
      URL.revokeObjectURL(url);
      canvas.toBlob((png) => {
        if (!png) return;
        const pngUrl = URL.createObjectURL(png);
        const anchor = document.createElement("a");
        anchor.href = pngUrl;
        anchor.download = `${title.replace(/\s+/g, "-").toLowerCase()}.png`;
        anchor.click();
        URL.revokeObjectURL(pngUrl);
      });
    };
    image.src = url;
    return;
  }
  await downloadText(`${title.replace(/\s+/g, "-").toLowerCase()}.svg`, svg, "image/svg+xml");
}

function escapeXml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}
