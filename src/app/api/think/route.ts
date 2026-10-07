import { NextRequest, NextResponse } from "next/server";

const API_KEY = process.env.APIYI_API_KEY;
const API_BASE = "https://api.apiyi.com/v1";
const THINKING_MODEL = "gemini-3.1-flash-preview";

export const maxDuration = 120; // Allow up to 2 min for analysis

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const brandName = formData.get("brandName") as string;
        const brief = formData.get("brief") as string;
        const files = formData.getAll("files") as File[];

        if (!brandName || !brief) {
            return NextResponse.json({ error: "品牌名称和创意需求不能为空" }, { status: 400 });
        }

        // Extract content from uploaded files
        const fileDescriptions: string[] = [];

        for (const file of files) {
            if (file.type === "application/pdf") {
                // For PDFs: extract text using pdf-parse
                try {
                    const buffer = Buffer.from(await file.arrayBuffer());
                    // Dynamic import to avoid SSR issues
                    const pdfParse = (await import("pdf-parse")).default;
                    const pdfData = await pdfParse(buffer);
                    fileDescriptions.push(`[PDF文件: ${file.name}]\n${pdfData.text.slice(0, 3000)}`);
                } catch {
                    fileDescriptions.push(`[PDF文件: ${file.name}] (文本提取失败，但文件已接收)`);
                }
            } else if (file.type.startsWith("image/")) {
                // For images: convert to base64 for vision
                const buffer = Buffer.from(await file.arrayBuffer());
                const base64 = buffer.toString("base64");
                fileDescriptions.push(`[图片文件: ${file.name}] (已转为Base64，将传入视觉分析)`);
                // We'll pass images directly to the model
                fileDescriptions.push(`data:${file.type};base64,${base64}`);
            }
        }

        // Build the system prompt for the brand strategist
        const systemPrompt = `你是一位世界级的品牌视觉策略师和AI提示词工程师。你的任务是：
1. 分析用户提供的品牌素材（PDF文本、图片等），深入理解品牌的核心定位、视觉语言（配色、字体、风格）、以及品牌调性。
2. 根据用户的营销需求，构思一个完美契合该品牌调性的1:8竖版微信长图文创意方案。
3. 将创意方案转化为一段极其详细的中文图像生成提示词（Prompt），确保生成的图像：
   - 严格遵循品牌的配色体系和视觉风格
   - 画面从上到下保持极度连贯的流动感（用水彩、丝带、植物枝蔓等元素贯穿）
   - 内容丰富但不杂乱（包含品牌Logo、情感文案、产品展示、节日祝福等区块）
   - 达到国际一线奢侈品牌画册的排版水平，4K超清画质

请直接输出最终的图像生成Prompt，不要输出其他内容。Prompt必须以"一张精美的微信公众号长图文海报"开头。`;

        // Build messages array
        const messages: Array<{ role: string; content: string | Array<{ type: string; text?: string; image_url?: { url: string } }> }> = [
            { role: "system", content: systemPrompt },
        ];

        // Build user message with text and images
        const userContentParts: Array<{ type: string; text?: string; image_url?: { url: string } }> = [];

        userContentParts.push({
            type: "text",
            text: `品牌名称：${brandName}\n\n营销需求：${brief}\n\n以下是品牌素材内容：\n${fileDescriptions.filter(d => !d.startsWith("data:")).join("\n\n")}`,
        });

        // Add image parts
        for (const desc of fileDescriptions) {
            if (desc.startsWith("data:")) {
                userContentParts.push({
                    type: "image_url",
                    image_url: { url: desc },
                });
            }
        }

        messages.push({ role: "user", content: userContentParts });

        // Call Gemini Flash Preview for thinking
        const response = await fetch(`${API_BASE}/chat/completions`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${API_KEY}`,
            },
            body: JSON.stringify({
                model: THINKING_MODEL,
                messages,
                max_tokens: 4096,
                temperature: 0.7,
            }),
        });

        if (!response.ok) {
            const errText = await response.text();
            console.error("Thinking API error:", errText);
            return NextResponse.json({ error: `AI分析失败: ${response.status}` }, { status: 500 });
        }

        const data = await response.json();
        const prompt = data.choices?.[0]?.message?.content?.trim();

        if (!prompt) {
            return NextResponse.json({ error: "AI未返回有效的提示词" }, { status: 500 });
        }

        return NextResponse.json({ prompt });
    } catch (e) {
        console.error("Think API error:", e);
        return NextResponse.json({ error: "服务器内部错误" }, { status: 500 });
    }
}
