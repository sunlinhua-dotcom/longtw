import { NextRequest, NextResponse } from "next/server";

const API_KEY = "***REMOVED***";
const API_BASE = "https://api.apiyi.com/v1";
const IMAGE_MODEL = "gemini-3.1-flash-image-preview";

export const maxDuration = 180; // Allow up to 3 min for image generation

export async function POST(req: NextRequest) {
    try {
        const { prompt } = await req.json();

        if (!prompt) {
            return NextResponse.json({ error: "提示词不能为空" }, { status: 400 });
        }

        // Call Nano Banana 2 for image generation
        // The APIYI endpoint follows OpenAI-compatible chat completions format
        // with response_modalities for image output
        const response = await fetch(`${API_BASE}/chat/completions`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${API_KEY}`,
            },
            body: JSON.stringify({
                model: IMAGE_MODEL,
                messages: [
                    {
                        role: "user",
                        content: prompt + "\n\n请严格按照以上描述生成1:8竖版超长图，4K超清画质。",
                    },
                ],
                // APIYI specific parameters for Nano Banana 2
                max_tokens: 8192,
                temperature: 1.0,
                response_modalities: ["image", "text"],
                image_size: {
                    width: 1024,
                    height: 8192,
                },
            }),
        });

        if (!response.ok) {
            const errText = await response.text();
            console.error("Generate API error:", errText);
            return NextResponse.json(
                { error: `图像生成失败: ${response.status}` },
                { status: 500 }
            );
        }

        const data = await response.json();

        // Extract image from response
        // APIYI returns inline_data with base64 for Nano Banana 2
        const content = data.choices?.[0]?.message?.content;

        let imageBase64: string | null = null;

        // Handle different response formats from APIYI
        if (typeof content === "string") {
            // Some API responses include base64 in text
            // Check if it's an image data URL
            const base64Match = content.match(/data:image\/[^;]+;base64,([A-Za-z0-9+/=]+)/);
            if (base64Match) {
                imageBase64 = base64Match[1];
            }
        } else if (Array.isArray(content)) {
            // Multi-part response
            for (const part of content) {
                if (part.type === "image" && part.image_url?.url) {
                    // Extract base64 from data URL  
                    const url = part.image_url.url;
                    if (url.startsWith("data:")) {
                        imageBase64 = url.split(",")[1];
                    } else {
                        // It's a URL, fetch it
                        const imgRes = await fetch(url);
                        const imgBuf = await imgRes.arrayBuffer();
                        imageBase64 = Buffer.from(imgBuf).toString("base64");
                    }
                    break;
                }
                if (part.type === "image_url" && part.image_url?.url) {
                    const url = part.image_url.url;
                    if (url.startsWith("data:")) {
                        imageBase64 = url.split(",")[1];
                    } else {
                        const imgRes = await fetch(url);
                        const imgBuf = await imgRes.arrayBuffer();
                        imageBase64 = Buffer.from(imgBuf).toString("base64");
                    }
                    break;
                }
                // Handle inline_data format
                if (part.inline_data) {
                    imageBase64 = part.inline_data.data;
                    break;
                }
            }
        }

        // Also check for parts in the response (Gemini native format)
        if (!imageBase64) {
            const parts = data.candidates?.[0]?.content?.parts;
            if (Array.isArray(parts)) {
                for (const part of parts) {
                    if (part.inline_data?.data) {
                        imageBase64 = part.inline_data.data;
                        break;
                    }
                }
            }
        }

        if (!imageBase64) {
            console.error("No image found in response:", JSON.stringify(data).slice(0, 500));
            return NextResponse.json(
                { error: "AI返回了文本但未生成图像，请重试" },
                { status: 500 }
            );
        }

        return NextResponse.json({ imageBase64 });
    } catch (e) {
        console.error("Generate API error:", e);
        return NextResponse.json({ error: "服务器内部错误" }, { status: 500 });
    }
}
